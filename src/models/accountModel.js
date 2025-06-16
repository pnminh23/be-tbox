import mongoose from 'mongoose';
import { type } from 'os';

const accountSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        phone: { type: String, required: true },
        password: { type: String, required: true },
        image: { type: String, default: '' },
        imagePublicId: { type: String, default: '' },
        role: {
            type: String,
            enum: ['user', 'admin', 'employee'],
            default: 'user',
        },
        isActive: { type: Boolean, default: false },
        isLock: { type: Boolean, default: false },
        isResetpassword: { type: Boolean, default: false },
        verifyOTP: { type: String, default: '' },
        verifyOTPExpireAt: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const accountModel = mongoose.models.account || mongoose.model('account', accountSchema);

export default accountModel;
