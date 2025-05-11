import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
    editAccountDataByEmail,
    getAllUsersData,
    getUserData,
    getUserDataByEmail,
    toggleLockAccountByEmail,
} from '../controllers/accountContrller.js';
import { createUploadMiddleware } from '../middlewares/uploadMiddleware.js';

const uploadAvatar = createUploadMiddleware('avatar', 'email');

const AccountRouter = express.Router();

AccountRouter.get('/data', authMiddleware, getUserData);
AccountRouter.get('/all-account-data', getAllUsersData);
AccountRouter.post('/toggle-lock', toggleLockAccountByEmail);
AccountRouter.post('/account-by-email', getUserDataByEmail);
AccountRouter.put('/edit-account-by-email/:email', uploadAvatar.single('image'), editAccountDataByEmail);

export default AccountRouter;
