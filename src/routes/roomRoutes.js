import express from 'express';
import { createRoom, deleteRoom, editRoom, getRoom, getRoomByBranchId } from '../controllers/roomController.js';
import { createUploadMiddleware } from '../middlewares/uploadMiddleware.js';
import { createRoomType, deleteRoomType, getAllRoomType } from '../controllers/roomTypeController.js';
const RoomRouter = express.Router();
const upload = createUploadMiddleware('rooms', 'name');

RoomRouter.post('/create-room', upload.single('image'), createRoom);
RoomRouter.post('/create-roomType', createRoomType);
RoomRouter.get('/get-all-roomType', getAllRoomType);
RoomRouter.get('/get-room/:branch/:type', getRoom);
RoomRouter.get('/get-room-branch/:branch', getRoomByBranchId);
RoomRouter.put('/edit-room/:_id', upload.single('image'), editRoom);

RoomRouter.delete('/delete-room/:_id', deleteRoom);
RoomRouter.delete('/delete-roomType/:_id', deleteRoomType);

export default RoomRouter;
