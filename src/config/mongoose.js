import mongoose from 'mongoose';
import { env } from './enviroment.js';

const CONNECT_DB = async () => {
    mongoose.connection.on('connected', () => console.log('Database connected!'));
    await mongoose.connect(`${env.MONGODB_URI}/tbox`);
};

export default CONNECT_DB;
