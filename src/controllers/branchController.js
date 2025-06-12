import branchModel from '../models/branchModel.js';
import roomTypeModel from '../models/roomTypeModel.js';
import roomModel from '../models/roomModel.js';
import { formatString } from '../services/formatString.js';

export const createBranch = async (req, res) => {
    let { name, address, phone } = req.body;
    if (!name || !address || !phone)
        return res.status(400).json({ success: false, message: 'Hãy nhập đẩy đủ các trường' });

    try {
        name = formatString(name).toUpperCase();
        address = formatString(address);
        phone = formatString(phone);

        const existingBranch = await branchModel.findOne({ name });
        if (existingBranch) return res.status(400).json({ success: false, message: 'Phim này đã tồn tại' });

        const allRoomTypes = await roomTypeModel.find({}, '_id'); // chỉ lấy trường _id
        const typeRoomIds = allRoomTypes.map((rt) => rt._id);

        const newBranch = await branchModel.create({
            name,
            address,
            phone,
            typeRoom: typeRoomIds,
        });

        await newBranch.save();
        return res.status(200).json({ success: true, message: 'Thêm cơ sở mới thành công', data: newBranch });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// export const getAllBranch = async (req, res) => {
//     try {
//         const branches = await branchModel.find({}).populate('typeRoom');

//         if (branches.length === 0)
//             return res.status(400).json({ success: false, message: 'Không có cơ sở nào trong cơ sở dữ liệu' });

//         return res.status(200).json({
//             success: true,
//             data: branches,
//         });
//     } catch (error) {
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

export const getAllBranch = async (req, res) => {
    try {
        const branches = await branchModel.find({}).populate('typeRoom').lean(); // cần .lean() để chỉnh sửa object trả về

        const allRooms = await roomModel.find({}).populate('type').lean();

        // Gắn rooms vào từng branch
        const branchesWithRooms = branches.map((branch) => {
            const roomsInBranch = allRooms
                .filter((room) => room.branch.toString() === branch._id.toString())
                .sort((a, b) => {
                    const numA = parseInt(a.name, 10);
                    const numB = parseInt(b.name, 10);
                    return numA - numB;
                });
            return {
                ...branch,
                rooms: roomsInBranch,
            };
        });

        return res.status(200).json({
            success: true,
            data: branchesWithRooms,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getBranchById = async (req, res) => {
    try {
        const { _id } = req.params;

        const branch = await branchModel.findOne({ _id }).populate('typeRoom');
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
