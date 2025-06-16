import promotionModel from '../models/promotionModel.js';
import { formatString } from '../services/formatString.js';

export const createPromotion = async (req, res) => {
    let { name, discountPercent, quanlity } = req.body;
    if (!name || !discountPercent || !quanlity)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

    try {
        name = formatString(name).toUpperCase();

        const existingPromotion = await promotionModel.findOne({ name });
        if (existingPromotion) return res.status(400).json({ success: false, message: 'Mã khuyến mãi này đã tồn tại' });

        await promotionModel.create({
            name,
            discountPercent,
            quanlity,
        });

        return res.status(200).json({ success: true, message: 'Thêm mã khuyến mãi mới thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllPromotion = async (req, res) => {
    try {
        const promotion = await promotionModel.find({});

        if (promotion.length === 0)
            return res.status(400).json({ success: false, message: 'Không có mã khuyến mãi nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: promotion,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export const getPromotionById = async (req, res) => {
    try {
        const { _id } = req.params;
        const promotion = await promotionModel.findById(_id);

        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mã khuyến mãi' });
        }

        return res.status(200).json({
            success: true,
            data: promotion,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editPromotion = async (req, res) => {
    const { _id } = req.params;
    let { name, discountPercent, quanlity } = req.body;

    if (!name && !discountPercent && !quanlity) {
        return res.status(400).json({ success: false, message: 'Cần ít nhất một trường để cập nhật' });
    }

    try {
        const updateData = {};
        if (name) {
            updateData.name = formatString(name).toUpperCase();

            // Kiểm tra xem tên mới có trùng với mã khác không
            const existingPromotion = await promotionModel.findOne({ name: updateData.name, _id: { $ne: _id } });
            if (existingPromotion) {
                return res.status(400).json({ success: false, message: 'Tên mã khuyến mãi này đã tồn tại' });
            }
        }
        if (discountPercent) updateData.discountPercent = discountPercent;
        if (quanlity) updateData.quanlity = quanlity;

        const updatedPromotion = await promotionModel.findByIdAndUpdate(
            _id,
            updateData,
            { new: true, runValidators: true } // new: true trả về document sau khi update
        );

        if (!updatedPromotion) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mã khuyến mãi để cập nhật' });
        }

        return res.status(200).json({
            success: true,
            message: 'Cập nhật mã khuyến mãi thành công',
            data: updatedPromotion,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deletePromotion = async (req, res) => {
    try {
        const { _id } = req.params;
        const deletedPromotion = await promotionModel.findByIdAndDelete(_id);

        if (!deletedPromotion) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mã khuyến mãi để xóa' });
        }

        return res.status(200).json({ success: true, message: 'Xóa mã khuyến mãi thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
