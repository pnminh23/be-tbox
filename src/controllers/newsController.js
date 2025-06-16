import newsModel from '../models/newsModel.js';
import { formatString } from '../services/formatString.js';
import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
import { ensureDirectoryExistence } from '../services/ensureDirectoryExistence.js';
import { cloudinary } from '../config/cloudinary.js';
// Tạo tin tức mới
export const createNews = async (req, res) => {
    const { title, content } = req.body;
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Thiếu ảnh' });
    }
    if (!title || !content) {
        return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung là bắt buộc.' });
    }
    try {
        // Kiểm tra dữ liệu đầu vào

        const imageUrl = req.file.path;
        const publicId = req.file.filename;

        // Tạo bản ghi mới
        const newNews = await newsModel.create({
            title: formatString(title),
            content: formatString(content),
            image: imageUrl,
            imagePublicId: publicId,
        });

        res.status(201).json({ success: true, message: 'Tạo tin tức thành công.', data: newNews });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Tiêu đề hoặc nội dung đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server.', error: error.message });
    }
};

// Lấy tất cả tin tức
export const getAllNews = async (req, res) => {
    try {
        const newsList = await newsModel.find().sort({ createdAt: -1 }); // mới nhất trước
        res.status(200).json({ message: 'Lấy danh sách tin tức thành công.', data: newsList });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};
export const getNewsById = async (req, res) => {
    try {
        const news = await newsModel.findById(req.params._id);
        if (!news) return res.status(404).json({ message: 'Không tìm thấy tin tức.' });

        res.status(200).json({ message: 'Lấy tin tức thành công.', data: news });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};

export const updateNews = async (req, res) => {
    const { _id } = req.params;
    try {
        const { title, content } = req.body;
        const updatedNews = await newsModel.findOne({ _id });

        if (!updatedNews) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy tin' });
        }

        // Cập nhật title và content nếu có
        if (title !== undefined) updatedNews.title = formatString(title);
        if (content !== undefined) updatedNews.content = formatString(content); // Giả sử content cũng cần formatString

        // Nếu có file ảnh mới được tải lên
        if (req.file) {
            // 1. Xóa file ảnh cũ nếu tồn tại
            if (updatedNews.imagePublicId) {
                await cloudinary.uploader.destroy(updatedNews.imagePublicId);
            }
            updatedNews.image = req.file.path;
            updatedNews.imagePublicId = req.file.filename;
        }

        await updatedNews.save();

        res.status(200).json({ message: 'Cập nhật tin tức thành công.', data: updatedNews });
    } catch (error) {
        console.error('Lỗi server khi cập nhật tin tức:', error);
        // Nếu có req.file và đã xảy ra lỗi sau khi file được tải lên (lưu bởi multer),
        // bạn có thể muốn xóa file tạm đó đi.
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
                console.log(`Đã xóa file tạm sau lỗi: ${req.file.path}`);
            } catch (cleanupError) {
                console.error('Lỗi khi xóa file tạm:', cleanupError);
            }
        }
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};

// Xoá tin tức theo ID
export const deleteNews = async (req, res) => {
    try {
        const deletedNews = await newsModel.findByIdAndDelete(req.params._id);
        if (deletedNews.imagePublicId) {
            await cloudinary.uploader.destroy(deletedNews.imagePublicId);
        }
        if (!deletedNews) return res.status(404).json({ message: 'Không tìm thấy tin tức để xoá.' });

        res.status(200).json({ message: 'Xoá tin tức thành công.', data: deletedNews });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};
