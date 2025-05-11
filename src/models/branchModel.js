import mongoose from 'mongoose';

const branch = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        address: { type: String, required: true, unique: true },
        phone: { type: String, required: true },
        typeRoom: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'roomTypes',
                required: true,
            },
        ],
    },
    { timestamps: true }
);

const branchModel = mongoose.models.branches || mongoose.model('branches', branch);

export default branchModel;
