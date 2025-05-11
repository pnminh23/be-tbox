import mongoose from 'mongoose';

const roomType = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        base_price_per_minute: { type: Number, required: true },
    },
    { timestamps: true }
);

const roomTypeModel = mongoose.models.roomTypes || mongoose.model('roomTypes', roomType);

export default roomTypeModel;
