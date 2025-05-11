import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { env } from './config/enviroment.js';
import CONNECT_DB from './config/mongoose.js';
import authRouter from './routes/authRoutes.js';
import AccountRouter from './routes/AccountRoutes.js';
import FilmRouter from './routes/filmRoutes.js';
import BranchRouter from './routes/branchRoutes.js';
import RoomRouter from './routes/roomRoutes.js';

const app = express();
const port = env.APP_PORT || 4000;
CONNECT_DB();

app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: 'http://localhost:3000', // Chỉ cho phép Next.js truy cập
        credentials: true, // Cho phép gửi cookie, token
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
);

//API Endpoint
app.get('/', (req, res) => res.send('API working'));
app.use('/api/auth', authRouter);
app.use('/api/account', AccountRouter);
app.use('/api/film', FilmRouter);
app.use('/api/branch', BranchRouter);
app.use('/api/room', RoomRouter);
app.use('/uploads', express.static('uploads'));

app.listen(port, () => {
    console.log(`Server is running on http://${env.APP_HOST}:${port}`);
});
