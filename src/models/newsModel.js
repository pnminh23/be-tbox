import mongoose from 'mongoose';

const NewsSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, unique: true },
        content: { type: String, required: true, unique: true },
        image: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },
    },
    { timestamps: true }
);

const NewsModel = mongoose.models.news || mongoose.model('news', NewsSchema);

export default NewsModel;
