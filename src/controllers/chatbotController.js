import openai from '../config/openAi.js';
import bookingModel from '../models/bookingModel.js';
import branchModel from '../models/branchModel.js';
import filmModel from '../models/filmModel.js';
import roomModel from '../models/roomModel.js';
import roomTypeModel from '../models/roomTypeModel.js';
import timeSlotModel from '../models/timeSlotModel.js';

// --- Quản lý Session/Ngữ cảnh Hội thoại (Ví dụ đơn giản) ---
const userSessions = {};

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

    if (lowerMessage.includes('hom nay') || lowerMessage.includes('hien tai')) {
        targetDate = new Date(); // Sẽ lấy ngày hiện tại của server
    } else if (lowerMessage.includes('ngay mai')) {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
    } else if (lowerMessage.includes('ngay mot') || lowerMessage.includes('ngay kia')) {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 2);
    } else {
        const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
        const match = lowerMessage.match(dateRegex);
        if (match) {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]) - 1;
            let yearString = match[3];
            let year = yearString ? parseInt(yearString) : new Date().getFullYear();
            if (yearString && yearString.length === 2) {
                const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
                year = currentCentury + parseInt(yearString);
            }
            targetDate = new Date(year, month, day);
            if (targetDate.getDate() !== day || targetDate.getMonth() !== month || targetDate.getFullYear() !== year) {
                return null;
            }
        }
    }
    if (targetDate) {
        targetDate.setHours(0, 0, 0, 0); // Chuẩn hóa về đầu ngày
    }
    return targetDate;
};

