import openai from '../config/openAi.js';
import bookingModel from '../models/bookingModel.js';
import branchModel from '../models/branchModel.js';
import filmModel from '../models/filmModel.js';
import roomModel from '../models/roomModel.js';
import roomTypeModel from '../models/roomTypeModel.js';
import timeSlotModel from '../models/timeSlotModel.js';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isBetween from 'dayjs/plugin/isBetween.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

// *** BỘ NHỚ NGỮ CẢNH: Lưu trữ thông tin cho mỗi người dùng ***
const userSessions = {};
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

const normalizeText = (text = '') => {
    if (typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
};

const parseDateFromMessage = (message) => {
    const lowerMessage = normalizeText(message);
    let targetDate = null;
    const nowInVietnam = dayjs().tz(VIETNAM_TIMEZONE);
    if (lowerMessage.includes('hom nay') || lowerMessage.includes('hien tai')) {
        targetDate = nowInVietnam;
    } else if (lowerMessage.includes('ngay mai')) {
        targetDate = nowInVietnam.add(1, 'day');
    } else if (lowerMessage.includes('ngay mot') || lowerMessage.includes('ngay kia')) {
        targetDate = nowInVietnam.add(2, 'day');
    } else {
        const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
        const match = lowerMessage.match(dateRegex);
        if (match) {
            const day = match[1];
            const month = match[2];
            let year = match[3] || nowInVietnam.year();
            if (match[3] && match[3].length === 2) {
                year = Math.floor(nowInVietnam.year() / 100) * 100 + parseInt(match[3]);
            }
            const dateString = `${year}-${month}-${day}`;
            targetDate = dayjs.tz(dateString, 'YYYY-M-D', VIETNAM_TIMEZONE);
        }
    }
    return targetDate ? targetDate.startOf('day').toDate() : null;
};

const parseTimeFromMessage = (text) => {
    const normText = normalizeText(text);
    const timeRegex = /\b(\d{1,2})h(?:(30|ruoi))?\b|\b(\d{1,2}):(\d{2})\b/;
    const match = normText.match(timeRegex);
    if (!match) return null;
    if (match[1]) {
        const hour = match[1].padStart(2, '0');
        const minute = match[2] === '30' || match[2] === 'ruoi' ? '30' : '00';
        return `${hour}:${minute}`;
    }
    if (match[3]) {
        const hour = match[3].padStart(2, '0');
        const minute = match[4].padStart(2, '0');
        return `${hour}:${minute}`;
    }
    return null;
};

async function extractEntities(message, availableBranches, availableRoomTypes) {
    const normalizedMessage = normalizeText(message);
    const nowInVietnam = dayjs().tz(VIETNAM_TIMEZONE);
    let extracted = {
        branchName: null,
        roomTypeName: null,
        roomName: null,
        date: parseDateFromMessage(message),
        startTime: null,
        endTime: null,
        intent: 'unknown',
    };

    if (normalizedMessage.includes('phim hot') || normalizedMessage.includes('phim nao hay')) {
        extracted.intent = 'get_hot_films';
    } else if (normalizedMessage.includes('phim')) {
        extracted.intent = 'get_film_list';
    } else if (
        (normalizedMessage.includes('phong') && (normalizedMessage.includes('trong') || normalizedMessage.includes('con'))) ||
        normalizedMessage.includes('khung gio trong') ||
        normalizedMessage.includes('the ngay mai') // Nhận diện câu hỏi nối tiếp
    ) {
        extracted.intent = 'find_available_rooms';
    } else if (normalizedMessage.includes('dat phong')) {
        extracted.intent = 'book_room';
    } else if (normalizedMessage.includes('huong dan dat phong') || normalizedMessage.includes('cach dat phong')) {
        extracted.intent = 'get_booking_instructions';
    } else if (
        normalizedMessage.includes('chi nhanh nao') ||
        normalizedMessage.includes('co so nao') ||
        normalizedMessage.includes('goi y chi nhanh')
    ) {
        extracted.intent = 'recommend_branch';
    } else if (normalizedMessage.includes('loai phong nao') || normalizedMessage.includes('goi y loai phong')) {
        extracted.intent = 'recommend_room_type';
    }

    const roomNameRegex = /(?:phong|p)\s*([a-zA-Z0-9]+)/;
    const roomMatch = normalizedMessage.match(roomNameRegex);
    if (roomMatch && roomMatch[1]) {
        extracted.roomName = roomMatch[1];
    }
    
    let foundBranch = null;
    const sortedBranches = [...availableBranches].sort((a, b) => b.name.length - a.name.length);
    for (const branch of sortedBranches) {
        const coreBranchName = normalizeText(branch.name)
            .replace(/\d+/g, '')
            .replace(/quan|phuong|duong|ngo|pho|q\./g, '')
            .trim();
        if (coreBranchName && normalizedMessage.includes(coreBranchName)) {
            foundBranch = branch;
            break;
        }
    }
    if (foundBranch) {
        extracted.branchName = foundBranch.name;
    }
    
    for (const roomType of availableRoomTypes) {
        const roomTypeRegex = new RegExp(`\\b${normalizeText(roomType.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (roomTypeRegex.test(normalizedMessage)) {
            extracted.roomTypeName = roomType.name;
            break;
        }
    }

    const fromNowRegex = /(?:tu gio|bay gio|hien tai)/;
    const untilRegex = /(?:den|toi)\s+([^\s]+(?:\s*gio)?(?:[0-9]{2})?)/;
    const rangeRegex = /(?:tu|from)\s+([^\s]+(?:\s*gio)?(?:[0-9]{2})?)\s+(?:den|to)\s+([^\s]+(?:\s*gio)?(?:[0-9]{2})?)/;
    const rangeMatch = normalizedMessage.match(rangeRegex);
    const untilMatch = normalizedMessage.match(untilRegex);
    if (rangeMatch) {
        extracted.startTime = fromNowRegex.test(rangeMatch[1]) ? nowInVietnam.format('HH:mm') : parseTimeFromMessage(rangeMatch[1]);
        extracted.endTime = parseTimeFromMessage(rangeMatch[2]);
    } else if (untilMatch) {
        if (fromNowRegex.test(normalizedMessage)) {
            extracted.startTime = nowInVietnam.format('HH:mm');
        }
        extracted.endTime = parseTimeFromMessage(untilMatch[1]);
    }

    return extracted;
}

async function findAvailableRoomsForTimeRange({ branchId, date, startTime, endTime }) {
    const allTimeSlots = await timeSlotModel.find({}).sort({ start_time: 1 });
    if (!allTimeSlots.length) return [];
    const requiredSlots = allTimeSlots.filter((slot) => slot.start_time >= startTime && slot.end_time <= endTime);
    if (!requiredSlots.length) return [];
    const roomsInBranch = await roomModel.find({ branch: branchId });
    if (!roomsInBranch.length) return [];
    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();
    const bookingsOnDate = await bookingModel.find({
        room: { $in: roomsInBranch.map((r) => r._id) },
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['ĐÃ HỦY', 'THẤT BẠI'] },
    });
    const bookedSlotMap = new Map();
    bookingsOnDate.forEach((booking) => {
        const roomIdStr = booking.room.toString();
        if (!bookedSlotMap.has(roomIdStr)) {
            bookedSlotMap.set(roomIdStr, new Set());
        }
        const roomSlots = bookedSlotMap.get(roomIdStr);
        booking.time_slots.forEach((slotId) => roomSlots.add(slotId.toString()));
    });
    const availableRooms = roomsInBranch.filter((room) => {
        const bookedSlotsForThisRoom = bookedSlotMap.get(room._id.toString()) || new Set();
        const isAnySlotBooked = requiredSlots.some((reqSlot) => bookedSlotsForThisRoom.has(reqSlot._id.toString()));
        return !isAnySlotBooked;
    });
    return availableRooms.map((room) => ({ name: room.name }));
}

async function findAvailableSlotsForRoom({ roomId, date }) {
    const allTimeSlots = await timeSlotModel.find({}).sort({ start_time: 1 });
    const startOfDay = dayjs(date).startOf('day').toDate();
    const endOfDay = dayjs(date).endOf('day').toDate();
    const bookingsForRoom = await bookingModel.find({
        room: roomId,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $nin: ['ĐÃ HỦY', 'THẤT BẠI'] },
    });
    const bookedSlotIds = new Set();
    bookingsForRoom.forEach(booking => {
        booking.time_slots.forEach(slotId => bookedSlotIds.add(slotId.toString()));
    });
    const nowInVietnam = dayjs().tz(VIETNAM_TIMEZONE);
    const isToday = dayjs(date).isSame(nowInVietnam, 'day');
    const availableSlots = allTimeSlots.filter(slot => {
        const isBooked = bookedSlotIds.has(slot._id.toString());
        if (isBooked) return false;
        if (isToday) {
            const slotStartTime = dayjs.tz(`${dayjs(date).format('YYYY-MM-DD')} ${slot.start_time}`, 'YYYY-MM-DD HH:mm', VIETNAM_TIMEZONE);
            if (slotStartTime.isBefore(nowInVietnam)) {
                return false;
            }
        }
        return true;
    });
    return availableSlots;
}

export const handleChat = async (message, userId = 'defaultUser') => {
    // Khởi tạo hoặc lấy lại phiên làm việc của user
    if (!userSessions[userId]) {
        userSessions[userId] = { context: {}, lastIntent: null };
    }
    const session = userSessions[userId];

    let systemPrompt = `Bạn là trợ lý ảo của PNM-BOX, một hệ thống cafe phim. Hãy luôn trả lời một cách lịch sự, thân thiện, rõ ràng và hữu ích. Khi cung cấp danh sách (phim, phòng, khung giờ), hãy trình bày mỗi mục trên một dòng để dễ đọc. Nếu người dùng hỏi thông tin mà bạn không có hoặc không chắc chắn, hãy thông báo một cách trung thực và đề nghị hỗ trợ thêm. Nếu thiếu thông tin để xử lý yêu cầu, hãy lịch sự hỏi lại người dùng để bổ sung. Phân tích kỹ thông tin hỗ trợ được cung cấp để đưa ra câu trả lời chính xác.`;

    let contextForLLM = {
        query: message,
        database_info: null,
        notes_for_assistant: [],
    };

    const allBranches = await branchModel.find({});
    const allRoomTypes = await roomTypeModel.find({});
    const extractedInfo = await extractEntities(message, allBranches, allRoomTypes);
    const newIntent = extractedInfo.intent;
    
    // Lưu thông tin mới vào ngữ cảnh
    if (extractedInfo.branchName) session.context.branchName = extractedInfo.branchName;
    if (extractedInfo.date) session.context.date = extractedInfo.date.toISOString();
    if (extractedInfo.startTime) session.context.startTime = extractedInfo.startTime;
    if (extractedInfo.endTime) session.context.endTime = extractedInfo.endTime;
    if (extractedInfo.roomName) session.context.roomName = extractedInfo.roomName;

    contextForLLM.user_context = { ...session.context };
    session.lastIntent = newIntent;

    if (newIntent === 'get_booking_instructions') {
        return `Để đặt phòng tại PNM-BOX, bạn chỉ cần làm theo các bước đơn giản sau ạ:\n1. **Chọn phim**\n2. **Chọn cơ sở**\n3. **Chọn ngày**\n4. **Chọn phòng**\n5. **Chọn Combo**\n6. **Hoàn tất đặt phòng**\nChúc bạn có những giây phút xem phim vui vẻ!`;
    }

    if (newIntent === 'get_hot_films') {
        const hotFilms = await bookingModel.aggregate([
            { $match: { film: { $exists: true, $ne: null } } },
            { $group: { _id: '$film', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'films', localField: '_id', foreignField: '_id', as: 'film_details' } },
            { $unwind: '$film_details' },
            { $project: { name: '$film_details.name' } },
        ]);
        contextForLLM.database_info = { type: 'hot_film_list', films: hotFilms };
        contextForLLM.notes_for_assistant.push("Người dùng muốn biết danh sách phim hot. Hãy trình bày các phim trong 'database_info.films'.");
    
    } else if (newIntent === 'find_available_rooms') {
        // Kết hợp thông tin mới và ngữ cảnh cũ
        const currentBranchName = session.context.branchName;
        const currentRoomName = extractedInfo.roomName || session.context.roomName;

        if (!currentBranchName) {
            session.context.pendingAction = 'request_branch_for_rooms';
            const branchNames = allBranches.map((b) => b.name).join(', ');
            return `Bạn muốn kiểm tra phòng trống ở chi nhánh nào ạ? Hiện tại PNM-BOX có các chi nhánh: ${branchNames}.`;
        }

        const targetBranch = allBranches.find((b) => normalizeText(b.name) === normalizeText(currentBranchName));
        if (!targetBranch) {
            const branchNames = allBranches.map((b) => b.name).join(', ');
            return `Xin lỗi, PNM-BOX không tìm thấy chi nhánh "${currentBranchName}". Các chi nhánh hiện có là: ${branchNames}.`;
        }
        
        // Xử lý thời gian thông minh
        const nowInVietnam = dayjs().tz(VIETNAM_TIMEZONE);
        const openingTime = dayjs(nowInVietnam).hour(8).minute(0).second(0);
        const closingTime = dayjs(nowInVietnam).hour(23).minute(30).second(0);

        let effectiveDate = session.context.date ? new Date(session.context.date) : nowInVietnam.toDate();
        let effectiveStartTime = session.context.startTime;
        let effectiveEndTime = session.context.endTime;
        let noteForLLM = '';

        const isAskingForToday = !session.context.date || dayjs(effectiveDate).isSame(nowInVietnam, 'day');

        if (isAskingForToday && nowInVietnam.isAfter(closingTime)) {
            effectiveDate = nowInVietnam.add(1, 'day').toDate();
            noteForLLM = `Người dùng nhắn tin sau giờ đóng cửa. Hệ thống đã tự động chuyển sang tìm kiếm phòng cho ngày mai (${dayjs(effectiveDate).format('DD/MM/YYYY')}).`;
        }
        
        if (!effectiveStartTime && !effectiveEndTime) {
            effectiveStartTime = '08:00';
            effectiveEndTime = '23:30';
            if (isAskingForToday && nowInVietnam.isBefore(openingTime) && !noteForLLM) {
                noteForLLM = `Người dùng nhắn tin trước giờ mở cửa. Hệ thống sẽ tìm kiếm cho hôm nay bắt đầu từ lúc ${effectiveStartTime}.`;
            } else if (!noteForLLM) {
                noteForLLM = `Người dùng không nói rõ thời gian, hệ thống tự động tìm kiếm cho cả ngày.`;
            }
        }
        
        session.context.pendingAction = null;
        
        // Phân nhánh logic dựa trên việc có hỏi phòng cụ thể hay không
        if (currentRoomName) {
            const targetRoom = await roomModel.findOne({ name: currentRoomName, branch: targetBranch._id });
            if (!targetRoom) {
                return `Xin lỗi, PNM-BOX không tìm thấy phòng ${currentRoomName} tại chi nhánh ${targetBranch.name} ạ.`;
            }

            const availableSlots = await findAvailableSlotsForRoom({
                roomId: targetRoom._id,
                date: effectiveDate,
            });

            contextForLLM.database_info = {
                type: 'single_room_availability_check',
                query_details: {
                    room: targetRoom.name,
                    branch: targetBranch.name,
                    date: dayjs(effectiveDate).format('DD/MM/YYYY'),
                },
                available_slots: availableSlots.map(slot => `${slot.start_time} - ${slot.end_time}`),
            };

            let availabilityNote = `Người dùng muốn biết các khung giờ còn trống của phòng ${targetRoom.name} ngày ${dayjs(effectiveDate).format('DD/MM/YYYY')}.`;
            if (availableSlots.length > 0) {
                availabilityNote += ` Kết quả: các khung giờ sau còn trống. Hãy liệt kê chi tiết các khung giờ này cho người dùng.`;
            } else {
                availabilityNote += ` Kết quả: phòng này đã được đặt hết hoặc đã qua hết các khung giờ có thể đặt trong ngày. Hãy thông báo cho người dùng và có thể gợi ý họ kiểm tra ngày khác.`;
            }
            contextForLLM.notes_for_assistant.push(availabilityNote);

        } else {
            const availableRooms = await findAvailableRoomsForTimeRange({
                branchId: targetBranch._id,
                date: effectiveDate,
                startTime: effectiveStartTime,
                endTime: effectiveEndTime,
            });

            contextForLLM.database_info = {
                type: 'range_availability_check',
                query_details: {
                    branch: targetBranch.name,
                    date: dayjs(effectiveDate).format('DD/MM/YYYY'),
                    startTime: effectiveStartTime,
                    endTime: effectiveEndTime,
                },
                available_rooms: availableRooms,
            };
            
            contextForLLM.notes_for_assistant.push(noteForLLM);
            let availabilityNote = `Người dùng muốn tìm phòng trống liên tục từ ${effectiveStartTime} đến ${effectiveEndTime} ngày ${dayjs(effectiveDate).format('DD/MM/YYYY')} tại chi nhánh ${targetBranch.name}.`;
            if (availableRooms.length > 0) {
                availabilityNote += ` Kết quả: các phòng sau còn trống. Hãy liệt kê các phòng này cho người dùng.`;
            } else {
                availabilityNote += ` Kết quả: không có phòng nào còn trống liên tục trong khoảng thời gian này. Hãy thông báo cho người dùng.`;
            }
            contextForLLM.notes_for_assistant.push(availabilityNote);
        }
    } else {
        contextForLLM.notes_for_assistant.push('Câu hỏi chung. Trả lời dựa trên thông tin có sẵn.');
        if (!message.trim()) {
            return 'Xin chào! PNM-BOX có thể giúp gì cho bạn?';
        }
    }

    if (Object.keys(contextForLLM.user_context).length === 0) {
        delete contextForLLM.user_context;
    }

    const messagesForGPT = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `Dưới đây là thông tin tôi đã thu thập được và yêu cầu của người dùng. Hãy giúp tôi tạo ra một câu trả lời phù hợp:\n<request_data>\n${JSON.stringify(
                contextForLLM,
                null,
                2
            )}\n</request_data>\n\nHãy trả lời trực tiếp câu hỏi/yêu cầu của người dùng ("${message}") dựa trên những thông tin trên.`,
        },
    ];

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messagesForGPT,
            temperature: 0.2,
        });
        return chatCompletion.choices[0].message.content;
    } catch (err) {
        console.error('Lỗi GPT:', err.response ? err.response.data : err.message);
        return 'Xin lỗi, hệ thống đang gặp một chút trục trặc. Bạn vui lòng thử lại sau ít phút nhé.';
    }
};