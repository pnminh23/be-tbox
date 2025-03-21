import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { env } from './config/enviroment.js';
import CONNECT_DB from './config/mongoose.js';
import authRouter from './routes/authRoutes.js';

const app = express();
const port = env.APP_PORT || 4000;
CONNECT_DB();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true }));

//API Endpoint
app.get('/', (req, res) => res.send('API working'));
app.use('/api/auth', authRouter);

app.listen(port, () => console.log(`Server start on PORT: ${port}`));
