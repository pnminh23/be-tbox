import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import accountModel from '../models/accountModel.js';
import { env } from '../config/enviroment.js';
import { accountValidation } from '../validations/accountValidation.js';
import transporter from '../config/nodemailer.js';
const pendingAccounts = new Map(); // Lưu tạm tài khoản chờ xác nhận OTP
export const register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ success: false, message: 'Hãy nhập đầy đủ thông tin' });
    const { error } = accountValidation(req.body);

    if (error) return res.status(400).json({ success: false, message: 'Email hoặc Password chưa đúng định dạng' });

    try {
        const existingAccount = await accountModel.findOne({ email });
        if (existingAccount) return res.status(400).json({ success: false, message: 'Tài khoản đã tồn tại' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = String(Math.floor(100000 + Math.random() * 900000));

        pendingAccounts.set(email, { name, email, password: hashedPassword, otp, createdAt: Date.now() });

        // Gửi email chứa OTP
        const mailOptions = {
            from: `"PNM - BOX" <${env.USER_EMAIL}>`,
            to: email,
            subject: 'Xác nhận tài khoản - PNM BOX',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #007BFF; text-align: center;">Chào mừng đến với PNM - BOX</h2>
                    <p style="font-size: 16px; color: #333;">Cảm ơn bạn đã đăng ký. Dưới đây là mã OTP của bạn:</p>
                    <div style="background: #f3f3f3; padding: 10px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 5px;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #666;">Mã OTP này có hiệu lực trong <b>5 phút</b>. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
                    <p style="font-size: 14px; text-align: center; margin-top: 20px;">
                        <a href="https://yourwebsite.com/verify" style="background: #007BFF; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Xác nhận ngay</a>
                    </p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'OTP sent to email for verification' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ sucess: false, message: 'Email or password are required' });

    try {
        const account = await accountModel.findOne({ email });

        if (!account) return res.status(400).json({ sucess: false, message: 'Invalid email' });

        const isMatch = await bcrypt.compare(password, account.password);

        if (!isMatch) return res.status(400).json({ sucess: false, message: 'Invalid password' });

        const token = jwt.sign({ id: account._id, role: account.role }, env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ sucess: true });
    } catch (error) {
        res.status(500).json({ sucess: false, message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        return res.status(200).json({ sucess: true, message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ sucess: false, message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Thiếu tài khoản hoặc mật khẩu' });

    try {
        const pendingAccount = pendingAccounts.get(email);
        if (!pendingAccount)
            return res.status(400).json({ success: false, message: 'Không tìm thấy email trong dữ liệu tạm' });

        if (pendingAccount.otp !== otp) return res.status(400).json({ success: false, message: 'OTP sai' });

        if (Date.now() - pendingAccount.createdAt > 5 * 60 * 1000) {
            pendingAccounts.delete(email);
            return res.status(400).json({ success: false, message: 'OTP đã hết hạn' });
        }

        const account = new accountModel({
            name: pendingAccount.name,
            email: pendingAccount.email,
            password: pendingAccount.password,
            role: 'user',
        });
        await account.save();
        pendingAccounts.delete(email);

        const token = jwt.sign({ id: account._id, role: account.role }, env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, message: 'Đã xác thực email, tạo tài khoản thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const resendOtpResetPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email là bắt buộc' });

    try {
        const account = await accountModel.findOne({ email });
        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy tài khoản' });

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        resetPasswords.set(email, { otp, createdAt: Date.now() });

        const mailOptions = {
            from: `"PNM - BOX" <${env.USER_EMAIL}>`,
            to: email,
            subject: 'Đặt lại mật khẩu - PNM BOX',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #007BFF; text-align: center;">Đặt lại mật khẩu</h2>
                    <p style="font-size: 16px; color: #333;">Bạn đã yêu cầu đặt lại mật khẩu. Dưới đây là mã OTP của bạn:</p>
                    <div style="background: #f3f3f3; padding: 10px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 5px;">
                        ${otp}
                    </div>
                    <p style="font-size: 14px; color: #666;">Mã OTP này có hiệu lực trong <b>5 phút</b>. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);

        return res.status(200).json({ success: true, message: 'OTP để đặt lại mật khẩu đã được gửi' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
        return res.status(400).json({ success: false, message: 'Email, OTP and new password are required' });

    try {
        const account = await accountModel.findOne({ email });
        if (!account) return res.status(400).json({ success: false, message: 'account is not found' });

        if (account.resetOTP === '' || account.resetOTP !== otp)
            return res.status(400).json({ success: false, message: 'Invalid OTP' });

        if (account.resetOTPExpireAt < Date.now())
            return res.status(400).json({ success: false, message: 'OTP expired' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        account.password = hashedPassword;
        account.resetOTP = '';
        account.resetOTPExpireAt = 0;

        await account.save();

        res.status(200).json({ success: true, message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
