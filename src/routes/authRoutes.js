import express from 'express';
import {
    login,
    logout,
    register,
    resetPassword,
    verifyEmail,
    verifyOtpResetPassword,
    resendOTP,
    forgotPassword,
} from '../controllers/authController.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/verify-account', verifyEmail);
authRouter.post('/resend-otp', resendOTP);
authRouter.post('/forgotPassword', forgotPassword);
authRouter.post('/verify-otp-reset-password', verifyOtpResetPassword);
authRouter.post('/reset-password', resetPassword);

export default authRouter;
