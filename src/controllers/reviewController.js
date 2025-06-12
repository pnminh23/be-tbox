import accountModel from '../models/accountModel.js';
import bookingModel from '../models/bookingModel.js';
import reviewModel from '../models/reviewModel.js';

export const createReview = async (req, res) => {
    try {
        const { bookingId, rating, comment, email } = req.body;
        // const accountId = req.user._id; // Lấy từ middleware xác thực JWT

        // 1. Kiểm tra đơn đặt phòng có tồn tại và thuộc về user không
        const booking = await bookingModel.findOne({ _id: bookingId, email }).populate('room');
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Đơn đặt phòng không tồn tại.' });
        }

        // 2. Kiểm tra trạng thái HOÀN THÀNH
        if (booking.status !== 'HOÀN THÀNH') {
            return res
                .status(400)
                .json({ success: false, message: 'Chỉ được đánh giá sau khi hoàn thành đơn đặt phòng.' });
        }

        if (booking.isReviewed) {
            // Kiểm tra trực tiếp từ booking nếu trường này đáng tin cậy
            return res.status(400).json({ success: false, message: 'Đơn đặt phòng này đã được đánh giá.' });
        }

        // 3. Kiểm tra đã đánh giá chưa
        const existingReview = await reviewModel.findOne({ booking: bookingId });
        if (existingReview) {
            return res.status(400).json({ success: false, message: 'Đơn đặt phòng này đã được đánh giá.' });
        }

        // 4. Tạo đánh giá mới
        const newReview = new reviewModel({
            email,
            branch: booking.room.branch,
            booking: booking._id,
            rating,
            comment,
        });

        await newReview.save();
        booking.isReviewed = true;
        await booking.save();

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

export const getReviewByBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        if (!branchId) {
            return res.status(404).json({ success: false, message: 'Vui lòng cung cấp id Branch' });
        }
        const reviews = await reviewModel.find({ branch: branchId });
        if (reviews.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Không có đánh giá nào cho chi nhánh này.',
                data: [],
            });
        }
        const reviewsWithName = await Promise.all(
            reviews.map(async (review) => {
                const account = await accountModel.findOne({ email: review.email }); // hoặc review.userEmail tùy field
                return {
                    ...review.toObject(),
                    name: account ? account.name : 'Không xác định',
                };
            })
        );
        return res.status(200).json({
            success: true,
            message: 'Lấy danh sách đánh giá theo chi nhánh thành công.',
            data: reviewsWithName,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi server.' });
    }
};
