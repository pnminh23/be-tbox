import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import accountModel from '../models/accountModel.js';
import { env } from '../config/enviroment.js';
import { accountValidation } from '../validations/accountValidation.js';
import transporter from '../config/nodemailer.js';

export const register = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ sucess: false, message: 'Missing details' });
    const { error } = accountValidation(req.body);
    if (error) return res.status(400).json({ sucess: false, message: 'Incorrect format' });

    try {
        //tìm kiếm một tài khoản có email trùng với giá trị email được truyền vào.
        const existingAccount = await accountModel.findOne({ email });

        if (existingAccount) return res.status(400).json({ sucess: false, message: 'Account already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const account = new accountModel({ name, email, password: hashedPassword });
        await account.save();

        const token = jwt.sign({ id: account._id }, env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        //send email
        const mailOptions = {
            from: env.USER_EMAIL,
            to: email,
            subject: 'Welcome to PNM - BOX',
            text: `Welcome to PNM - BOX website. Your account has been created with email id: ${email} `,
        };

        await transporter.sendMail(mailOptions);

        return res.status(200).json({ sucess: true });
    } catch (error) {
        res.status(500).json({ sucess: false, message: error.message });
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

        const token = jwt.sign({ id: account._id }, env.JWT_SECRET, { expiresIn: '7d' });

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

//Send verification OTP to the Accounts Email
export const sendVerifyOTP = async (req, res) => {
    try {
        const { accountId } = req.body;

        const account = await accountModel.findById(accountId);

        if (account.isAccountVerified) {
            return res.status(400).json({ sucess: false, message: 'Account already verifyed' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        account.verifyOTP = otp;
        account.verifyOTPExpireAt = Date.now() + 5 * 60 * 1000;

        await account.save();

        const mailOptions = {
            from: env.USER_EMAIL,
            to: account.email,
            subject: 'Account Verification OTP',
            text: `Your OTP is ${otp}. Verify your account using this OTP`,
        };
        await transporter.sendMail(mailOptions);

        res.status(200).json({ sucess: true, message: 'Verification OTP sent on Email' });
    } catch (error) {
        res.status(500).json({ sucess: false, message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    const { accountId, otp } = req.body;

    if (!accountId || !otp) return res.status(200).json({ sucesss: false, message: 'Missing Details' });

    try {
        const account = await accountModel.findById(accountId);

        if (!account) {
            return res.status(400).json({
                sucess: false,
                message: 'User not found',
            });
        }

        if (account.verifyOTP === '' || account.verifyOTP !== otp) {
            return res.status(400).json({
                sucess: false,
                message: 'Invalid OTP',
            });
        }

        if (account.verifyOTPExpireAt < Date.now()) {
            return res.status(400).json({
                sucess: false,
                message: 'OTP Expired',
            });
        }

        account.isAccountVerified = true;
        account.verifyOTP = '';
        account.verifyOTPExpireAt = 0;

        await account.save();
        return res.status(200).json({
            sucess: true,
            message: 'Email verifyed successfully',
        });
    } catch (error) {
        res.status(500).json({ sucess: false, message: error.message });
    }
};
