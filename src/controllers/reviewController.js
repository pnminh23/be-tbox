import bookingModel from '../models/bookingModel.js';
import reviewModel from '../models/reviewModel.js';

export const createReview = async (req, res) => {
    try {
        const { bookingId, rating, comment } = req.body;
        const userId = req.user._id; // Lấy từ middleware xác thực JWT

        // 1. Kiểm tra đơn đặt phòng có tồn tại và thuộc về user không
        const booking = await bookingModel.findOne({ _id: bookingId, user: userId }).populate('room');
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Đơn đặt phòng không tồn tại.' });
        }

        // 2. Kiểm tra trạng thái HOÀN THÀNH
        if (booking.status !== 'HOAN_THANH') {
            return res
                .status(400)
                .json({ success: false, message: 'Chỉ được đánh giá sau khi hoàn thành đơn đặt phòng.' });
        }

        // 3. Kiểm tra đã đánh giá chưa
        const existingReview = await reviewModel.findOne({ booking: bookingId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: 'Đơn đặt phòng này đã được đánh giá.' });
        }

        // 4. Tạo đánh giá mới
        const newReview = new reviewModel({
            user: userId,
            room: booking.room._id,
            booking: booking._id,
            rating,
            comment,
        });

        await newReview.save();

        return res.status(201).json({
            success: true,
            message: 'Đánh giá thành công.',
            review: newReview,
        });
    } catch (error) {
        console.error('Error creating review:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};
