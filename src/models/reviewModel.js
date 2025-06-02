import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'account', required: true },
        room: { type: mongoose.Schema.Types.ObjectId, ref: 'rooms', required: true },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'booking', required: true, unique: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String },
    },
    { timestamps: true }
);

const reviewModel = mongoose.models.review || mongoose.model('review', reviewSchema);

export default reviewModel;
