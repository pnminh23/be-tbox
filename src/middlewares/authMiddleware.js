import jwt from 'jsonwebtoken';
import { env } from '../config/enviroment.js';

const authMiddleware = async (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized. Login again',
        });
    }

    try {
        const tokenDecode = jwt.verify(token, env.JWT_SECRET);

        if (!tokenDecode.id) {
            return res.status(401).json({ success: false, message: 'Not Authorized. Login again' });
        }

        req.body.accountId = tokenDecode.id;
        req.body.role = tokenDecode.role;

        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message,
        });
    }
};

export default authMiddleware;
