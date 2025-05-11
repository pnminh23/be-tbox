import branchModel from '../models/branchModel.js';
import { formatString } from '../services/formatString.js';

export const createBranch = async (req, res) => {
    const { name, address, phone, typeRoom } = req.body;
    if (!name || !address || !phone || !typeRoom)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

    try {
        const existingBranch = await branchModel.findOne({ name });
        if (existingBranch) return res.status(400).json({ success: false, message: 'Phim này đã tồn tại' });

        const newBranch = await branchModel.create({
            name: formatString(name),
            address: formatString(address),
            phone: formatString(phone),
            typeRoom,
        });

        await newBranch.save();
        return res.status(200).json({ success: true, message: 'Thêm cơ sở mới thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAllBranch = async (req, res) => {
    try {
        const branches = await branchModel.find({}).populate('typeRoom');

        if (branches.length === 0)
            return res.status(400).json({ success: false, message: 'Không có cơ sở nào trong cơ sở dữ liệu' });

        return res.status(200).json({
            success: true,
            data: branches,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getBranchById = async (req, res) => {
    try {
        const { _id } = req.params;

        const branch = await branchModel.findOne({ _id });

        if (!branch) {
            return res.status(400).json({ success: false, message: 'Không có cơ sở này trong cơ sở dữ liệu' });
        }

        return res.status(200).json({
            success: true,
            data: branch,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const editBranch = async (req, res) => {
    try {
        const { _id } = req.params;
        const { name, phone, address, typeRoom } = req.body;
        const branch = await branchModel.findOne({ _id });

        if (!branch) {
            return res.status(400).json({ success: false, message: 'Không có cơ sở này trong cơ sở dữ liệu' });
        }

        if (name) branch.name = formatString(name).toUpperCase();
        if (phone) branch.phone = formatString(phone);
        if (address) branch.address = formatString(address);

        if (Array.isArray(typeRoom)) {
            branch.typeRoom = typeRoom;
        }

        await branch.save();

        return res.status(200).json({
            success: true,
            message: `Cập nhật cơ sở ${branch.name} thành công`,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteBranch = async (req, res) => {
    try {
        const { _id } = req.params;
        const branch = await branchModel.findOne({ _id });
        if (!branch) {
            return res.status(400).json({ success: false, message: 'Cơ sở này không tồn tại' });
        }
        const result = await branchModel.deleteOne({ _id });

        return res.status(200).json({ success: true, message: 'Xóa cơ sở thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
