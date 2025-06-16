import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import {
    deleteAccountByEmail,
    editAccountDataByEmail,
    getAllUsersData,
    getUserData,
    getUserDataByEmail,
    toggleLockAccountByEmail,
} from '../controllers/accountContrller.js';
import { uploader } from '../config/cloudinary.js';

const AccountRouter = express.Router();

AccountRouter.get('/data', authMiddleware, getUserData);
AccountRouter.get('/all-account-data', getAllUsersData);
AccountRouter.post('/toggle-lock', toggleLockAccountByEmail);
AccountRouter.get('/account-by-email/:email', getUserDataByEmail);
AccountRouter.put('/edit-account-by-email/:email', uploader.single('image'), editAccountDataByEmail);
AccountRouter.delete('/delete/:email', deleteAccountByEmail);

export default AccountRouter;
