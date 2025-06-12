import express from 'express';
import { createReview, getReviewByBranch } from '../controllers/reviewController.js';

const ReviewRouter = express.Router();

ReviewRouter.post('/create', createReview);
ReviewRouter.get('/get-by-branch/:branchId', getReviewByBranch);

export default ReviewRouter;
