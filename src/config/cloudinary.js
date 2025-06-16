// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình storage cho multer-storage-cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'pnm-box-images', // Tên thư mục trên Cloudinary bạn muốn lưu ảnh vào
        allowed_formats: ['jpg', 'png', 'jpeg'], // Các định dạng cho phép
    },
});

const uploader = multer({ storage: storage });

export { cloudinary, uploader };
