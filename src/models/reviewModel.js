import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
    {
        email: { type: String, required: true },
        branch: { type: mongoose.Schema.Types.ObjectId, ref: 'branches', required: true },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'booking', required: true, unique: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String },
    },
    { timestamps: true }
);

const reviewModel = mongoose.models.review || mongoose.model('review', reviewSchema);

export default reviewModel;
