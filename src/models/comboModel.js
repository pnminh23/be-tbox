import mongoose from 'mongoose';

const combo = new mongoose.Schema(
    {
        name: { type: String, required: true },
        types: [
            {
                typeRoom: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'roomTypes',
                    required: true,
                },
                price: {
                    type: Number,
                    required: true,
                },
            },
        ],
        description: { type: String, required: true },
        duration: { type: Number, required: true },
    },
    { timestamps: true }
);

const comboModel = mongoose.models.combo || mongoose.model('combo', combo);

export default comboModel;
