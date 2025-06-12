import openai from '../config/openAi.js';
import bookingModel from '../models/bookingModel.js';
import branchModel from '../models/branchModel.js';
import filmModel from '../models/filmModel.js';
import roomModel from '../models/roomModel.js';
import roomTypeModel from '../models/roomTypeModel.js';
import timeSlotModel from '../models/timeSlotModel.js';
import mongoose from 'mongoose';

// ===== THAY THẾ: Sử dụng Day.js thay cho date-fns-tz =====
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';

// Cấu hình dayjs với các plugin cần thiết
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
// ========================================================

// --- Quản lý Session/Ngữ cảnh Hội thoại ---
const userSessions = {};

// --- Hằng số múi giờ ---
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

// --- Hàm Helper ---
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
            // Định dạng chuỗi để dayjs có thể phân tích chính xác
            const dateString = `${year}-${month}-${day}`;
            targetDate = dayjs.tz(dateString, 'YYYY-M-D', VIETNAM_TIMEZONE);
        }
    }

    // Trả về đối tượng Date chuẩn của JS sau khi đã chuẩn hóa về đầu ngày
    return targetDate ? targetDate.startOf('day').toDate() : null;
};

// Hàm extractEntities không cần thay đổi, chỉ cần đảm bảo nó gọi parseDateFromMessage
async function extractEntities(message, availableBranches, availableRoomTypes) {
    const normalizedMessage = normalizeText(message);
    let extracted = {
        branchName: null,
        roomTypeName: null,
        roomName: null,
        date: parseDateFromMessage(message),
        intent: 'unknown',
    };
    // ... toàn bộ logic còn lại của hàm extractEntities giữ nguyên ...
    if (normalizedMessage.includes('phim hot') || normalizedMessage.includes('phim nao hay')) {
        extracted.intent = 'get_hot_films';
    } else if (normalizedMessage.includes('phim')) {
        extracted.intent = 'get_film_list';
    } else if (
        normalizedMessage.includes('phong') &&
        (normalizedMessage.includes('trong') || normalizedMessage.includes('con'))
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

    // --- Trích xuất thực thể (Entities) ---
    for (const branch of availableBranches) {
        const branchNameRegex = new RegExp(
            `\\b${normalizeText(branch.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i'
        );
        if (branchNameRegex.test(normalizedMessage)) {
            extracted.branchName = branch.name;
            break;
        }
    }
    if (!extracted.branchName) {
        const branchKeywords = ['chi nhanh', 'co so'];
        for (const keyword of branchKeywords) {
            const regex = new RegExp(`${keyword}\\s+([^,.;!?]+?)(?=\\s+loai phong|\\s+phong|\\s+ngay|\\s+luc|$)`, 'i');
            const match = message.match(regex);
            if (match && match[1]) {
                const potentialBranchName = match[1].trim();
                const foundBranch = availableBranches.find(
                    (b) => normalizeText(b.name) === normalizeText(potentialBranchName)
                );
                if (foundBranch) {
                    extracted.branchName = foundBranch.name;
                    break;
                }
            }
        }
    }

    for (const roomType of availableRoomTypes) {
        const roomTypeRegex = new RegExp(
            `\\b${normalizeText(roomType.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i'
        );
        if (roomTypeRegex.test(normalizedMessage)) {
            extracted.roomTypeName = roomType.name;
            break;
        }
    }
    if (!extracted.roomTypeName) {
        const roomTypeKeywords = ['loai phong'];
        for (const keyword of roomTypeKeywords) {
            const regex = new RegExp(
                `${keyword}\\s+([^,.;!?]+?)(?=\\s+o|\\s+tai|\\s+co so|\\s+chi nhanh|\\s+phong|\\s+ngay|\\s+luc|$)`,
                'i'
            );
            const match = message.match(regex);
            if (match && match[1]) {
                const potentialRoomTypeName = match[1].trim();
                const foundRoomType = availableRoomTypes.find(
                    (rt) => normalizeText(rt.name) === normalizeText(potentialRoomTypeName)
                );
                if (foundRoomType) {
                    extracted.roomTypeName = foundRoomType.name;
                    break;
                }
            }
        }
    }

    const roomNameRegex =
        /(?:phong|phòng)\s+([a-zA-Z0-9À-Ỷà-ỹ\s\-\_]+?)(?=\s+o|\s+tai|\s+co so|\s+chi nhanh|\s+loai phong|,|$)/i;
    const roomNameMatch = normalizedMessage.match(roomNameRegex);
    if (roomNameMatch && roomNameMatch[1]) {
        let potentialRoomNameFull = roomNameMatch[1].trim();
        if (extracted.roomTypeName) {
            const normPotentialRoomNameFull = normalizeText(potentialRoomNameFull);
            const normExtractedRoomType = normalizeText(extracted.roomTypeName);
            if (normPotentialRoomNameFull.includes(normExtractedRoomType)) {
                let identifier = potentialRoomNameFull
                    .replace(new RegExp(extracted.roomTypeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
                    .trim();
                if (identifier.length > 0) {
                    const isIdentifierARoomType = availableRoomTypes.some(
                        (rt) => normalizeText(rt.name) === normalizeText(identifier)
                    );
                    if (!isIdentifierARoomType) {
                        extracted.roomName = identifier;
                    }
                }
            } else {
                const isPotentialNameARoomType = availableRoomTypes.some(
                    (rt) => normalizeText(rt.name) === normalizeText(potentialRoomNameFull)
                );
                if (!isPotentialNameARoomType) {
                    extracted.roomName = potentialRoomNameFull;
                }
            }
        } else {
            const isPotentialNameARoomType = availableRoomTypes.some(
                (rt) => normalizeText(rt.name) === normalizeText(potentialRoomNameFull)
            );
            if (!isPotentialNameARoomType) {
                extracted.roomName = potentialRoomNameFull;
            }
        }
    }
    return extracted;
}

export const handleChat = async (message, userId = 'defaultUser') => {
    // ... Logic session, prompt... (Không thay đổi)
    if (!userSessions[userId]) {
        userSessions[userId] = { context: {} };
    }
    const session = userSessions[userId];

    let systemPrompt = `Bạn là trợ lý ảo của PNM-BOX, một hệ thống cafe phim.
Hãy luôn trả lời một cách lịch sự, thân thiện, rõ ràng và hữu ích.
Khi cung cấp danh sách (phim, phòng, khung giờ), hãy trình bày mỗi mục trên một dòng để dễ đọc.
Nếu người dùng hỏi thông tin mà bạn không có hoặc không chắc chắn, hãy thông báo một cách trung thực và đề nghị hỗ trợ thêm.
Nếu thiếu thông tin để xử lý yêu cầu (ví dụ: tìm phòng trống mà thiếu ngày hoặc chi nhánh), hãy lịch sự hỏi lại người dùng để bổ sung.
Phân tích kỹ thông tin hỗ trợ được cung cấp để đưa ra câu trả lời chính xác.`;

    let contextForLLM = {
        query: message,
        user_context: { ...session.context },
        database_info: null,
        notes_for_assistant: [],
    };

    const allBranches = await branchModel.find({});
    const allRoomTypes = await roomTypeModel.find({});

    const extractedInfo = await extractEntities(message, allBranches, allRoomTypes);

    if (extractedInfo.date) {
        session.context.date = extractedInfo.date.toISOString();
    }
    if (extractedInfo.branchName) session.context.branchName = extractedInfo.branchName;
    if (extractedInfo.roomTypeName) session.context.roomTypeName = extractedInfo.roomTypeName;
    if (extractedInfo.roomName !== null) {
        session.context.roomName = extractedInfo.roomName;
    } else if (
        message.toLowerCase().includes('loại phòng nào cũng được') ||
        message.toLowerCase().includes('phòng nào cũng được')
    ) {
        delete session.context.roomName;
    }

    const currentBranchName = session.context.branchName;
    const currentRoomTypeName = session.context.roomTypeName;
    const currentRoomName = session.context.roomName;
    let currentDate = session.context.date ? new Date(session.context.date) : null;

    // ... Toàn bộ logic xử lý các intent khác giữ nguyên ...
    if (extractedInfo.intent === 'get_booking_instructions') {
        return `Để đặt phòng tại PNM-BOX, bạn chỉ cần làm theo các bước đơn giản sau ạ:
1.  **Chọn phim:** Lựa chọn bộ phim bạn muốn thưởng thức từ danh sách phim của chúng tôi.
2.  **Chọn cơ sở:** Chọn chi nhánh PNM-BOX gần bạn nhất.
3.  **Chọn ngày:** Chọn ngày bạn muốn xem phim (mặc định sẽ là ngày hôm nay).
4.  **Chọn phòng:** Chọn loại phòng và phòng cụ thể bạn thích.
5.  **Chọn Combo:** Thêm các combo đồ ăn, nước uống để trải nghiệm thêm trọn vẹn.
6.  **Hoàn tất đặt phòng:** Xác nhận thông tin và hoàn tất việc đặt phòng.
Chúc bạn có những giây phút xem phim vui vẻ tại PNM-BOX!`;
    }

    if (extractedInfo.intent === 'get_hot_films') {
        const hotFilms = await bookingModel.aggregate([
            { $match: { film: { $exists: true, $ne: null } } },
            { $group: { _id: '$film', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'films', localField: '_id', foreignField: '_id', as: 'film_details' } },
            { $unwind: '$film_details' },
            { $project: { name: '$film_details.name', description: '$film_details.description', count: '$count' } },
        ]);

        if (hotFilms.length > 0) {
            contextForLLM.database_info = { type: 'hot_film_list', films: hotFilms };
            contextForLLM.notes_for_assistant.push(
                "Người dùng muốn biết danh sách phim hot. Hãy trình bày các phim trong 'database_info.films' và nói rằng đây là những phim được đặt nhiều nhất."
            );
        } else {
            contextForLLM.database_info = { type: 'hot_film_list', films: [] };
            contextForLLM.notes_for_assistant.push(
                'Hiện chưa có đủ dữ liệu để xếp hạng phim hot. Hãy giới thiệu người dùng xem danh sách phim chung.'
            );
        }
    } else if (extractedInfo.intent === 'recommend_branch') {
        const result = await bookingModel.aggregate([
            { $lookup: { from: 'rooms', localField: 'room', foreignField: '_id', as: 'room_info' } },
            { $unwind: '$room_info' },
            { $lookup: { from: 'branches', localField: 'room_info.branch', foreignField: '_id', as: 'branch_info' } },
            { $unwind: '$branch_info' },
            { $group: { _id: '$branch_info._id', name: { $first: '$branch_info.name' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
        ]);
        if (result.length > 0) {
            const recommendedBranch = result[0];
            contextForLLM.database_info = { type: 'branch_recommendation', branch: recommendedBranch };
            contextForLLM.notes_for_assistant.push(
                `Người dùng muốn gợi ý chi nhánh. Chi nhánh được yêu thích nhất là '${recommendedBranch.name}'. Hãy giới thiệu chi nhánh này.`
            );
        } else {
            contextForLLM.notes_for_assistant.push(
                'Chưa có đủ dữ liệu để gợi ý chi nhánh. Hãy nói người dùng có thể tham khảo danh sách chi nhánh của hệ thống.'
            );
        }
    } else if (extractedInfo.intent === 'recommend_room_type') {
        const result = await bookingModel.aggregate([
            { $lookup: { from: 'rooms', localField: 'room', foreignField: '_id', as: 'room_info' } },
            { $unwind: '$room_info' },
            { $lookup: { from: 'roomtypes', localField: 'room_info.type', foreignField: '_id', as: 'room_type_info' } },
            { $unwind: '$room_type_info' },
            { $group: { _id: '$room_type_info._id', name: { $first: '$room_type_info.name' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 },
        ]);
        if (result.length > 0) {
            const recommendedRoomType = result[0];
            contextForLLM.database_info = { type: 'room_type_recommendation', room_type: recommendedRoomType };
            contextForLLM.notes_for_assistant.push(
                `Người dùng muốn gợi ý loại phòng. Loại phòng được yêu thích nhất là '${recommendedRoomType.name}'. Hãy giới thiệu loại phòng này.`
            );
        } else {
            contextForLLM.notes_for_assistant.push(
                'Chưa có đủ dữ liệu để gợi ý loại phòng. Hãy nói người dùng có thể tham khảo danh sách các loại phòng của hệ thống.'
            );
        }
    } else if (extractedInfo.intent === 'get_film_list') {
        const movies = await filmModel.find({}).sort({ release_date: -1 });
        if (movies.length > 0) {
            contextForLLM.database_info = {
                type: 'film_list',
                films: movies.map((m) => ({ name: m.name, description: m.description, release_date: m.release_date })),
            };
            contextForLLM.notes_for_assistant.push(
                "Người dùng muốn biết danh sách phim. Hãy trình bày các phim có trong 'database_info.films'."
            );
        } else {
            contextForLLM.database_info = { type: 'film_list', films: [] };
            contextForLLM.notes_for_assistant.push(
                'Hiện tại không có thông tin phim. Hãy thông báo cho người dùng biết.'
            );
        }
    } else if (extractedInfo.intent === 'find_available_rooms') {
        // ... Logic kiểm tra thiếu thông tin (không đổi) ...
        if (!currentBranchName) {
            session.context.pendingAction = 'request_branch_for_rooms';
            const branchNames = allBranches.map((b) => b.name).join(', ');
            return `Bạn muốn kiểm tra phòng trống ở chi nhánh nào ạ? Hiện tại PNM-BOX có các chi nhánh: ${branchNames}.`;
        }
        if (!currentDate) {
            session.context.pendingAction = 'request_date_for_rooms';
            return `Bạn muốn kiểm tra phòng trống cho ngày nào ạ (ví dụ: hôm nay, ngày mai, hoặc ${new Date().toLocaleDateString(
                'vi-VN'
            )})?`;
        }
        if (!currentRoomTypeName && !currentRoomName) {
            session.context.pendingAction = 'request_room_type_or_name';
            const roomTypeNames = allRoomTypes.map((rt) => rt.name).join(', ');
            return `Bạn muốn xem loại phòng nào (ví dụ: ${roomTypeNames}) hoặc tên phòng cụ thể nào tại chi nhánh ${currentBranchName} ạ?`;
        }
        session.context.pendingAction = null;

        const targetBranch = allBranches.find((b) => normalizeText(b.name) === normalizeText(currentBranchName || ''));

        if (!targetBranch) {
            const branchNames = allBranches.map((b) => b.name).join(', ');
            return `Xin lỗi, PNM-BOX không tìm thấy chi nhánh "${currentBranchName}". Các chi nhánh hiện có là: ${branchNames}.`;
        }

        let targetRoomType = null;
        if (currentRoomTypeName) {
            targetRoomType = allRoomTypes.find((rt) => normalizeText(rt.name) === normalizeText(currentRoomTypeName));
            if (!targetRoomType) {
                const roomTypeNames = allRoomTypes.map((rt) => rt.name).join(', ');
                return `Xin lỗi, PNM-BOX không có loại phòng "${currentRoomTypeName}" tại chi nhánh ${targetBranch.name}. Các loại phòng có là: ${roomTypeNames}.`;
            }
        }

        const roomQuery = { branch: targetBranch._id };
        if (targetRoomType) roomQuery.type = targetRoomType._id;
        if (currentRoomName) {
            delete roomQuery.type;
            roomQuery.name = new RegExp(`^${currentRoomName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        } else if (!targetRoomType) {
            const roomTypeNames = allRoomTypes.map((rt) => rt.name).join(', ');
            return `Bạn vui lòng cho biết bạn muốn tìm loại phòng nào (ví dụ: ${roomTypeNames}) hoặc tên phòng cụ thể tại chi nhánh ${targetBranch.name} ạ?`;
        }

        const roomsInDb = await roomModel.find(roomQuery).sort({ name: 1 });
        const dateFormatted = dayjs(currentDate).tz(VIETNAM_TIMEZONE).format('DD/MM/YYYY');

        if (roomsInDb.length === 0) {
            //...
        } else {
            const allTimeSlots = await timeSlotModel.find({}).sort({ start_time: 1 });
            if (allTimeSlots.length === 0) {
                //...
            } else {
                const startOfDay = dayjs(currentDate).tz(VIETNAM_TIMEZONE).startOf('day').toDate();
                const endOfDay = dayjs(currentDate).tz(VIETNAM_TIMEZONE).endOf('day').toDate();

                const bookingsOnDate = await bookingModel
                    .find({
                        room: { $in: roomsInDb.map((r) => r._id) },
                        date: { $gte: startOfDay, $lte: endOfDay },
                        status: { $nin: ['cancelled', 'expired'] },
                    })
                    .populate('time_slots');

                const bookedSlotMapByRoom = {};
                bookingsOnDate.forEach((booking) => {
                    const roomIdStr = booking.room.toString();
                    if (!bookedSlotMapByRoom[roomIdStr]) bookedSlotMapByRoom[roomIdStr] = new Set();
                    booking.time_slots.forEach((slot) => bookedSlotMapByRoom[roomIdStr].add(slot._id.toString()));
                });

                // ===== PHẦN LOGIC CHÍNH SỬ DỤNG DAY.JS =====
                const nowInVietnam = dayjs().tz(VIETNAM_TIMEZONE);
                const isToday = nowInVietnam.isSame(dayjs(currentDate).tz(VIETNAM_TIMEZONE), 'day');

                console.log(`Is checking for today? ${isToday}`);

                const availabilityResults = [];
                for (const room of roomsInDb) {
                    const bookedSlotsForThisRoom = bookedSlotMapByRoom[room._id.toString()] || new Set();

                    const availableSlotsForThisRoom = allTimeSlots
                        .filter((masterSlot) => {
                            const isBooked = bookedSlotsForThisRoom.has(masterSlot._id.toString());
                            if (isBooked) return false;

                            if (isToday) {
                                // Tạo đối tượng dayjs cho thời gian bắt đầu của slot
                                const slotStartTime = dayjs.tz(
                                    `${nowInVietnam.format('YYYY-MM-DD')} ${masterSlot.start_time}`,
                                    'YYYY-MM-DD HH:mm',
                                    VIETNAM_TIMEZONE
                                );
                                // Chỉ giữ lại slot nếu thời gian hiện tại là TRƯỚC thời gian bắt đầu của slot
                                return nowInVietnam.isBefore(slotStartTime);
                            }

                            return true;
                        })
                        .map((s) => `${s.start_time} - ${s.end_time}`);

                    availabilityResults.push({
                        room_name: room.name,
                        available_slots: availableSlotsForThisRoom,
                    });
                }
                // ===============================================

                contextForLLM.database_info = {
                    type: 'availability_check_results',
                    query_details: {
                        branch: targetBranch.name,
                        room_type: targetRoomType?.name,
                        room_name: currentRoomName,
                        date: dateFormatted,
                        is_today: isToday,
                    },
                    rooms_availability: availabilityResults,
                };

                let availabilityNote = `Người dùng muốn tìm phòng trống.
                Thông tin truy vấn: Chi nhánh ${targetBranch.name}, ngày ${dateFormatted}.
                Dựa vào 'rooms_availability', hãy thông báo các phòng còn trống và khung giờ.
                - Nếu một phòng có 'available_slots' KHÔNG RỖNG, hãy liệt kê các khung giờ đó.
                - Nếu 'is_today' là TRUE, hãy nhấn mạnh rằng đây là các khung giờ còn lại trong ngày.
                - Nếu một phòng có 'available_slots' RỖNG, hãy thông báo phòng đó đã hết khung giờ trống cho ngày này.`;
                contextForLLM.notes_for_assistant.push(availabilityNote);
            }
        }
    } else {
        contextForLLM.notes_for_assistant.push('Câu hỏi chung. Trả lời dựa trên thông tin có sẵn.');
        if (!message.trim()) {
            return 'Xin chào! PNM-BOX có thể giúp gì cho bạn?';
        }
    }

    // ... Logic gọi GPT (không đổi) ...
    if (Object.keys(contextForLLM.user_context).length === 0) {
        delete contextForLLM.user_context;
    }

    const messagesForGPT = [
        { role: 'system', content: systemPrompt },
        {
            role: 'user',
            content: `Dưới đây là thông tin tôi đã thu thập được và yêu cầu của người dùng. Hãy giúp tôi tạo ra một câu trả lời phù hợp:
<request_data>
${JSON.stringify(contextForLLM, null, 2)}
</request_data>

Hãy trả lời trực tiếp câu hỏi/yêu cầu của người dùng ("${message}") dựa trên những thông tin trên.
Ưu tiên thông tin trong 'database_info' nếu có.
Sử dụng 'notes_for_assistant' để hiểu rõ hơn về bối cảnh và cách trình bày thông tin.`,
        },
    ];

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messagesForGPT,
            temperature: 0.2,
        });
        let gptResponse = chatCompletion.choices[0].message.content;
        return gptResponse;
    } catch (err) {
        console.error('Lỗi GPT:', err.response ? err.response.data : err.message);
        if (err.response && err.response.data && err.response.data.error) {
            console.error('Chi tiết lỗi từ OpenAI:', err.response.data.error.message);
        }
        return 'Xin lỗi, hệ thống đang gặp một chút trục trặc. Bạn vui lòng thử lại sau ít phút nhé.';
    }
};
