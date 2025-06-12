import express from 'express';
import {
    createBooking,
    editBooking,
    getAllBookings,
    getBookedByEmail,
    getBookedByEmailAndMonth,
    getBookedByEmailCurrent,
    getBookedById,
    getBookedByOrderCode,
    getBookedTimeSlotsByRoom,
    getBookingsByDate,
    getBookingsByMonth,
    getBookingStatsByEmail,
    getCurrentActiveRoomsWithBookingId,
} from '../controllers/bookingController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const BookingRouter = express.Router();

BookingRouter.post('/create', createBooking);
BookingRouter.get('/get-book-timeSlots-by-room/:room/:date', getBookedTimeSlotsByRoom);
BookingRouter.get('/get-booking-by-orderCode/:orderCode/', getBookedByOrderCode);
BookingRouter.get('/get-booking-by-id/:_id/', getBookedById);
BookingRouter.get('/get-all-booking-by-email', authMiddleware, getBookedByEmail);
BookingRouter.get('/get-booking-by-email-current', authMiddleware, getBookedByEmailCurrent);
BookingRouter.get('/get-booking-stats-by-email', authMiddleware, getBookingStatsByEmail);
BookingRouter.get('/get-booking-by-email-and-month/:month/:year', authMiddleware, getBookedByEmailAndMonth);
BookingRouter.get('/get-room-booking-current', getCurrentActiveRoomsWithBookingId);
BookingRouter.get('/get-all-booking', getAllBookings);
BookingRouter.get('/get-all-booking-by-date', getBookingsByDate);
BookingRouter.get('/get-all-booking-by-month', getBookingsByMonth);

BookingRouter.put('/edit/:_id/', editBooking);

// BookingRouter.get('/get/:_id', getBranchById);
// BookingRouter.put('/edit/:_id', editBranch);
// BookingRouter.delete('/delete/:_id', deleteBranch);

export default BookingRouter;
