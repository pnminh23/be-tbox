import filmModel from '../models/filmModel.js';
import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
import { formatString } from '../services/formatString.js';
import bookingModel from '../models/bookingModel.js';
import { ensureDirectoryExistence } from '../services/ensureDirectoryExistence.js';

const normalizeCategory = (str) => {
    return str
        .split('-')
        .map((part) =>
            part
                .trim()
                .split(' ')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ')
        )
        .join(' - ');
};
export const createFilm = async (req, res) => {
    const { name, nameEnglish, category, release_date, duration, country } = req.body;
    let image = '';

    if (!name || !nameEnglish || !category || !release_date || !duration || !country)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

    try {
        const existingFilm = await filmModel.findOne({ name });
        if (existingFilm) return res.status(400).json({ success: false, message: 'Phim này đã tồn tại' });

        if (req.file) {
            // Nếu film đã có ảnh cũ → xóa ảnh cũ

            // Quy tắc đặt tên file: 'avatar_email.jpg'
            const timestamp = Date.now();

            const newFilename = `film_${timestamp}${path.extname(req.file.originalname)}`;

            // Lưu thông tin file
            const folder = 'films'; // Ví dụ folder avatar
            const fileInfo = {
                filename: newFilename,
                folder: folder,
                path: path.join('uploads', folder, newFilename), // Lưu đường dẫn đầy đủ
            };

            image = `http://localhost:2911/${fileInfo.path.replace(/\\/g, '/')}`;

            // Di chuyển file vào thư mục và đổi tên
            await fs.rename(req.file.path, fileInfo.path);
        }

        const normalizedCategory = Array.isArray(category)
            ? category.map(normalizeCategory)
            : [normalizeCategory(category)];

        const newfilm = await filmModel.create({
            name: formatString(name),
            nameEnglish: formatString(nameEnglish),
            category: normalizedCategory,
            release_date: formatString(release_date),
            duration: formatString(duration),
            image,
            country: formatString(country),
        });

        await newfilm.save();
        return res.status(200).json({ success: true, message: 'Thêm phim thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllFilms = async (req, res) => {
    try {
        const films = await filmModel.find({});

        if (films.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có thể loại nào trong cơ sở dữ liệu' });
        }

        return res.status(200).json({
            success: true,
            data: films,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFilmsByCurrentYear = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear().toString();
        const films = await filmModel.find({ release_date: currentYear });

        if (films.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có thể loại nào trong cơ sở dữ liệu' });
        }

        return res.status(200).json({
            success: true,
            data: films,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFilmById = async (req, res) => {
    try {
        const { _id } = req.params;

        const film = await filmModel.findOne({ _id }).populate('category', 'name -_id');

        if (film.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có thể loại nào trong cơ sở dữ liệu' });
        }

        return res.status(200).json({
            success: true,
            message: 'Lấy data phim thành công',
            data: film,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFilmsByCategory = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số category (name)' });
        }

        // Normalize lại thể loại giống như khi tạo phim
        const normalizedCategory = normalizeCategory(name);

        const films = await filmModel.find({ category: { $in: [normalizedCategory] } });

        if (films.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phim thuộc thể loại này' });
        }

        return res.status(200).json({
            success: true,
            data: films,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getFilmsByYear = async (req, res) => {
    try {
        const { release_date } = req.query;

        if (!release_date) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số release_date ' });
        }

        const films = await filmModel.find({ release_date: { $in: [release_date] } });

        if (films.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phim thuộc thể loại này' });
        }

        return res.status(200).json({
            success: true,
            data: films,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTop10MostBookedFilms = async (req, res) => {
    try {
        const topFilms = await bookingModel.aggregate([
            {
                $group: {
                    _id: '$film',
                    totalBookings: { $sum: 1 },
                },
            },
            {
                $sort: { totalBookings: -1 },
            },
            {
                $limit: 10,
            },
            {
                $lookup: {
                    from: 'films', // collection name đúng (trong MongoDB sẽ là 'films')
                    localField: '_id',
                    foreignField: '_id',
                    as: 'filmInfo',
                },
            },
            {
                $unwind: '$filmInfo',
            },
            {
                $project: {
                    _id: '$filmInfo._id',
                    name: '$filmInfo.name',
                    nameEnglish: '$filmInfo.nameEnglish',
                    image: '$filmInfo.image',
                    category: '$filmInfo.category',
                    release_date: '$filmInfo.release_date',
                    duration: '$filmInfo.duration',
                    country: '$filmInfo.country',
                    totalBookings: 1,
                },
            },
        ]);

        const topFilmsWithIndex = topFilms.map((film, index) => ({
            ...film,
            index,
        }));

        return res.status(200).json({
            success: true,
            data: topFilmsWithIndex,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const editFilms = async (req, res) => {
    try {
        const { _id } = req.params;
        const { name, nameEnglish, category, release_date, duration, country } = req.body;

        const film = await filmModel.findOne({ _id });
        if (!film) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy phim' });
        }

        if (name !== undefined) film.name = formatString(name);
        if (nameEnglish !== undefined) film.nameEnglish = formatString(nameEnglish);
        if (release_date !== undefined) film.release_date = formatString(release_date);
        if (duration !== undefined) film.duration = formatString(duration);
        if (country !== undefined) film.country = formatString(country);
        if (category !== undefined) {
            film.category = category;
        }

        if (req.file) {
            if (film.image) {
                try {
                    const oldImagePublicPath = film.image.replace(/^https?:\/\/[^/]+\//, ''); // Bỏ http://localhost:port/
                    const oldImageLocalPath = path.join('uploads', oldImagePublicPath);
                    try {
                        await fs.access(oldImageLocalPath);
                        await fs.unlink(oldImageLocalPath);
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

            const timestamp = Date.now();
            const newFilename = `film_${timestamp}${path.extname(req.file.originalname)}`;
            const folder = 'uploads/films'; // Ví dụ folder avatar
            const newImageLocalPath = path.join(folder, newFilename);
            await ensureDirectoryExistence(newImageLocalPath);
            await fs.rename(req.file.path, newImageLocalPath);
            film.image = `http://localhost:2911/${folder.replace(/\\/g, '/')}/${newFilename}`;
        }

        await film.save(); // Lưu thay đổi vào database

        return res.status(200).json({
            success: true,
            message: 'Cập nhật thành công',
            data: film,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteFilm = async (req, res) => {
    try {
        const { _id } = req.params;

        const film = await filmModel.findOne({ _id });
        if (!film) {
            return res.status(400).json({ success: false, message: 'Phim không tồn tại' });
        }

        // Xóa ảnh nếu tồn tại
        if (film.image) {
            try {
                // Lấy đường dẫn tương đối từ URL
                const imagePath = film.image.replace('http://localhost:2911/', '');
                await fs.unlink(imagePath);
            } catch (err) {
                console.error('Lỗi khi xóa ảnh:', err.message);
            }
        }

        // Xóa phim khỏi database
        const result = await filmModel.deleteOne({ _id });
        if (result.deletedCount === 0) {
            return res.status(400).json({ success: false, message: 'Phim không tồn tại' });
        }

        return res.status(200).json({ success: true, message: 'Xóa phim thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
