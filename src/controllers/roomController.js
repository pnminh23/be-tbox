import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
import { formatString } from '../services/formatString.js';
import roomModel from '../models/roomModel.js';
import { ensureDirectoryExistence } from '../services/ensureDirectoryExistence.js';

export const createRoom = async (req, res) => {
    try {
        const { branch, type, name, status } = req.body;
        let image = '';
        if (!name || !branch || !type)
            return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });
        const existingRoom = await roomModel.findOne({ branch, name });
        if (existingRoom) return res.status(400).json({ success: false, message: 'Phòng  này đã tồn tại' });

        if (req.file) {
            // Nếu film đã có ảnh cũ → xóa ảnh cũ

            // Quy tắc đặt tên file: 'avatar_email.jpg'
            const timestamp = Date.now();

            const newFilename = `room_${timestamp}${path.extname(req.file.originalname)}`;

            // Lưu thông tin file
            const folder = 'rooms'; // Ví dụ folder avatar
            const fileInfo = {
                filename: newFilename,
                folder: folder,
                path: path.join('uploads', folder, newFilename), // Lưu đường dẫn đầy đủ
            };

            image = `http://localhost:2911/${fileInfo.path.replace(/\\/g, '/')}`;

            // Di chuyển file vào thư mục và đổi tên
            await fs.rename(req.file.path, fileInfo.path);
        }

        const newRoom = await roomModel.create({
            branch,
            type,
            name: formatString(name).toUpperCase(),
            image,
            status,
        });
        await newRoom.save();
        return res.status(200).json({ success: true, message: 'Thêm phòng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editRoom = async (req, res) => {
    const { _id } = req.params;
    try {
        const { name, image } = req.body;
        const room = await roomModel.findOne({ _id });
        if (!room) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy phòng' });
        }

        if (name !== undefined) room.name = formatString(name);

        if (req.file) {
            // 1. Xóa file ảnh cũ nếu tồn tại
            if (room.image) {
                try {
                    // Chuyển đổi URL thành đường dẫn file cục bộ
                    // Cần cẩn thận với cách bạn xây dựng URL và đường dẫn này
                    const oldImagePublicPath = room.image.replace(/^https?:\/\/[^/]+\//, ''); // Bỏ http://localhost:port/
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
            const newFilename = `rooms_${timestamp}${path.extname(req.file.originalname)}`;
            const folder = 'uploads/rooms'; // Thư mục lưu trữ ảnh tin tức
            const newImageLocalPath = path.join(folder, newFilename);
            await ensureDirectoryExistence(newImageLocalPath);
            await fs.rename(req.file.path, newImageLocalPath);
            console.log(`Đã lưu ảnh mới tại: ${newImageLocalPath}`);
            room.image = `http://localhost:2911/${folder.replace(/\\/g, '/')}/${newFilename}`;
        }
        await room.save();

        res.status(200).json({ message: 'Cập nhật phòng thành công.', data: room });
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

export const getRoom = async (req, res) => {
    try {
        const { branch, type } = req.params;
        if (!branch || !type) return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

        const rooms = await roomModel.find({ branch, type }).populate('type');

        if (rooms.length === 0)
            return res.status(400).json({ success: false, message: 'Không có phòng nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: rooms,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getRoomByBranchId = async (req, res) => {
    try {
        const { branch } = req.params;
        if (!branch) return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

        const rooms = await roomModel.find({ branch }).populate('type').sort({ name: 1 });

        if (rooms.length === 0)
            return res.status(400).json({ success: false, message: 'Không có phòng nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: rooms,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteRoom = async (req, res) => {
    try {
        const { _id } = req.params;
        const room = await roomModel.findOne({ _id });
        if (!room) {
            return res.status(400).json({ success: false, message: 'Cơ sở này không tồn tại' });
        }

        if (room.image) {
            try {
                // Lấy đường dẫn tương đối từ URL
                const imagePath = room.image.replace('http://localhost:2911/', '');
                await fs.unlink(imagePath);
            } catch (err) {
                console.error('Lỗi khi xóa ảnh:', err.message);
            }
        }

        const result = await roomModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa phòng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
