import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { env } from './enviroment.js';
dotenv.config();

const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

export default openai;
