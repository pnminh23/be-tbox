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

export function generateMailOptions({ to, subject, title, message, otp }) {
    return {
        from: 'PNM - BOX Cafe phim',
        to,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #007BFF; text-align: center;">${title}</h2>
                <p style="font-size: 16px; color: #333;">${message}</p>
                <div style="background: #f3f3f3; padding: 10px; font-size: 20px; font-weight: bold; text-align: center; border-radius: 5px;">
                    ${otp}
                </div>
                <p style="font-size: 14px; color: #666;">Mã OTP này có hiệu lực trong <b>5 phút</b>.</p>
            </div>
        `,
    };
}

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
            const promo = await promotionModel.findById(promotion);
            if (promo) discountPercent = promo.discountPercent || 0;
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

        if (total_money > 300000) {
            return res.status(403).json({
                success: false,
                message: `Tổng tiền của bạn là ${total_money} cần thanh toán trước 50% để đặt phòng `,
            });
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
            combo: cleanedCombo,
        });

        let query = bookingModel
            .findById(newBooking._id)
            .populate({
                path: 'room',
                populate: { path: 'type branch' },
            })
            .populate('time_slots')
            .populate('film');

        if (newBooking.promotion) {
            query = query.populate('promotions');
        }

        if (newBooking.combo) {
            query = query.populate({ path: 'combo' });
        }

        const result = await query; // Nếu muốn lấy luôn chi tiết khung giờ

        // Broadcast event cho tất cả client

        // Broadcast event cho tất cả client
        try {
            const mailOptions = generateMailBooking({
                to: email,
                subject: 'Đặt phòng PNM - BOX',
                title: 'Cảm ơn bạn đã đặt phòng',
                message: 'Bạn đã đặt phòng thành công. Dưới đây là thông tin chi tiết',
                booking: result,
            });

            console.log('✅ mailOptions:', mailOptions); // Xem thử có gì bên trong
            await transporter.sendMail(mailOptions);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: `Lỗi gửi email`,
            });
        }
        req.io.emit('newBooking', newBooking);
        console.log(newBooking);

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
                status: { $in: ['THÀNH CÔNG', 'HOÀN THÀNH'] },
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

export const getBookedByID = async (req, res) => {
    const { id_booking } = req.params;

    if (!id_booking) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp id_booking' });
    }

    try {
        let booking = await bookingModel
            .findOne({ id_booking })
            .populate({
                path: 'room',
                populate: [{ path: 'type' }, { path: 'branch' }],
            })
            .populate('time_slots')
            .populate('film');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy booking' });
        }

        if (booking.promotion) {
            booking = await booking.populate('promotions');
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
export const editBooking = async (req, res) => {
    const { id_booking } = req.params;
    const { isPay, status } = req.body;
    const isPayFormat = formatString(isPay).toUpperCase();
    const statusFormat = formatString(status).toUpperCase();

    if (!id_booking) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp id_booking' });
    }

    try {
        const updatedBooking = await bookingModel.findOneAndUpdate(
            { id_booking },
            { isPay: isPayFormat, status: statusFormat },
            { new: true } // trả về bản ghi sau khi cập nhật
        );

        return res.status(200).json({
            success: true,
            message: 'Cập nhật đơn đặt phòng thành công',
            data: updatedBooking,
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
