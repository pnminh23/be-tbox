import express from 'express';
import {
    createFilm,
    deleteFilm,
    editFilms,
    getAllFilms,
    getFilmById,
    getFilmsByCurrentYear,
} from '../controllers/filmController.js';
import { createUploadMiddleware } from '../middlewares/uploadMiddleware.js';
const FilmRouter = express.Router();

const uploadAvatar = createUploadMiddleware('films', 'name');

FilmRouter.get('/get-all', getAllFilms);
FilmRouter.get('/get-films-by-current-year', getFilmsByCurrentYear);
FilmRouter.get('/get-film/:_id', getFilmById);
FilmRouter.post('/create-film', uploadAvatar.single('image'), createFilm);
FilmRouter.put('/edit-film/:_id', uploadAvatar.single('image'), editFilms);
FilmRouter.delete('/delete-film/:_id', deleteFilm);

export default FilmRouter;
