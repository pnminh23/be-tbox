import mongoose from 'mongoose';

const room = new mongoose.Schema(
    {
        branch: { type: mongoose.Schema.Types.ObjectId, ref: 'branches', required: true },
        type: { type: mongoose.Schema.Types.ObjectId, ref: 'roomTypes', required: true },
        name: { type: String, required: true },
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
        image: { type: String, default: '' },
    },
    { timestamps: true }
);

const roomModel = mongoose.models.rooms || mongoose.model('rooms', room);

export default roomModel;
