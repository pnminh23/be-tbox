import accountModel from '../models/accountModel.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises'; // dùng promise-based API
export const getUserData = async (req, res) => {
    try {
        const { accountId } = req.body;

        const account = await accountModel.findById(accountId);

        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy account' });

        res.status(200).json({
            success: true,
            data: {
                name: account.name,
                image: account.image,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllUsersData = async (req, res) => {
    try {
        // Lấy tất cả tài khoản từ cơ sở dữ liệu
        const accounts = await accountModel.find({}, 'name phone email role isLock');

        if (accounts.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có tài khoản nào trong cơ sở dữ liệu' });
        }

        res.status(200).json({
            success: true,
            data: accounts,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleLockAccountByEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const account = await accountModel.findOne({ email });
        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy account với email này' });

        account.isLock = !account.isLock;
        await account.save();

        res.status(200).json({
            success: true,
            message: account.isLock ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserDataByEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const account = await accountModel.findOne({ email }, 'email image name phone role isLock createdAt');

        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy account với email này' });

        res.status(200).json({
            success: true,
            data: account,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editAccountDataByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const { name, phone, role, isLock, password } = req.body;

        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy account' });
        }

        if (name !== undefined) account.name = name;
        if (phone !== undefined) account.phone = phone;
        if (role !== undefined) account.role = role;
        if (isLock !== undefined) account.isLock = isLock;

        if (password !== undefined) {
            const hashedPassword = await bcrypt.hash(password, 10);
            account.password = hashedPassword;
        }

        if (req.file) {
            console.log('New uploaded file:', req.file);

            // Nếu account đã có ảnh cũ → xóa ảnh cũ
            if (account.image) {
                try {
                    await fs.unlink(account.image);
                    console.log('Old image deleted:', account.image);
                } catch (err) {
                    console.error('Failed to delete old image:', err);
                }
            }

            // Quy tắc đặt tên file: 'avatar_email.jpg'
            const emailPrefix = email.split('@')[0]; // Lấy phần trước dấu '@' làm prefix
            const newFilename = `avatar_${emailPrefix}${path.extname(req.file.originalname)}`;

            // Lưu thông tin file
            const folder = 'avatar'; // Ví dụ folder avatar
            const fileInfo = {
                filename: newFilename,
                folder: folder,
                path: path.join('uploads', folder, newFilename), // Lưu đường dẫn đầy đủ
            };

            account.image = `http://localhost:2911/${fileInfo.path.replace(/\\/g, '/')}`;

            // Di chuyển file vào thư mục và đổi tên
            await fs.rename(req.file.path, fileInfo.path);
            console.log('File renamed and moved:', fileInfo.path);
        }

        await account.save();

        res.status(200).json({
            success: true,
            message: 'Cập nhật thành công',
            data: account,
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
