import accountModel from '../models/accountModel.js';

export const getUserData = async (req, res) => {
    try {
        const { accountId } = req.body;

        const account = await accountModel.findById(accountId);

        if (!account) return res.status(400).json({ success: false, message: 'Không tìm thấy account' });

        res.status(200).json({
            success: true,
            data: {
                name: account.name,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
