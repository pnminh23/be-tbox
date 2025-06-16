import bookingModel from '../models/bookingModel.js';
import comboModel from '../models/comboModel.js';
import promotionModel from '../models/promotionModel.js';
import roomModel from '../models/roomModel.js';
import timeSlotModel from '../models/timeSlotModel.js';
import transporter from '../config/nodemailer.js';
import mongoose from 'mongoose';
import { formatString } from '../services/formatString.js';
import { generateBookingId } from '../services/booking.js';
import { generateMailBooking } from '../services/generateEmail.js';
import accountModel from '../models/accountModel.js';
import dayjs from 'dayjs';

export const createBooking = async (req, res) => {
    const { name_client, email, phone, room, date, time_slots, film, promotion, status, isPay, combo } = req.body;
    if (!name_client) return res.status(400).json({ success: false, message: 'Chưa có tên khách hàng' });
    if (!email) return res.status(400).json({ success: false, message: 'Chưa có email' });
    if (!phone) return res.status(400).json({ success: false, message: 'Chưa có số điện thoại' });
    if (!room) return res.status(400).json({ success: false, message: 'Chưa có mã phòng' });
    if (!date) return res.status(400).json({ success: false, message: 'Chưa có ngày đặt phòng' });
    if (!time_slots) return res.status(400).json({ success: false, message: 'Chưa có khung giờ' });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const id_booking = await generateBookingId(date);

        const existingBooking = await bookingModel.findOne({
            room: room,
            time_slots: { $in: time_slots },
            status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH'] },
            date: { $gte: startOfDay, $lte: endOfDay },
        });
        if (existingBooking) return res.status(400).json({ success: false, message: 'Đã có người đặt!' });

        // 1. Lấy thông tin phòng để lấy typeRoom
        const roomInfo = await roomModel.findById(room).populate('type');
        if (!roomInfo) return res.status(404).json({ success: false, message: 'Phòng không tồn tại' });
        if (!roomInfo.type)
            return res.status(400).json({ success: false, message: 'Phòng chưa gán loại phòng (type)' });

        const pricePerMinute = roomInfo.type.base_price_per_minute;

        const selectedtimeSlots = await timeSlotModel.find({ _id: { $in: time_slots } }).sort({ start_time: 1 });
        const totalMinutes = selectedtimeSlots.reduce((acc, slot) => acc + slot.slot_duration, 0);

        for (let i = 0; i < selectedtimeSlots.length - 1; i++) {
            const currentEnd = selectedtimeSlots[i].end_time;
            const nextStart = selectedtimeSlots[i + 1].start_time;

            if (currentEnd !== nextStart) {
                return res.status(400).json({
                    success: false,
                    message: 'Các khung giờ phải liên tiếp nhau (không được ngắt quãng)',
                });
            }
        }

        let discountPercent = 0;
        if (promotion) {
            const promo = await promotionModel.findOne({ name: promotion });
            if (promo) discountPercent = promo.discountPercent || 0;
            else
                return res.status(400).json({
                    success: false,
                    message: 'Mã giảm giá không hợp lệ',
                });
        }

        let total_money = 0;

        if (combo) {
            const comboInfo = await comboModel.findById(combo);
            if (!comboInfo) return res.status(404).json({ success: false, message: 'Combo không tồn tại' });

            const matchedType = comboInfo.types.find(
                (type) => type.typeRoom.toString() === roomInfo.type._id.toString()
            );

            if (!matchedType)
                return res.status(400).json({ success: false, message: 'Combo không áp dụng cho loại phòng này' });

            if (comboInfo.duration !== totalMinutes) {
                return res.status(400).json({
                    success: false,
                    message: `Combo yêu cầu tổng thời lượng ${comboInfo.duration} phút, nhưng bạn chọn ${totalMinutes} phút.`,
                });
            }

            total_money = matchedType.price * (1 - discountPercent / 100);
        } else {
            // Tính theo thời lượng và đơn giá
            total_money = pricePerMinute * totalMinutes * (1 - discountPercent / 100);
        }

        const cleanedPromotion = promotion === '' ? null : promotion;
        const cleanedCombo = combo === '' ? null : combo;

        // 5. Tạo booking
        const newBooking = await bookingModel.create({
            id_booking,
            name_client,
            film,
            email,
            phone,
            room,
            date,
            time_slots,
            promotion: cleanedPromotion,
            status,
            isPay,
            total_money,
            payment_amount: total_money,
            combo: cleanedCombo,
        });

        if (total_money > 150000) {
            newBooking.status = 'CHỜ THANH TOÁN';
            await newBooking.save();
        }

        let query = bookingModel
            .findById(newBooking._id)
            .populate({
                path: 'room',
                populate: { path: 'type branch' },
            })
            .populate('time_slots')
            .populate('film');

        if (newBooking.combo) {
            query = query.populate({ path: 'combo' });
        }

        const result = await query;

        try {
            const mailOptions = generateMailBooking({
                to: email,
                subject: 'Đặt phòng PNM - BOX',
                title: 'Cảm ơn bạn đã đặt phòng',
                message: 'Bạn đã đặt phòng thành công. Dưới đây là thông tin chi tiết',
                booking: result,
            });

            // console.log('✅ mailOptions:', mailOptions); // Xem thử có gì bên trong
            await transporter.sendMail(mailOptions);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: `Lỗi gửi email`,
            });
        }

        if (total_money > 150000) {
            return res.status(200).json({
                success: true,
                paymentRequired: true,
                message: `Đơn hàng của bạn là ${result.total_money} cần thanh toán ${
                    result.total_money / 2
                } để hoàn tất đặt phòng`,
                money: result.total_money / 2,
                data: result,
            });
        }

        req.io.emit('newBooking', newBooking);
        // console.log(newBooking);

        return res.status(200).json({ message: 'Đặt phòng thành công! Email đã được gửi đến bạn', data: result });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

