import { formatString } from '../services/formatString.js';
import roomModel from '../models/roomModel.js';
import { cloudinary } from '../config/cloudinary.js';

export const createRoom = async (req, res) => {
    const { branch, type, name, status } = req.body;
    if (!name || !branch || !type)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Thiếu ảnh' });
    }
    const existingRoom = await roomModel.findOne({ branch, name });
    if (existingRoom) return res.status(400).json({ success: false, message: 'Phòng  này đã tồn tại' });
    try {
        const imageUrl = req.file.path;
        const publicId = req.file.filename;

        const newRoom = await roomModel.create({
            branch,
            type,
            name: formatString(name).toUpperCase(),
            image: imageUrl,
            imagePublicId: publicId,
            status,
        });
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
            if (room.imagePublicId) {
                await cloudinary.uploader.destroy(room.imagePublicId);
            }
            room.image = req.file.path;
            room.imagePublicId = req.file.filename;
        }
        await room.save();

        res.status(200).json({ message: 'Cập nhật phòng thành công.', data: room });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server.', error: error.message });
    }
};

export const getRoom = async (req, res) => {
    try {
        const { branch, type } = req.params;
        if (!branch || !type) return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

        const rooms = await roomModel.find({ branch, type }).populate('type');

        if (rooms.length === 0)
            return res.status(400).json({
                success: false,
                message: 'Không có phòng nào trong cơ sở dữ liệu',
            });

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
            return res.status(400).json({
                success: false,
                message: 'Không có phòng nào trong cơ sở dữ liệu',
            });

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
            return res.status(400).json({ success: false, message: 'phòng này không tồn tại' });
        }

        if (room.imagePublicId) {
            await cloudinary.uploader.destroy(room.imagePublicId);
        }

        const result = await roomModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa phòng thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
