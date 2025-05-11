import express from 'express';
import {
    createBranch,
    deleteBranch,
    editBranch,
    getAllBranch,
    getBranchById,
} from '../controllers/branchController.js';
const BranchRouter = express.Router();

BranchRouter.post('/create', createBranch);
BranchRouter.get('/get-all', getAllBranch);
BranchRouter.get('/get/:_id', getBranchById);
BranchRouter.put('/edit/:_id', editBranch);
BranchRouter.delete('/delete/:_id', deleteBranch);

export default BranchRouter;
