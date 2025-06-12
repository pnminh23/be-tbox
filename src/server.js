// server.js
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
import TimeSlotsRouter from './routes/timeSlotsRoutes.js';
import PromotionRouter from './routes/promotionRoutes.js';
import ComboRouter from './routes/comboRoutes.js';
import BookingRouter from './routes/bookingRoutes.js'; // Thêm nếu bạn đã tạo route booking

import { Server } from 'socket.io';
import http from 'http';
import PaymentRouter from './routes/paymentRoutes.js';
import { initChatbotSocket } from './sockets/initChatbotSocket.js';
import ReviewRouter from './routes/reviewRoutes.js';
import NewsRouter from './routes/newsRoutes.js';

// Khởi tạo app và server
const app = express();
const server = http.createServer(app);

// Tạo socket server
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        credentials: true,
    },
});

// Kết nối DB
CONNECT_DB();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
);

// Truyền io vào request để controller dùng được
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.get('/', (req, res) => res.send('API working'));
app.use('/api/auth', authRouter);
app.use('/api/account', AccountRouter);
app.use('/api/film', FilmRouter);
app.use('/api/branch', BranchRouter);
app.use('/api/room', RoomRouter);
app.use('/api/timeSlots', TimeSlotsRouter);
app.use('/api/promotion', PromotionRouter);
app.use('/api/combo', ComboRouter);
app.use('/api/review', ReviewRouter);
app.use('/api/news', NewsRouter);
app.use('/api/booking', BookingRouter); // Thêm route booking nếu có
app.use('/uploads', express.static('uploads'));
app.use('/api/payos', PaymentRouter);

initChatbotSocket(io);

// Lắng nghe socket
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Lắng nghe port
const port = env.APP_PORT || 4000;
server.listen(port, () => {
    console.log(`Server is running on http://${env.APP_HOST}:${port}`);
});
