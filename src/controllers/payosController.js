import payos from '../config/payos.js';
import bookingModel from '../models/bookingModel.js';

function generateOrderCode() {
    const randomPart = Math.floor(100 + Math.random() * 900); // 3 số ngẫu nhiên
    const timePart = Date.now() % 1000; // 3 số cuối của timestamp
    return Number(`${randomPart}${String(timePart).padStart(3, '0')}`);
}

export const createOrder = async (req, res) => {
    try {
        const { id_booking, email, amount, description, returnUrl, cancelUrl } = req.body;

        if (!id_booking) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp id_booking' });
        }

        // 1. Lấy thông tin booking
        const booking = await bookingModel.findOne({ id_booking });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        const { room, time_slots, date } = booking;
        if (!room || !time_slots || !date) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin phòng, thời gian hoặc ngày' });
        }

        // 2. Xác định khoảng ngày
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 3. Kiểm tra có booking trùng không
        const existingBooking = await bookingModel.findOne({
            room: room,
            time_slots: { $in: time_slots },
            status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH'] },
            date: { $gte: startOfDay, $lte: endOfDay },
        });

        if (existingBooking && existingBooking.email !== email) {
            return res.status(400).json({ success: false, message: 'Khung giờ này đã có người đặt!' });
        }

        // 4. Tạo orderCode và cập nhật
        const orderCode = generateOrderCode();
        await bookingModel.findOneAndUpdate({ id_booking }, { orderCode }, { new: true });

        // 5. Tạo link thanh toán từ PayOS
        const paymentLink = await payos.createPaymentLink({
            orderCode,
            amount,
            description,
            returnUrl,
            cancelUrl,
        });

        return res.status(200).json(paymentLink);
    } catch (error) {
        console.error('Lỗi tạo order:', error);
        res.status(500).json({ error: error.message });
    }
};

export const handleWebhook = async (req, res) => {
    try {
        const webhookData = req.body;
        console.log(webhookData);

        const isValid = payos.verifyPaymentWebhookData(webhookData);

        if (!isValid) {
            return res.status(400).send('Invalid webhook data');
        }

        const { orderCode, amount } = webhookData.data;

        // Bỏ qua webhook test
        if (orderCode === 123) {
            console.log('Bỏ qua webhook test của PayOS');
            return res.sendStatus(200);
        }

        const booking = await bookingModel.findOne({ orderCode });

        if (!booking) {
            console.log(`Không tìm thấy đơn hàng với orderCode: ${orderCode}`);
            return res.status(404).json({ message: 'Booking not found' });
        }

        let updateData = {};

        if (amount === booking.total_money) {
            updateData.isPay = 'ĐÃ THANH TOÁN';
        } else if (amount === booking.total_money / 2) {
            updateData.isPay = 'ĐÃ THANH TOÁN 50%';
            updateData.status = 'THÀNH CÔNG';
        } else {
            console.log(`Số tiền không khớp với đơn hàng. Amount: ${amount}, Expected: ${booking.total_money}`);
            return res.status(400).json({ message: 'Amount does not match any valid payment status' });
        }

        const updatedBooking = await bookingModel.findByIdAndUpdate(booking._id, updateData, { new: true });

        console.log(`Đã cập nhật đơn ${orderCode} với trạng thái thanh toán: ${updateData.isPay}`);
        return res.status(200).json({ message: 'Webhook processed successfully', booking: updatedBooking });
    } catch (error) {
        console.error('Webhook xử lý lỗi:', error);
        res.status(500).json({ error: error.message });
    }
};
