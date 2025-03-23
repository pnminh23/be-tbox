import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['user', 'admin', 'employee'],
        default: 'user',
    },
    isAccountVerified: { type: Boolean, default: false },
    verifyOTP: { type: String, default: '' },
    verifyOTPExpireAt: { type: Number, default: 0 },
    resetOTP: { type: String, default: '' },
    resetOTPExpireAt: { type: Number, default: 0 },
});

const accountModel = mongoose.models.account || mongoose.model('account', accountSchema);

export default accountModel;
