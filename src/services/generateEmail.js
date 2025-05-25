export function generateMailBooking({ to, subject, title, message, booking }) {
    const lastTimeSlot = booking.time_slots.at(-1);
    return {
        from: 'PNM - BOX Cafe phim',
        to,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #F3B817; text-align: center;">${title}</h2>
        <p style="font-size: 16px; color: #333;">${message}</p>

        <div style="background: #f9f9f9; padding: 15px; font-size: 16px; font-weight: normal; border-radius: 5px;">
          <p><strong>Mã hóa đơn:</strong> ${booking.id_booking}</p>
          <p><strong>Họ và tên:</strong> ${booking.name_client}</p>
          <p><strong>Số điện thoại:</strong> ${booking.phone}</p>
          <p><strong>Ngày đặt phòng:</strong> ${booking.date}</p>
          <p><strong>Phim:</strong> ${booking.film?.name || 'Không có'}</p>
          <p><strong>Cơ sở:</strong> ${booking.room?.branch?.name || 'Không xác định'}</p>
          <p><strong>Loại phòng:</strong> ${booking.room?.type?.name || 'Không xác định'}</p>
          <p><strong>Phòng:</strong> ${booking.room.name}</p>
          <p><strong>Combo:</strong> ${booking.combo?.name || 'Không có'}</p>
          <p><strong>Giờ bắt đầu:</strong> ${booking.time_slots[0]?.start_time}</p>
          <p><strong>Giờ kết thúc:</strong> ${lastTimeSlot?.end_time}</p>
          <p><strong>Mã giảm giá:</strong> ${booking.promotion?.name || 'Không áp dụng'}</p>
          <p><strong>Tổng tiền:</strong> ${booking.total_money.toLocaleString('vi-VN', {
              style: 'currency',
              currency: 'VND',
          })}</p>
          <p><strong>Trạng thái:</strong> ${booking.isPay}</p>
        </div>


      </div>
        `,
    };
}
