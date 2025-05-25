import mongoose from 'mongoose';

const timeSlots = new mongoose.Schema(
    {
        start_time: { type: String, required: true, unique: true },
        end_time: { type: String, required: true, unique: true },
        slot_duration: { type: Number, required: true },
    },
    { timestamps: true }
);

const timeSlotModel = mongoose.models.timeSlots || mongoose.model('timeSlots', timeSlots);

export default timeSlotModel;
