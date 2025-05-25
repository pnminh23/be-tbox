import express from 'express';
import { createCombo, deleteCombo, editComboById, getAllCombo, getComboById } from '../controllers/comboController.js';

const ComboRouter = express.Router();

ComboRouter.post('/create', createCombo);
ComboRouter.get('/get-all', getAllCombo);
ComboRouter.get('/get/:id', getComboById);
ComboRouter.put('/edit/:_id', editComboById);
ComboRouter.delete('/delete/:_id', deleteCombo);

export default ComboRouter;
