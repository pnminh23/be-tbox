import express from 'express';
import { createNews, deleteNews, getAllNews, getNewsById, updateNews } from '../controllers/newsController.js';
import { createUploadMiddleware } from '../middlewares/uploadMiddleware.js';
const NewsRouter = express.Router();
const uploadAvatar = createUploadMiddleware('news', 'name');

NewsRouter.post('/create', uploadAvatar.single('image'), createNews);
NewsRouter.get('/get-all/', getAllNews);
NewsRouter.get('/get/:_id', getNewsById);
NewsRouter.put('/edit/:_id', uploadAvatar.single('image'), updateNews);
NewsRouter.delete('/delete/:_id', deleteNews);

export default NewsRouter;