export const getBookedTimeSlotsByRoom = async (req, res) => {
    const { room, date } = req.params;

    if (!room || !date) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp room và date' });
    }

    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await bookingModel
            .find({
                room: room,
                date: { $gte: startOfDay, $lte: endOfDay },
                status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH', 'CHỜ THANH TOÁN'] },
            })
            .populate('time_slots');

        const bookedTimeSlots = [];
        bookings.forEach((booking) => {
            booking.time_slots.forEach((slot) => {
                bookedTimeSlots.push(slot._id);
            });
        });

        return res.status(200).json({
            success: true,
            data: {
                room: room,
                bookedTimeSlots,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookedByOrderCode = async (req, res) => {
    const { orderCode } = req.params;

    if (!orderCode) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp orderCode' });
    }

    try {
        let booking = await bookingModel
            .findOne({ orderCode })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        if (booking.combo) {
            booking = await booking.populate('combo');
        }

        return res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookedByEmail = async (req, res) => {
    const { accountId } = req.body;
    const user = await accountModel.findById({ _id: accountId });
    const email = user.email;

    if (!accountId) {
        return res.status(400).json({ success: false, message: 'Không có tài khoản' });
    }

    try {
        let booking = await bookingModel
            .find({ email })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        if (booking.combo) {
            booking = await booking.populate('combo');
        }

        return res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getCurrentActiveRoomsWithBookingId = async (req, res) => {
    try {
        const now = dayjs();
        const todayStart = now.startOf('day').toDate();
        const todayEnd = now.endOf('day').toDate();

        // Tìm các booking trong ngày hôm nay có trạng thái thành công hoặc hoàn thành
        const bookings = await bookingModel
            .find({
                date: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH'] },
            })
            .populate('time_slots')
            .populate('room');

        const currentTime = now.format('HH:mm');
        const activeRooms = [];

        bookings.forEach((booking) => {
            const isActive = booking.time_slots.some((slot) => {
                return currentTime >= slot.start_time && currentTime < slot.end_time;
            });

            if (isActive) {
                activeRooms.push({
                    roomId: booking.room._id,
                    bookingId: booking._id,
                });
            }
        });

        return res.status(200).json({
            success: true,
            data: activeRooms,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi',
            error: error.message,
        });
    }
};

export const getBookedById = async (req, res) => {
    const { _id } = req.params;

    if (!_id) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp _id' });
    }

    try {
        let booking = await bookingModel
            .findOne({ _id })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        if (booking.combo) {
            booking = await booking.populate('combo');
        }

        return res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookedByEmailCurrent = async (req, res) => {
    const { accountId } = req.body;

    const user = await accountModel.findById({ _id: accountId });
    const email = user.email;

    if (!accountId) {
        return res.status(400).json({ success: false, message: 'Không có tài khoản' });
    }

    try {
        const todayStart = dayjs().startOf('day').toDate(); // 00:00 hôm nay
        const todayEnd = dayjs().endOf('day').toDate(); // 23:59:59 hôm nay
        let bookings = await bookingModel
            .find({ email, date: { $gte: todayStart, $lte: todayEnd } })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film')
            .sort({ createdAt: -1 });

        if (!bookings) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy s' });
        }

        if (bookings.combo) {
            bookings = await bookings.populate('combo');
        }

        // console.log('bookings: ', bookings);
        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ success: false, message: 'Không có đơn đặt nào chưa hoàn thành' });
        }

        return res.status(200).json({
            success: true,
            data: bookings,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookedByEmailAndMonth = async (req, res) => {
    const { accountId } = req.body;
    if (!accountId) {
        return res.status(400).json({ success: false, message: 'Không có tài khoản' });
    }
    const { month, year } = req.params; // ví dụ: month=5, year=2025

    if (!month || !year) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp email, month và year' });
    }
    const user = await accountModel.findById({ _id: accountId });
    const email = user.email;

    try {
        const monthInt = parseInt(month);
        const yearInt = parseInt(year);

        // Lấy ngày đầu và cuối tháng
        const startDate = new Date(yearInt, monthInt - 1, 1); // tháng trong JS tính từ 0
        const endDate = new Date(yearInt, monthInt, 0, 23, 59, 59, 999); // ngày cuối cùng của tháng

        const bookings = await bookingModel
            .find({
                email,
                date: { $gte: startDate, $lte: endDate },
            })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film');
        if (!bookings) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy s' });
        }

        if (bookings.combo) {
            bookings = await bookings.populate('combo');
        }

        if (!bookings.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn nào trong tháng' });
        }

        return res.status(200).json({
            success: true,
            data: bookings,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getAllBookings = async (req, res) => {
    try {
        const bookings = await bookingModel
            .find({})
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film')
            .sort({ createdAt: -1 });
        if (!bookings) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        if (bookings.combo) {
            bookings = await bookings.populate('combo');
        }

        if (!bookings.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn nào trong tháng' });
        }

        return res.status(200).json({
            success: true,
            data: bookings,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const editBooking = async (req, res) => {
    const { _id } = req.params;
    const { isPay, status } = req.body;

    if (!_id) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp _id của đơn đặt' });
    }

    try {
        const bookingToUpdate = await bookingModel.findById(_id);
        if (!bookingToUpdate) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đặt phòng' });
        }

        // Cập nhật các trường nếu chúng được cung cấp trong request body
        if (isPay) {
            bookingToUpdate.isPay = formatString(isPay).toUpperCase();
        }
        if (status) {
            bookingToUpdate.status = formatString(status).toUpperCase();
        }

        // Lưu lại booking đã được cập nhật
        const updatedBooking = await bookingToUpdate.save();

        // --- Bắt đầu xây dựng query để populate dữ liệu ---

        // 1. Bắt đầu query với các trường luôn có
        let query = bookingModel
            .findById(updatedBooking._id)
            .populate({
                path: 'room',
                populate: { path: 'type branch' },
            })
            .populate('time_slots')
            .populate('film');

        // 3. Populate có điều kiện cho combo
        if (updatedBooking.combo) {
            query = query.populate('combo');
        }

        // 4. Thực thi query sau khi đã xây dựng xong
        const populatedBooking = await query;

        // Gửi sự kiện socket tới tất cả client
        req.io.emit('editBooking', populatedBooking);

        return res.status(200).json({
            success: true,
            message: 'Cập nhật đơn đặt phòng thành công',
            data: populatedBooking,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookingsByDate = async (req, res) => {
    try {
        const { date } = req.query; // Định dạng: YYYY-MM-DD
        if (!date) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày' });

        const start = dayjs(date).startOf('day').toDate();
        const end = dayjs(date).endOf('day').toDate();

        const bookings = await bookingModel
            .find({ date: { $gte: start, $lte: end } })
            .populate('room')
            .populate('time_slots')
            .sort({ createdAt: -1 });

        // 3. Populate có điều kiện cho combo
        if (bookings.combo) {
            bookings = await bookings.populate('combo');
        }

        return res.status(200).json({ success: true, data: bookings });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookingsByMonth = async (req, res) => {
    try {
        const { month } = req.query; // Định dạng: YYYY-MM
        if (!month) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tháng' });

        const start = dayjs(month).startOf('month').toDate();
        const end = dayjs(month).endOf('month').toDate();

        const bookings = await bookingModel
            .find({ date: { $gte: start, $lte: end } })
            .populate('room')
            .populate('time_slots')
            .sort({ createdAt: -1 });

        // 3. Populate có điều kiện cho combo
        if (bookings.combo) {
            bookings = await bookings.populate('combo');
        }

        return res.status(200).json({ success: true, data: bookings });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

export const getBookingStatsByEmail = async (req, res) => {
    const { accountId } = req.body;

    const user = await accountModel.findById({ _id: accountId });
    const email = user.email;
    // console.log('user: ', user);
    // console.log('email: ', email);

    if (!accountId) {
        return res.status(400).json({ success: false, message: 'Không có tài khoản' });
    }

    try {
        const todayStart = dayjs().startOf('day').toDate(); // 00:00 hôm nay
        const todayEnd = dayjs().endOf('day').toDate(); // 23:59:59 hôm nay

        const totalBooking = await bookingModel.countDocuments({
            email,
        });

        // Tổng số đơn hôm nay của user
        const totalBookingsToday = await bookingModel.countDocuments({
            email,
            date: { $gte: todayStart, $lte: todayEnd },
        });
        // console.log('totalBookingsToday: ', totalBookingsToday);

        const completedBookingsToday = await bookingModel.countDocuments({
            email,
            status: 'HOÀN THÀNH',
        });

        const cancelledBookingsToday = await bookingModel.countDocuments({
            email,
            status: 'HỦY',
        });

        return res.status(200).json({
            success: true,
            data: {
                totalBooking,
                totalBookingsToday,
                completedBookingsToday,
                cancelledBookingsToday,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi thống kê đơn hàng hôm nay',
            error: error.message,
        });
    }
};
