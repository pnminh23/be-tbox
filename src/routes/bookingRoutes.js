import express from 'express';
import {
    createBooking,
    editBooking,
    getBookedByID,
    getBookedTimeSlotsByRoom,
} from '../controllers/bookingController.js';

const BookingRouter = express.Router();

BookingRouter.post('/create', createBooking);
BookingRouter.get('/get-book-timeSlots-by-room/:room/:date', getBookedTimeSlotsByRoom);
BookingRouter.get('/get-booking/:id_booking/', getBookedByID);
BookingRouter.put('/edit/:id_booking/', editBooking);

// BookingRouter.get('/get/:_id', getBranchById);
// BookingRouter.put('/edit/:_id', editBranch);
// BookingRouter.delete('/delete/:_id', deleteBranch);

export default BookingRouter;
