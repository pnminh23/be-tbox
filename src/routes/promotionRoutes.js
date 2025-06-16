import express from 'express';
import {
    createPromotion,
    deletePromotion,
    editPromotion,
    getAllPromotion,
    getPromotionById,
} from '../controllers/promotionController.js';

const PromotionRouter = express.Router();

PromotionRouter.post('/create', createPromotion);
PromotionRouter.get('/get-all', getAllPromotion);
PromotionRouter.get('/get/:_id', getPromotionById);
PromotionRouter.put('/edit/:_id', editPromotion);
PromotionRouter.delete('/delete/:_id', deletePromotion);

export default PromotionRouter;
