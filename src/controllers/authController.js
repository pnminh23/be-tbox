import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import accountModel from '../models/accountModel.js';
import { env } from '../config/enviroment.js';
import { accountValidation } from '../validations/accountValidation.js';
import transporter from '../config/nodemailer.js';

// Thời gian hiệu lực của OTP (5 phút)
const OTP_EXPIRATION_TIME_MS = 5 * 60 * 1000;

/**
 * Tạo đối tượng mailOptions cho Nodemailer.
 * @param {object} options - Tùy chọn gửi email.
 * @param {string} options.to - Địa chỉ email người nhận.
 * @param {string} options.subject - Tiêu đề email.
 * @param {string} options.title - Tiêu đề lớn trong nội dung email.
 * @param {string} options.message - Nội dung chính của email.
 * @param {string} options.otp - Mã OTP cần hiển thị.
 * @returns {object} Đối tượng mailOptions.
 */
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

/**
 * Đăng ký tài khoản mới.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const register = async (req, res) => {
    const { name, phone, email, password } = req.body;

    // Validate request body using Joi
    const { error } = accountValidation(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }

    try {
        const existingAccount = await accountModel.findOne({ email });
        if (existingAccount) {
            if (existingAccount.isActive) {
                return res.status(409).json({ success: false, message: 'Email đã tồn tại và đã được xác thực. Vui lòng sử dụng email khác.' }); // 409 Conflict
            } else {
                // Xóa tài khoản chưa xác thực
                await accountModel.deleteOne({ email });
                console.log(`Đã xóa tài khoản chưa xác thực với email: ${email}`);
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + OTP_EXPIRATION_TIME_MS;

        const newAccount = new accountModel({
            name,
            phone,
            email,
            password: hashedPassword,
            verifyOTP: otp,
            verifyOTPExpireAt: otpExpireAt,
            isActive: false, // Mặc định là chưa kích hoạt
            isLock: false, // Mặc định là không khóa
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

        return res
            .status(200)
            .json({
                success: true,
                message: 'Mã OTP xác thực đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến.',
            });
    } catch (error) {
        console.error('Lỗi khi đăng ký tài khoản:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình đăng ký tài khoản. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Đăng nhập tài khoản.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
    }

    try {
        const account = await accountModel.findOne({ email });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
        }

        if (account.isLock) {
            return res
                .status(403)
                .json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
        }

        if (!account.isActive) {
            return res
                .status(403)
                .json({ success: false, message: 'Tài khoản của bạn chưa được kích hoạt. Vui lòng xác thực email.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' }); // 401 Unauthorized
        }

        const token = jwt.sign({ id: account._id, role: account.role }, env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ success: true, message: 'Đăng nhập thành công.', role: account.role });
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Đăng xuất tài khoản.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        return res.status(200).json({ success: true, message: 'Đăng xuất thành công.' });
    } catch (error) {
        console.error('Lỗi khi đăng xuất:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình đăng xuất. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Xác thực email bằng OTP.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const verifyEmail = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email và mã OTP.' });
    }

    try {
        const account = await accountModel.findOne({ email });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        if (account.isActive) {
            return res.status(400).json({ success: false, message: 'Tài khoản đã được xác thực trước đó.' });
        }

        if (!account.verifyOTP || !account.verifyOTPExpireAt) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: 'Không tìm thấy mã OTP cho tài khoản này. Vui lòng yêu cầu gửi lại.',
                });
        }

        if (account.verifyOTP !== otp) {
            return res.status(400).json({ success: false, message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' });
        }

        if (Date.now() > new Date(account.verifyOTPExpireAt).getTime()) {
            return res
                .status(400)
                .json({ success: false, message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.' });
        }

        // Cập nhật trạng thái tài khoản
        account.isActive = true;
        account.isLock = false;
        account.verifyOTP = null; // Xóa OTP sau khi xác thực thành công
        account.verifyOTPExpireAt = null; // Xóa thời gian hết hạn
        await account.save();

        return res
            .status(200)
            .json({ success: true, message: 'Xác thực email thành công, tài khoản của bạn đã được kích hoạt.' });
    } catch (error) {
        console.error('Lỗi khi xác thực email:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình xác thực email. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Gửi lại mã OTP xác thực email.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const resendOTP = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email.' });
    }

    try {
        const account = await accountModel.findOne({ email });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        if (account.isActive) {
            return res.status(400).json({ success: false, message: 'Tài khoản này đã được xác thực trước đó.' });
        }

        const newOTP = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + OTP_EXPIRATION_TIME_MS;

        account.verifyOTP = newOTP;
        account.verifyOTPExpireAt = otpExpireAt;
        await account.save();

        const mailOptions = generateMailOptions({
            to: email,
            subject: 'Mã OTP mới - PNM BOX',
            title: 'Xác thực tài khoản PNM - BOX',
            message: 'Dưới đây là mã OTP mới của bạn để xác thực tài khoản:',
            otp: newOTP,
        });

        await transporter.sendMail(mailOptions);

        return res
            .status(200)
            .json({
                success: true,
                message: 'Mã OTP mới đã được gửi lại đến email của bạn. Vui lòng kiểm tra hộp thư đến.',
            });
    } catch (error) {
        console.error('Lỗi khi gửi lại OTP:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình gửi lại mã OTP. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Yêu cầu đặt lại mật khẩu (gửi OTP).
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email.' });
    }

    try {
        const account = await accountModel.findOne({ email });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        const newOTP = String(Math.floor(100000 + Math.random() * 900000));
        const otpExpireAt = Date.now() + OTP_EXPIRATION_TIME_MS;

        account.verifyOTP = newOTP; // Sử dụng verifyOTP cho cả xác thực và reset password
        account.verifyOTPExpireAt = otpExpireAt;
        await account.save();

        const mailOptions = generateMailOptions({
            to: email,
            subject: 'Mã OTP xác nhận quên mật khẩu - PNM BOX',
            title: 'Yêu cầu đặt lại mật khẩu PNM - BOX',
            message: 'Dưới đây là mã OTP của bạn để đặt lại mật khẩu:',
            otp: newOTP,
        });

        await transporter.sendMail(mailOptions);

        return res
            .status(200)
            .json({
                success: true,
                message: 'Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến.',
            });
    } catch (error) {
        console.error('Lỗi khi yêu cầu quên mật khẩu:', error);
        return res
            .status(500)
            .json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.',
                error: error.message,
            });
    }
};

/**
 * Xác thực OTP để cho phép đặt lại mật khẩu.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const verifyOtpResetPassword = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email và mã OTP.' });
    }

    try {
        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        if (!account.verifyOTP || !account.verifyOTPExpireAt) {
            return res
                .status(400)
                .json({ success: false, message: 'Không có mã OTP nào đang chờ xác thực cho tài khoản này.' });
        }

        if (account.verifyOTP !== otp) {
            return res.status(400).json({ success: false, message: 'Mã OTP không chính xác. Vui lòng kiểm tra lại.' });
        }

        if (Date.now() > new Date(account.verifyOTPExpireAt).getTime()) {
            return res
                .status(400)
                .json({ success: false, message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.' });
        }

        // Nếu OK, xóa OTP và đặt cờ cho phép đổi mật khẩu
        account.verifyOTP = null;
        account.verifyOTPExpireAt = null;
        account.isResetpassword = true; // Cho phép đổi mật khẩu sau khi OTP hợp lệ
        await account.save();

        return res
            .status(200)
            .json({ success: true, message: 'Xác thực OTP thành công. Bạn có thể đặt lại mật khẩu.' });
    } catch (error) {
        console.error('Lỗi khi xác thực OTP đặt lại mật khẩu:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi trong quá trình xác thực OTP. Vui lòng thử lại sau.',
            error: error.message,
        });
    }
};

/**
 * Đặt lại mật khẩu tài khoản.
 * @param {object} req - Đối tượng request.
 * @param {object} res - Đối tượng response.
 */
export const resetPassword = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ email và mật khẩu mới.' });
    }

    try {
        const account = await accountModel.findOne({ email });
        if (!account) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
        }

        if (!account.isResetpassword) {
            return res
                .status(403)
                .json({ success: false, message: 'Bạn cần xác minh OTP trước khi đặt lại mật khẩu.' }); // 403 Forbidden
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        account.password = hashedPassword;
        account.isResetpassword = false; // Đặt lại cờ sau khi mật khẩu đã được đổi
        await account.save();

        res.status(200).json({ success: true, message: 'Mật khẩu của bạn đã được đặt lại thành công.' });
    } catch (error) {
        console.error('Lỗi khi đặt lại mật khẩu:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi trong quá trình đặt lại mật khẩu. Vui lòng thử lại sau.',
            error: error.message,
        });
    }
};
