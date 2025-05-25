import timeSlotModel from '../models/timeSlotModel.js';
import { formatString } from '../services/formatString.js';

export const createTimeSlots = async (req, res) => {
    let { start_time, end_time } = req.body;
    if (!start_time || !end_time)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

    try {
        const existingTimeSlots = await timeSlotModel.findOne({ start_time });
        if (existingTimeSlots) return res.status(400).json({ success: false, message: 'Khung giờ này đã tồn tại' });

        start_time = formatString(start_time);
        end_time = formatString(end_time);

        const start = new Date(`1970-01-01T${start_time}:00Z`);
        console.log('start:', start);

        const end = new Date(`1970-01-01T${end_time}:00Z`);
        const duration = (end - start) / (1000 * 60);
        console.log('duration:', duration);

        if (duration <= 0)
            return res.status(400).json({ success: false, message: 'Giờ kết thúc phải sau giờ bắt đầu' });

        await timeSlotModel.create({
            start_time,
            end_time,
            slot_duration: duration,
        });

        return res.status(200).json({ success: true, message: 'Thêm khung giờ mới thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllTimeSlots = async (req, res) => {
    try {
        const timeSlots = await timeSlotModel.find({}).sort({ start_time: 1 });

        if (timeSlots.length === 0)
            return res.status(400).json({ success: false, message: 'Không có khung giờ nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: timeSlots,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
