import mongoose from 'mongoose';

const booking = new mongoose.Schema(
    {
        id_booking: { type: Number, required: true, unique: true },
        name_client: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        film: { type: mongoose.Schema.Types.ObjectId, ref: 'films' },
        combo: { type: mongoose.Schema.Types.ObjectId, ref: 'combo' },
        room: { type: mongoose.Schema.Types.ObjectId, ref: 'rooms', required: true },
        date: { type: Date, required: true, required: true },
        time_slots: [{ type: mongoose.Schema.Types.ObjectId, ref: 'timeSlots', required: true }],
        promotion: { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion' },
        status: { type: String, enum: ['THÀNH CÔNG', 'HOÀN THÀNH', 'HỦY'], default: 'THÀNH CÔNG' },
        isPay: {
            type: String,
            enum: ['CHƯA THANH TOÁN', 'ĐÃ THANH TOÁN 50%', 'ĐÃ THANH TOÁN'],
            default: 'CHƯA THANH TOÁN',
        },
        total_money: { type: Number, required: true },
    },
    { timestamps: true }
);

const bookingModel = mongoose.models.booking || mongoose.model('booking', booking);

export default bookingModel;
