// services/cronJobs.js

import cron from "node-cron";
import dayjs from "dayjs";
import bookingModel from "../models/bookingModel.js";

// Sửa hàm để nhận `io` làm tham số
const cancelExpiredBookings = async (io) => {
  // console.log('Running cron job to cancel expired bookings...');
  try {
    const expirationTime = dayjs().subtract(15, "minute").toDate(); // Nên để 15 phút cho khớp với PayOS

    // 1. Tìm tất cả booking cần hủy
    const expiredBookings = await bookingModel
      .find({
        status: "CHỜ THANH TOÁN",
        createdAt: { $lt: expirationTime },
      })
      .populate({
        // Populate ngay lúc tìm kiếm
        path: "room",
        populate: { path: "type branch" },
      })
      .populate("time_slots")
      .populate("film")
      .populate("combo"); // Populate combo nếu có

    if (expiredBookings.length > 0) {
      const idsToCancel = expiredBookings.map((b) => b._id);

      // 2. Cập nhật trạng thái của chúng trong DB
      await bookingModel.updateMany(
        { _id: { $in: idsToCancel } },
        { $set: { status: "THẤT BẠI" } }
      );

      // 3. Lặp qua các booking vừa tìm được và gửi socket cho từng cái
      for (const booking of expiredBookings) {
        // Cập nhật trạng thái trong object để gửi đi cho đúng
        booking.status = "THẤT BẠI";

        // Dùng `io` đã được truyền vào để gửi sự kiện
        io.emit("editBooking", booking);
      }
    }
  } catch (error) {
    console.error("Error in cron job:", error);
  }
};

// Sửa hàm start để nhận `io` và truyền nó đi
export const startBookingCleanupJob = (io) => {
  // Chạy hàm cancelExpiredBookings mỗi phút, truyền `io` vào
  cron.schedule("* * * * *", () => cancelExpiredBookings(io));
};
