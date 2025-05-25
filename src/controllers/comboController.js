import comboModel from '../models/comboModel.js';
import { formatString } from '../services/formatString.js';

export const createCombo = async (req, res) => {
    let { name, description, types } = req.body;

    if (!name || !description || !Array.isArray(types) || types.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Hãy nhập đầy đủ các trường và ít nhất một loại phòng kèm giá',
        });
    }

    try {
        name = formatString(name).toUpperCase();
        description = formatString(description);

        // Kiểm tra combo đã tồn tại chưa theo tên
        const existingCombo = await comboModel.findOne({ name });
        if (existingCombo) {
            return res.status(400).json({
                success: false,
                message: 'Combo này đã tồn tại',
            });
        }

        // Validate từng loại roomType và price
        for (const item of types) {
            if (!item.typeRoom || !item.price) {
                return res.status(400).json({
                    success: false,
                    message: 'Chưa có giá cho từng loại phòng',
                });
            }
        }

        // Tạo combo
        await comboModel.create({
            name,
            description,
            types,
        });

        return res.status(200).json({ success: true, message: 'Thêm combo mới thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllCombo = async (req, res) => {
    try {
        let combos = await comboModel.find().populate('types.typeRoom').lean(); // Trả về plain object để dễ xử lý JS

        // Sắp xếp theo số trong tên combo (ví dụ: Combo 1, Combo 2, Combo 10)
        combos.sort((a, b) => {
            const numberA = parseInt(a.name.match(/\d+/)?.[0] || 0);
            const numberB = parseInt(b.name.match(/\d+/)?.[0] || 0);
            return numberA - numberB;
        });

        res.status(200).json({
            success: true,
            data: combos,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const getComboById = async (req, res) => {
    const { id } = req.params;

    try {
        const combo = await comboModel.findById(id).populate('types.typeRoom').lean();

        if (!combo) {
            return res.status(404).json({
                success: false,
                message: 'Combo không tồn tại',
            });
        }

        return res.status(200).json({
            success: true,
            data: combo,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const editComboById = async (req, res) => {
    try {
        const { _id } = req.params; // Sửa lại từ _id thành id vì URL là /combos/:id
        const { name, description, types } = req.body;

        const combo = await comboModel.findById(_id);
        if (!combo) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy combo',
            });
        }

        if (name) combo.name = formatString(name).toUpperCase();
        if (description) combo.description = formatString(description);

        if (types && Array.isArray(types)) {
            // Validate từng loại roomType và price
            for (const item of types) {
                if (!item.typeRoom || item.price == null) {
                    return res.status(400).json({
                        success: false,
                        message: 'Mỗi loại phòng phải có đầy đủ typeRoom và price',
                    });
                }
            }

            // Gán lại mảng types
            combo.types = types.map((item) => ({
                typeRoom: item.typeRoom,
                price: Number(item.price),
            }));
        }

        await combo.save();

        return res.status(200).json({
            success: true,
            message: `Cập nhật ${combo.name} thành công`,
            data: combo,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const deleteCombo = async (req, res) => {
    try {
        const { _id } = req.params;
        const combo = await comboModel.findOne({ _id });
        if (!combo) {
            return res.status(400).json({ success: false, message: 'combo này không tồn tại' });
        }
        await comboModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa combo thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
