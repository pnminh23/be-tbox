import dayjs from 'dayjs';
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
        const expiredAt = dayjs().add(5, 'minute').unix();

        console.log('return url: ', returnUrl);
        console.log('cancle url: ', cancelUrl);

        if (!id_booking) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp id_booking' });
        }

        const booking = await bookingModel.findOne({ id_booking });
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        const { room, time_slots, date } = booking;
        if (!room || !time_slots || !date) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin phòng, thời gian hoặc ngày' });
        }

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBooking = await bookingModel.findOne({
            room: room,
            time_slots: { $in: time_slots },
            status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH'] },
            date: { $gte: startOfDay, $lte: endOfDay },
        });

        if (existingBooking && existingBooking.email !== email) {
            return res.status(400).json({ success: false, message: 'Khung giờ này đã có người đặt!' });
        }

        const orderCode = generateOrderCode();
        await bookingModel.findOneAndUpdate({ id_booking }, { orderCode }, { new: true });

        const paymentLink = await payos.createPaymentLink({
            orderCode,
            amount,
            description,
            returnUrl,
            cancelUrl,
            expiredAt,
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

        if (amount === booking.payment_amount) {
            updateData.isPay = 'ĐÃ THANH TOÁN';
            updateData.status = 'THÀNH CÔNG';
            updateData.payment_amount = booking.total_money - amount;
        } else if (amount === booking.total_money / 2) {
            updateData.isPay = 'ĐÃ THANH TOÁN 50%';
            updateData.status = 'THÀNH CÔNG';
            updateData.payment_amount = booking.total_money - amount;
        } else {
            return res.status(400).json({ message: 'Amount does not match any valid payment status' });
        }

        const updatedBooking = await bookingModel.findByIdAndUpdate(booking._id, updateData, { new: true });

        return res.status(200).json({ message: 'Webhook processed successfully', booking: updatedBooking });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
