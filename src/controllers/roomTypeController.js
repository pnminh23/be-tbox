import roomTypeModel from '../models/roomTypeModel.js';
import { formatString } from '../services/formatString.js';

export const createRoomType = async (req, res) => {
    const { name, base_price_per_minute } = req.body;
    if (!name || !base_price_per_minute)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });
    const formattedName = formatString(name).toUpperCase();
    try {
        const existingRoomType = await roomTypeModel.findOne({ name: formattedName });
        if (existingRoomType) return res.status(400).json({ success: false, message: 'Loại phòng này đã tồn tại' });

        const newRoomType = await roomTypeModel.create({
            name: formattedName,
            base_price_per_minute,
        });
        return res.status(200).json({ success: true, message: 'Thêm loại phòng mới thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllRoomType = async (req, res) => {
    try {
        const roomTypes = await roomTypeModel.find({});

        if (roomTypes.length === 0)
            return res.status(400).json({ success: false, message: 'Không có loại phòng nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: roomTypes,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteRoomType = async (req, res) => {
    try {
        const { _id } = req.params;
        const roomType = await roomTypeModel.findOne({ _id });
        if (!roomType) {
            return res.status(400).json({ success: false, message: 'Cơ sở này không tồn tại' });
        }
        const result = await roomTypeModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa cơ sở thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
