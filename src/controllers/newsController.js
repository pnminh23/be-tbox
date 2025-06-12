import newsModel from '../models/newsModel.js';
import { formatString } from '../services/formatString.js';
import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
import { ensureDirectoryExistence } from '../services/ensureDirectoryExistence.js';
// Tạo tin tức mới
export const createNews = async (req, res) => {
    try {
        const { title, content } = req.body;
        let image = '';
        // Kiểm tra dữ liệu đầu vào
        if (!title || !content) {
            return res.status(400).json({ message: 'Tiêu đề và nội dung là bắt buộc.' });
        }

        if (req.file) {
            // Nếu film đã có ảnh cũ → xóa ảnh cũ

            // Quy tắc đặt tên file: 'avatar_email.jpg'
            const timestamp = Date.now();

            const newFilename = `news_${timestamp}${path.extname(req.file.originalname)}`;

            // Lưu thông tin file
            const folder = 'news'; // Ví dụ folder avatar
            const fileInfo = {
                filename: newFilename,
                folder: folder,
                path: path.join('uploads', folder, newFilename), // Lưu đường dẫn đầy đủ
            };

            image = `http://localhost:2911/${fileInfo.path.replace(/\\/g, '/')}`;

            // Di chuyển file vào thư mục và đổi tên
            await fs.rename(req.file.path, fileInfo.path);
        }

        // Tạo bản ghi mới
        const newNews = new newsModel({ title: formatString(title), content: formatString(content), image });
        await newNews.save();

        res.status(201).json({ message: 'Tạo tin tức thành công.', data: newNews });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Tiêu đề hoặc nội dung đã tồn tại.' });
        }
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
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
            if (updatedNews.image) {
                try {
                    // Chuyển đổi URL thành đường dẫn file cục bộ
                    // Cần cẩn thận với cách bạn xây dựng URL và đường dẫn này
                    const oldImagePublicPath = updatedNews.image.replace(/^https?:\/\/[^/]+\//, ''); // Bỏ http://localhost:port/
                    const oldImageLocalPath = path.join('uploads', oldImagePublicPath);
                    try {
                        await fs.access(oldImageLocalPath); // Kiểm tra file tồn tại
                        await fs.unlink(oldImageLocalPath); // Xóa file cũ
                        console.log(`Đã xóa ảnh cũ: ${oldImageLocalPath}`);
                    } catch (accessError) {
                        if (accessError.code === 'ENOENT') {
                            console.log(`Ảnh cũ không tồn tại, không cần xóa: ${oldImageLocalPath}`);
                        } else {
                            throw accessError; // Ném lỗi khác nếu không phải ENOENT
                        }
                    }
                } catch (deleteError) {
                    console.error('Lỗi khi xóa ảnh cũ:', deleteError);
                    // Quyết định xem có nên dừng lại ở đây hay tiếp tục lưu ảnh mới
                    // return res.status(500).json({ message: 'Lỗi khi xóa ảnh cũ.', error: deleteError.message });
                }
            }

            // 2. Tạo tên file mới và đường dẫn mới cho ảnh
            const timestamp = Date.now();
            const newFilename = `news_${timestamp}${path.extname(req.file.originalname)}`;
            const folder = 'uploads/news'; // Thư mục lưu trữ ảnh tin tức
            const newImageLocalPath = path.join(folder, newFilename);
            await ensureDirectoryExistence(newImageLocalPath);
            await fs.rename(req.file.path, newImageLocalPath);
            console.log(`Đã lưu ảnh mới tại: ${newImageLocalPath}`);
            updatedNews.image = `http://localhost:2911/${folder.replace(/\\/g, '/')}/${newFilename}`;
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
        if (!deletedNews) return res.status(404).json({ message: 'Không tìm thấy tin tức để xoá.' });

        res.status(200).json({ message: 'Xoá tin tức thành công.', data: deletedNews });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};
