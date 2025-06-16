import express from 'express';
import { createRoom, deleteRoom, editRoom, getRoom, getRoomByBranchId } from '../controllers/roomController.js';

import { createTypeRoom, deleteTypeRoom, editTypeRoom, getAllTypeRooms } from '../controllers/roomTypeController.js';
import { uploader } from '../config/cloudinary.js';

const RoomRouter = express.Router();

RoomRouter.post('/create-room', uploader.single('image'), createRoom);
RoomRouter.post('/create-roomType', createTypeRoom);
RoomRouter.get('/get-all-roomType', getAllTypeRooms);
RoomRouter.get('/get-room/:branch/:type', getRoom);
RoomRouter.get('/get-room-branch/:branch', getRoomByBranchId);
RoomRouter.put('/edit-room/:_id', uploader.single('image'), editRoom);
RoomRouter.put('/edit-type-room/:_id', editTypeRoom);

RoomRouter.delete('/delete-room/:_id', deleteRoom);
RoomRouter.delete('/delete-roomType/:_id', deleteTypeRoom);

export default RoomRouter;
