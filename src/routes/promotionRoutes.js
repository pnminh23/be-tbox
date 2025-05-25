import express from 'express';
import { createPromotion, getAllPromotion } from '../controllers/promotionController.js';

const PromotionRouter = express.Router();

PromotionRouter.post('/create', createPromotion);
PromotionRouter.get('/get-all', getAllPromotion);

export default PromotionRouter;
