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
