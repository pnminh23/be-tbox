import express from 'express';
import { login, logout, register, sendVerifyOTP, verifyEmail } from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.post('/send-verify-otp', authMiddleware, sendVerifyOTP);
authRouter.post('/verify-account', authMiddleware, verifyEmail);

export default authRouter;
