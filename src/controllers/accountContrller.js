import accountModel from '../models/accountModel.js';
import bcrypt from 'bcryptjs';
import { cloudinary } from '../config/cloudinary.js';

export const getUserData = async (req, res) => {
    try {
        const { accountId } = req.body;

        const account = await accountModel.findById(accountId);

        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy dữ liệu tài khoản thành công.',
            data: account,
        });
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu người dùng:', error);
        res.status(500).json({ success: false, message: 'Không thể lấy dữ liệu tài khoản.', error: error.message });
    }
};

export const getAllUsersData = async (req, res) => {
    try {
        const accounts = await accountModel.find({}, 'name phone email role isLock createdAt');

        if (accounts.length === 0) {
            return res
                .status(200)
                .json({ success: true, message: 'Không có tài khoản nào trong cơ sở dữ liệu.', data: [] });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy tất cả dữ liệu tài khoản thành công.',
            data: accounts,
        });
    } catch (error) {
        console.error('Lỗi khi lấy tất cả dữ liệu người dùng:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy tất cả dữ liệu tài khoản.',
            error: error.message,
        });
    }
};

export const toggleLockAccountByEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        account.isLock = !account.isLock;
        await account.save();

        res.status(200).json({
            success: true,
            message: account.isLock ? 'Tài khoản đã được khóa thành công.' : 'Tài khoản đã được mở khóa thành công.',
            data: account,
        });
    } catch (error) {
        console.error('Lỗi khi thay đổi trạng thái khóa tài khoản:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể thay đổi trạng thái khóa tài khoản.',
            error: error.message,
        });
    }
};

export const getUserDataByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        const account = await accountModel.findOne({ email }, 'email image name phone role isLock createdAt');

        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy dữ liệu tài khoản theo email thành công.',
            data: account,
        });
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu tài khoản theo email:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy dữ liệu tài khoản theo email.',
            error: error.message,
        });
    }
};

export const editAccountDataByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        const { name, phone, role, isLock, password } = req.body;

        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        if (name !== undefined) account.name = name;
        if (phone !== undefined) account.phone = phone;
        if (role !== undefined) account.role = role;
        if (isLock !== undefined) account.isLock = isLock;

        if (password !== undefined && password !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            account.password = hashedPassword;
        }

        if (req.file) {
            if (account.imagePublicId) {
                await cloudinary.uploader.destroy(account.imagePublicId);
            }
            account.image = req.file.path;
            account.imagePublicId = req.file.filename;
        }

        await account.save();

        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được cập nhật thành công.',
            data: account,
        });
    } catch (error) {
        console.error('Lỗi khi chỉnh sửa dữ liệu tài khoản:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật tài khoản.', error: error.message });
    }
};

export const deleteAccountByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        if (account.imagePublicId) {
            await cloudinary.uploader.destroy(account.imagePublicId);
        }

        await accountModel.deleteOne({ email });

        res.status(200).json({
            success: true,
            message: 'Tài khoản đã được xóa thành công.',
        });
    } catch (error) {
        console.error('Lỗi khi xóa tài khoản:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa tài khoản.', error: error.message });
    }
};
