import express from 'express';
import {
    createFilm,
    deleteFilm,
    editFilms,
    getAllFilms,
    getFilmById,
    getFilmsByCategory,
    getFilmsByCurrentYear,
    getFilmsByYear,
    getTop10MostBookedFilms,
} from '../controllers/filmController.js';
import { uploader } from '../config/cloudinary.js';
const FilmRouter = express.Router();

FilmRouter.get('/get-all', getAllFilms);
FilmRouter.get('/get-films-by-current-year', getFilmsByCurrentYear);
FilmRouter.get('/get-film-by-category', getFilmsByCategory);
FilmRouter.get('/get-film-by-year', getFilmsByYear);
FilmRouter.get('/get-top10-film', getTop10MostBookedFilms);
FilmRouter.get('/get-film/:_id', getFilmById);
FilmRouter.post('/create-film', uploader.single('image'), createFilm);
FilmRouter.put('/edit-film/:_id', uploader.single('image'), editFilms);
FilmRouter.delete('/delete-film/:_id', deleteFilm);

export default FilmRouter;
