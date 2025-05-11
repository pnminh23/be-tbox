import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
import { formatString } from '../services/formatString.js';
import roomModel from '../models/roomModel.js';

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
            const namePrefix = name.replace(/[^a-zA-Z0-9]/g, '_');

            const newFilename = `room_${namePrefix}${path.extname(req.file.originalname)}`;

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

export const getRoom = async (req, res) => {
    try {
        const { branch, type } = req.params;
        if (!branch || !type) return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

        const rooms = await roomModel.find({ branch, type });

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

        const rooms = await roomModel.find({ branch });

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

        const result = await roomTypeModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa phòng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
