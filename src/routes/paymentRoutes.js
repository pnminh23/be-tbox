import express from 'express';
import { createOrder, handleWebhook } from '../controllers/payosController.js';

const PaymentRouter = express.Router();

PaymentRouter.post('/create', createOrder);
PaymentRouter.post('/webhook', handleWebhook);

export default PaymentRouter;
