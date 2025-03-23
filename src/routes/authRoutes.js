import express from 'express';
import {
    login,
    logout,
    register,
    resetPassword,
    resendOtpResetPassword,
    verifyEmail,
} from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/verify-account', authMiddleware, verifyEmail);
authRouter.post('/send-reset-otp', resendOtpResetPassword);
authRouter.post('/reset-password', resetPassword);

export default authRouter;