async function extractEntities(message, availableBranches, availableRoomTypes) {
    const normalizedMessage = normalizeText(message);
    let extracted = {
        branchName: null,
        roomTypeName: null,
        roomName: null,
        date: parseDateFromMessage(normalizedMessage), //Sử dụng hàm parseDateFromMessage đã chuẩn hóa
        intent: 'unknown',
    };

    if (normalizedMessage.includes('phim')) {
        extracted.intent = 'get_film_list';
    } else if (
        normalizedMessage.includes('phong') &&
        (normalizedMessage.includes('trong') || normalizedMessage.includes('con'))
    ) {
        extracted.intent = 'find_available_rooms';
    } else if (normalizedMessage.includes('dat phong')) {
        extracted.intent = 'book_room';
    }

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

    let explicitDateInMessage = parseDateFromMessage(normalizeText(message));

    console.log('--- DEBUG START ---');
    console.log(
        `Current Server Time: ${new Date().toString()} (UTC Offset: ${new Date().getTimezoneOffset() / -60} hours)`
    );
    if (explicitDateInMessage) {
        console.log(`Date explicitly parsed from user message: ${explicitDateInMessage.toString()}`);
    }
    console.log('Original Message from User:', message);

    const extractedInfo = await extractEntities(message, allBranches, allRoomTypes);
    console.log(
        'Extracted Entities (branch, roomType, roomName, date, intent):',
        JSON.stringify(extractedInfo, null, 2)
    );

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
    if (extractedInfo.date) {
        session.context.date = extractedInfo.date.toISOString().split('T')[0];
    }

    const currentBranchName = session.context.branchName;
    const currentRoomTypeName = session.context.roomTypeName;
    const currentRoomName = session.context.roomName;
    let currentDate = session.context.date ? new Date(session.context.date) : null;
    if (currentDate) {
        currentDate.setHours(0, 0, 0, 0);
    }

    console.log('Session Context (after entity update):', JSON.stringify(session.context, null, 2));
    console.log('Resolved Branch Name for Query:', currentBranchName);
    console.log('Resolved RoomType Name for Query:', currentRoomTypeName);
    console.log('Resolved Room Name for Query:', currentRoomName);
    console.log(
        'Resolved Date for Query (YYYY-MM-DD):',
        currentDate ? currentDate.toISOString().split('T')[0] : 'Not specified / Not resolved'
    );
    console.log('--- DEBUG ENTITY AND DATE RESOLUTION END ---');

    if (extractedInfo.intent === 'get_film_list') {
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

        console.log('DEBUG: Room Query to MongoDB:', JSON.stringify(roomQuery, null, 2));
        const roomsInDb = await roomModel.find(roomQuery).sort({ name: 1 });
        console.log(
            'DEBUG: Rooms Found in DB (name & id):',
            JSON.stringify(
                roomsInDb.map((r) => ({ _id: r._id.toString(), name: r.name })),
                null,
                2
            )
        );

        if (roomsInDb.length === 0) {
            let messageNotFound = `Xin lỗi, PNM-BOX không tìm thấy phòng nào khớp với yêu cầu của bạn (Chi nhánh: ${targetBranch.name}`;
            if (targetRoomType) messageNotFound += `, Loại phòng: ${targetRoomType.name}`;
            if (currentRoomName) messageNotFound += `, Tên phòng: ${currentRoomName}`;
            messageNotFound += ` vào ngày ${currentDate.toLocaleDateString(
                'vi-VN'
            )}). Bạn vui lòng kiểm tra lại thông tin hoặc thử tìm kiếm khác nhé.`;
            contextForLLM.database_info = {
                type: 'availability_check_no_rooms_found',
                query_details: {
                    branch: targetBranch.name,
                    room_type: targetRoomType?.name,
                    room_name: currentRoomName,
                    date: currentDate.toLocaleDateString('vi-VN'),
                },
                message: messageNotFound,
            };
            contextForLLM.notes_for_assistant.push(
                "Không tìm thấy phòng nào khớp với các tiêu chí đã cung cấp. Thông báo cho người dùng theo 'message'."
            );
        } else {
            const allTimeSlots = await timeSlotModel.find({}).sort({ start_time: 1 });
            console.log(
                'DEBUG: All Time Slots defined in system (total:',
                allTimeSlots.length,
                '): ',
                JSON.stringify(
                    allTimeSlots.map((s) => ({
                        _id: s._id.toString(),
                        start_time: s.start_time,
                        end_time: s.end_time,
                    })),
                    null,
                    2
                )
            );

            if (allTimeSlots.length === 0) {
                contextForLLM.database_info = {
                    type: 'availability_check_no_slots_defined',
                    query_details: {
                        branch: targetBranch.name,
                        room_type: targetRoomType?.name,
                        room_name: currentRoomName,
                        date: currentDate.toLocaleDateString('vi-VN'),
                    },
                    message: `Xin lỗi, hiện tại hệ thống chưa có thông tin về các khung giờ hoạt động cho ngày ${currentDate.toLocaleDateString(
                        'vi-VN'
                    )} tại chi nhánh ${targetBranch.name}. Chúng tôi sẽ sớm cập nhật.`,
                };
                contextForLLM.notes_for_assistant.push(
                    "Hệ thống chưa định nghĩa các khung giờ chuẩn (allTimeSlots rỗng). Hãy thông báo cho người dùng theo 'message'."
                );
            } else {
                const roomIds = roomsInDb.map((r) => r._id);
                const startOfDay = new Date(currentDate);
                const endOfDay = new Date(currentDate);
                endOfDay.setDate(endOfDay.getDate() + 1);

                console.log(
                    `DEBUG: Querying bookings for room IDs: [${roomIds.join(
                        ', '
                    )}] between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`
                );
                const bookingsOnDate = await bookingModel
                    .find({
                        room: { $in: roomIds },
                        date: { $gte: startOfDay, $lt: endOfDay },
                        status: { $nin: ['cancelled', 'expired'] },
                    })
                    .populate('time_slots');

                console.log(
                    `DEBUG: Found ${bookingsOnDate.length} bookings on date ${currentDate.toLocaleDateString(
                        'vi-VN'
                    )}. Details:`
                );
                bookingsOnDate.forEach((b, index) => {
                    console.log(`  Booking #${index + 1}:`);
                    console.log(`    _id: ${b._id.toString()}`);
                    console.log(`    Room ID: ${b.room.toString()}`);
                    console.log(`    Date: ${new Date(b.date).toLocaleDateString('vi-VN')}`);
                    console.log(`    Status: ${b.status}`);
                    console.log(
                        `    Populated Time Slots (_id, start, end):`,
                        JSON.stringify(
                            b.time_slots.map((ts) => ({
                                _id: ts._id.toString(),
                                start_time: ts.start_time,
                                end_time: ts.end_time,
                            })),
                            null,
                            2
                        )
                    );
                });

                const bookedSlotMapByRoom = {};
                bookingsOnDate.forEach((booking) => {
                    const roomIdStr = booking.room.toString();
                    if (!bookedSlotMapByRoom[roomIdStr]) bookedSlotMapByRoom[roomIdStr] = new Set();
                    booking.time_slots.forEach((populatedBookedSlot) => {
                        bookedSlotMapByRoom[roomIdStr].add(populatedBookedSlot._id.toString());
                    });
                });
                console.log('DEBUG: bookedSlotMapByRoom (RoomID -> Set of booked TimeSlot IDs):');
                for (const roomIdKey in bookedSlotMapByRoom) {
                    console.log(`  Room ID ${roomIdKey}: [${Array.from(bookedSlotMapByRoom[roomIdKey]).join(', ')}]`);
                }

                const availabilityResults = [];
                for (const room of roomsInDb) {
                    const currentRoomIdStr = room._id.toString();
                    const bookedSlotsForThisRoom = bookedSlotMapByRoom[currentRoomIdStr] || new Set();
                    console.log(
                        `DEBUG: For room ${room.name} (ID: ${currentRoomIdStr}), checking against ${
                            bookedSlotsForThisRoom.size
                        } booked slot IDs: [${Array.from(bookedSlotsForThisRoom).join(', ')}]`
                    );

                    const availableSlotsForThisRoom = allTimeSlots
                        .filter((masterSlot) => {
                            const isBooked = bookedSlotsForThisRoom.has(masterSlot._id.toString());
                            return !isBooked;
                        })
                        .map((s) => `${s.start_time} - ${s.end_time}`);

                    availabilityResults.push({
                        room_name: room.name,
                        available_slots: availableSlotsForThisRoom,
                        is_fully_booked: availableSlotsForThisRoom.length === 0 && allTimeSlots.length > 0,
                    });
                }

                contextForLLM.database_info = {
                    type: 'availability_check_results',
                    query_details: {
                        branch: targetBranch.name,
                        room_type: targetRoomType?.name,
                        room_name: currentRoomName,
                        date: currentDate.toLocaleDateString('vi-VN'),
                    },
                    rooms_availability: availabilityResults,
                };
                // ***** ĐOẠN ĐÃ CẬP NHẬT *****
                let availabilityNote = `Người dùng muốn tìm phòng trống.
                Chi nhánh: ${targetBranch.name}.
                ${targetRoomType ? `Loại phòng: ${targetRoomType.name}.` : ''}
                ${currentRoomName ? `Tên phòng: ${currentRoomName}.` : ''}
                Ngày: ${currentDate.toLocaleDateString('vi-VN')}.
                Dựa vào 'rooms_availability', hãy thông báo các phòng còn trống và khung giờ.
                - Nếu một phòng trong 'rooms_availability' có mảng 'available_slots' KHÔNG RỖNG, hãy liệt kê các khung giờ đó một cách rõ ràng.
                - Nếu một phòng có 'available_slots' RỖNG và 'is_fully_booked' là TRUE, nghĩa là phòng đó đã được đặt hết khung giờ trong ngày.
                - Nếu 'rooms_availability' rỗng hoặc không có thông tin cho phòng cụ thể được hỏi (ví dụ, không tìm thấy phòng đó trong kết quả), hãy thông báo là không tìm thấy thông tin phòng/khung giờ cho yêu cầu đó.`;
                contextForLLM.notes_for_assistant.push(availabilityNote);
                // ***** KẾT THÚC ĐOẠN ĐÃ CẬP NHẬT *****
            }
        }
    } else {
        contextForLLM.notes_for_assistant.push(
            'Đây là một câu hỏi chung hoặc ý định chưa được xác định rõ. Hãy cố gắng trả lời dựa trên thông tin có sẵn hoặc hỏi thêm nếu cần.'
        );
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
            content: `Dưới đây là thông tin tôi đã thu thập được và yêu cầu của người dùng. Hãy giúp tôi tạo ra một câu trả lời phù hợp:
<request_data>
${JSON.stringify(contextForLLM, null, 2)}
</request_data>

Hãy trả lời trực tiếp câu hỏi/yêu cầu của người dùng ("${message}") dựa trên những thông tin trên.
Nếu 'database_info.type' là 'availability_check_no_rooms_found' hoặc 'availability_check_no_slots_defined', hãy sử dụng thông điệp trong 'database_info.message' làm cơ sở chính để trả lời.
Ưu tiên thông tin trong 'database_info' nếu có.
Sử dụng 'notes_for_assistant' để hiểu rõ hơn về bối cảnh và cách trình bày thông tin.
Nếu trong 'user_context' có thông tin người dùng đã cung cấp trước đó (như chi nhánh, loại phòng, ngày), hãy sử dụng chúng nếu câu hỏi hiện tại không cung cấp lại.
`,
        },
    ];

    console.log('--- DEBUG GPT ---');
    console.log('Messages for GPT:', JSON.stringify(messagesForGPT, null, 2));
    console.log('Current Session Context (After logic):', JSON.stringify(session.context, null, 2));
    console.log('--- DEBUG GPT END ---');

    try {
        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messagesForGPT,
            temperature: 0.1, // ***** ĐÃ CẬP NHẬT TEMPERATURE *****
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
