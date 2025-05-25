import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import bookingModel from '../models/bookingModel.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const generateBookingId = async (bookingDate) => {
    // 1. Format ngày đặt thành dạng DDMM
    const dateStr = dayjs(bookingDate).format('DDMM');

    // 2. Tính thời gian bắt đầu và kết thúc trong ngày (giờ VN)
    const start = dayjs(bookingDate).startOf('day').toDate();
    const end = dayjs(bookingDate).endOf('day').toDate();

    // 3. Đếm số lượng booking đã đặt trong ngày đó
    const count = await bookingModel.countDocuments({
        date: { $gte: start, $lte: end },
    });

    // 4. Kiểm tra nếu vượt quá 99 lượt
    if (count >= 100) {
        throw new Error('Đã vượt quá số lượt đặt tối đa trong ngày');
    }

    // 5. Format thứ tự từ 00 đến 99
    const sequence = String(count).padStart(2, '0');

    // 6. Ghép và chuyển sang số
    return Number(`${dateStr}${sequence}`); // Ví dụ: 230500
};
