import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { getUserData } from '../controllers/userContrller.js';

const userRouter = express.Router();

userRouter.get('/data', authMiddleware, getUserData);

export default userRouter;
