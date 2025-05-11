import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import accountModel from '../models/accountModel.js';
import { env } from '../config/enviroment.js';
import { accountValidation } from '../validations/accountValidation.js';
import transporter from '../config/nodemailer.js';
const dateOtp = 60 * 1000;
export function generateMailOptions({ to, subject, title, message, otp }) {
    return {
        from: 'PNM - BOX Cafe phim',
        to,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #007BFF; text-align: center;">${title}</h2>
                <p style="font-size: 16px; color: #333;">${message}</p>
                <div style="background: #f3f3f3; padding: 10px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 5px;">
                    ${otp}
                </div>
                <p style="font-size: 14px; color: #666;">Mã OTP này có hiệu lực trong <b>5 phút</b>.</p>
            </div>
        `,
    };
}

export const register = async (req, res) => {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !email || !password)
        return res.status(400).json({ success: false, message: 'Hãy nhập đầy đủ thông tin' });

    const { error } = accountValidation(req.body);

    if (error) return res.status(400).json({ success: false, message: error.details[0].message });

    try {
        const existingAccount = await accountModel.findOne({ email });
        if (existingAccount) return res.status(400).json({ success: false, message: 'Tài khoản đã tồn tại' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + dateOtp;

        const newAccount = new accountModel({
            name,
            phone,
            email,
            password: hashedPassword,
            verifyOTP: otp,
            verifyOTPExpireAt: otpExpireAt,
        });

        await newAccount.save();

        const mailOptions = generateMailOptions({
            to: email,
            subject: 'Xác nhận tài khoản - PNM BOX',
            title: 'Chào mừng đến với PNM - BOX',
            message: 'Cảm ơn bạn đã đăng ký. Dưới đây là mã OTP của bạn:',
            otp,
        });
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'OTP đã gửi đến email của bạn' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email or password are required' });
    }

    try {
        const account = await accountModel.findOne({ email });

        if (!account) {
            return res.status(400).json({ success: false, message: 'Email không tồn tại' });
        }

        if (account.isLock) {
            return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa' });
        }

        const isMatch = await bcrypt.compare(password, account.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu không đúng' });
        }

        const token = jwt.sign({ id: account._id, role: account.role }, env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        return res.status(200).json({ success: true, message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Thiếu email hoặc mã OTP' });

    try {
        const account = await accountModel.findOne({ email });

        if (!account) return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại' });

        if (account.isActive) return res.status(400).json({ success: false, message: 'Tài khoản đã được xác thực' });

        if (!account.verifyOTP || !account.verifyOTPExpireAt)
            return res.status(400).json({ success: false, message: 'Không có mã OTP để xác thực' });

        if (account.verifyOTP !== otp)
            return res.status(400).json({ success: false, message: 'Mã OTP không chính xác' });

        if (Date.now() > new Date(account.verifyOTPExpireAt).getTime())
            return res.status(400).json({ success: false, message: 'Mã OTP đã hết hạn' });

        // Cập nhật trạng thái tài khoản
        account.isActive = true;
        account.verifyOTP = '';
        account.verifyOTPExpireAt = 0;
        await account.save();

        // Tạo JWT token
        // const token = jwt.sign({ id: account._id, role: account.role }, env.JWT_SECRET, { expiresIn: '7d' });

        // res.cookie('token', token, {
        //     httpOnly: true,
        //     secure: env.NODE_ENV === 'production',
        //     sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
        //     maxAge: 7 * 24 * 60 * 60 * 1000,
        // });

        return res
            .status(200)
            .json({ success: true, message: 'Xác thực email thành công, tài khoản đã được kích hoạt' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const resendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });

    try {
        const account = await accountModel.findOne({ email });

        if (!account) return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại' });

        if (account.isActive) return res.status(400).json({ success: false, message: 'Tài khoản đã được xác thực' });

        const newOTP = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = new Date(Date.now() + dateOtp); // 10 phút hết hạn

        account.verifyOTP = newOTP;
        account.verifyOTPExpireAt = otpExpireAt;
        await account.save();

        const mailOptions = generateMailOptions({
            to: email,
            subject: 'Mã OTP mới - PNM BOX',
            title: 'Xác thực tài khoản PNM - BOX',
            message: 'Dưới đây là mã OTP mới của bạn:',
            otp: newOTP,
        });

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'Đã gửi lại mã OTP đến email của bạn' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Vui lòng nhập email' });

    try {
        const account = await accountModel.findOne({ email });

        if (!account) return res.status(400).json({ success: false, message: 'Tài khoản không tồn tại' });

        const newOTP = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = new Date(Date.now() + dateOtp); // 10 phút hết hạn

        account.verifyOTP = newOTP;
        account.verifyOTPExpireAt = otpExpireAt;
        await account.save();

        const mailOptions = generateMailOptions({
            to: email,
            subject: 'Mã OTP xác nhận quên mật khẩu - PNM BOX',
            title: 'Xác thực thay đổi mật khẩu PNM - BOX',
            message: 'Dưới đây là mã OTP mới của bạn:',
            otp: newOTP,
        });

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'Đã gửi lại mã OTP đến email của bạn' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyOtpResetPassword = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email và OTP là bắt buộc' });

    try {
        const account = await accountModel.findOne({ email });
        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy tài khoản' });

        if (account.verifyOTP !== otp) return res.status(400).json({ success: false, message: 'OTP không hợp lệ' });

        if (account.resetOTPExpireAt < Date.now())
            return res.status(400).json({ success: false, message: 'OTP đã hết hạn' });

        // Nếu OK, xóa OTP nhưng thêm 1 flag mới cho phép đổi mật khẩu
        account.verifyOTP = '';
        account.verifyOTPExpireAt = 0;
        account.isResetpassword = true;
        await account.save();

        return res.status(200).json({ success: true, message: 'Xác thực OTP thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ success: false, message: 'Email và mật khẩu mới là bắt buộc' });

    try {
        const account = await accountModel.findOne({ email });
        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy tài khoản' });

        if (!account.isResetpassword)
            return res
                .status(400)
                .json({ success: false, message: 'Vui lòng xác minh OTP trước khi đặt lại mật khẩu' });

        const hashedPassword = await bcrypt.hash(password, 10);

        account.password = hashedPassword;

        account.isOtpVerified = false;

        await account.save();

        res.status(200).json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
