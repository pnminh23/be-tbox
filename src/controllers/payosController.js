import payos from '../config/payos.js';
import bookingModel from '../models/bookingModel.js';

function generateOrderCode() {
    const randomPart = Math.floor(100 + Math.random() * 900); // 3 số ngẫu nhiên
    const timePart = Date.now() % 1000; // 3 số cuối của timestamp
    return Number(`${randomPart}${String(timePart).padStart(3, '0')}`);
}

export const createOrder = async (req, res) => {
    try {
        const { amount, description, returnUrl, cancelUrl } = req.body;
        const orderCode = generateOrderCode();
        const paymentLink = await payos.createPaymentLink({
            orderCode,
            amount,
            description,
            returnUrl,
            cancelUrl,
        });

        res.status(200).json(paymentLink);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const handleWebhook = async (req, res) => {
    try {
        const webhookData = req.body;
        console.log(webhookData);
        const isValid = payos.verifyPaymentWebhookData(webhookData);

        if (isValid) {
            const { id_booking } = webhookData.data;
            const updateBooking = await bookingModel.findOneAndUpdate(
                { id_booking: id_booking },
                { isPay: 'paid' },
                { new: true }
            );
            if (updateBooking) {
                console.log(`✅ Đã cập nhật đơn ${id_booking} là "paid"`);
            } else {
                console.log(`⚠️ Không tìm thấy đơn hàng với orderCode: ${id_booking}`);
            }
            // Xử lý dữ liệu thanh toán tại đây
        } else {
            res.status(400).send('Invalid webhook data');
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
