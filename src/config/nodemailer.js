import nodemailer from 'nodemailer';
import { env } from '../config/enviroment.js';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.USER_EMAIL,
        pass: env.PASSWORD_EMAIL,
    },
});

export default transporter;
