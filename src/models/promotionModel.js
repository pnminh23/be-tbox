import mongoose from 'mongoose';

const promotions = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        discountPercent: { type: Number, required: true, unique: true },
        quanlity: { type: Number, required: true, unique: true },
    },
    { timestamps: true }
);

const promotionModel = mongoose.models.promotions || mongoose.model('promotions', promotions);

export default promotionModel;
