import mongoose from 'mongoose';

const filmSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        nameEnglish: { type: String, required: true, unique: true },
        category: { type: [String], default: [] },
        release_date: { type: String, required: true },
        duration: { type: String, required: true },
        image: { type: String, default: '' },
        country: { type: String, default: '' },
    },
    { timestamps: true }
);

const filmModel = mongoose.models.films || mongoose.model('films', filmSchema);

export default filmModel;
