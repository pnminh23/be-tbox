import express from 'express';
import { createNews, deleteNews, getAllNews, getNewsById, updateNews } from '../controllers/newsController.js';
import { uploader } from '../config/cloudinary.js';

const NewsRouter = express.Router();

NewsRouter.post('/create', uploader.single('image'), createNews);
NewsRouter.get('/get-all/', getAllNews);
NewsRouter.get('/get/:_id', getNewsById);
NewsRouter.put('/edit/:_id', uploader.single('image'), updateNews);
NewsRouter.delete('/delete/:_id', deleteNews);

export default NewsRouter;
