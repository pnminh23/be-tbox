import categoryFilmModel from '../models/categoryFilmModel.js';

export const createCategoryFilm = async (req, res) => {
    const { name } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Hãy nhập tên thể loại' });

    try {
        const existingCategory = await categoryFilmModel.findOne({ name });
        if (existingCategory) return res.status(400).json({ success: false, message: 'Thể loại này đã tồn tại' });

        const newCategory = await categoryFilmModel.create({ name });

        await newCategory.save();
        return res.status(200).json({ success: true, message: 'Thêm thể loại phim thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllCategoryFilms = async (req, res) => {
    try {
        const categorys = await categoryFilmModel.find({});

        if (categorys.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có thể loại nào trong cơ sở dữ liệu' });
        }

        return res.status(200).json({
            success: true,
            data: categorys,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
