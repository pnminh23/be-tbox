import express from 'express';
import { createTimeSlots, getAllTimeSlots } from '../controllers/timeSlotsController.js';
const TimeSlotsRouter = express.Router();

TimeSlotsRouter.post('/create', createTimeSlots);
TimeSlotsRouter.get('/get-all', getAllTimeSlots);

export default TimeSlotsRouter;
