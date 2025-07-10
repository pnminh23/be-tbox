import roomModel from '../models/roomModel.js';
import roomTypeModel from '../models/roomTypeModel.js';
import { formatString } from '../services/formatString.js';

export const createTypeRoom = async (req, res) => {
    const { name, price } = req.body;
    if (!name || !price) {
        return res.status(400).json({ success: false, massage: 'Thiếu tên hoặc giá' });
    }

    try {
        await roomTypeModel.create({
            name: formatString(name),
            base_price_per_minute: price,
        });
        res.status(201).json({ success: true, message: 'Tạo loại phòng thành công.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server.', error: err.message });
    }
};

export const getAllTypeRooms = async (req, res) => {
    try {
        const allTypeRooms = await roomTypeModel.find({});

        if (!allTypeRooms.length) {
            return res.status(200).json({ success: true, message: 'Chưa có loại phòng nào.', data: [] });
        }

        res.status(200).json({ success: true, message: 'Lấy tất cả loại phòng thành công.', data: allTypeRooms });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server.', error: err.message });
    }
};

export const editTypeRoom = async (req, res) => {
    const { _id } = req.params;
    const { name, price } = req.body;

    // Kiểm tra xem ID có hợp lệ không
    if (!_id) {
        return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    try {
        const typeRoomToUpdate = await roomTypeModel.findById(_id);
        if (!typeRoomToUpdate) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy loại phòng.' });
        }

        // Cập nhật các trường được cung cấp
        if (name) typeRoomToUpdate.name = formatString(name);
        if (price) typeRoomToUpdate.base_price_per_minute = price;

        const updatedTypeRoom = await typeRoomToUpdate.save();

        res.status(200).json({ success: true, message: 'Cập nhật loại phòng thành công.', data: updatedTypeRoom });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server.', error: err.message });
    }
};

export const deleteTypeRoom = async (req, res) => {
    const { _id } = req.params;

    if (!_id) {
        return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    try {
        // *** KIỂM TRA AN TOÀN ***
        // Kiểm tra xem có phòng nào đang sử dụng loại phòng này không
        const roomUsingType = await roomModel.findOne({ type: _id });
        if (roomUsingType) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa loại phòng này vì vẫn còn phòng đang sử dụng nó.',
            });
        }

        const deletedTypeRoom = await roomTypeModel.findByIdAndDelete(_id);
        if (!deletedTypeRoom) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy loại phòng để xóa.' });
        }

        res.status(200).json({ success: true, message: 'Xóa loại phòng thành công.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server.', error: err.message });
    }
};
