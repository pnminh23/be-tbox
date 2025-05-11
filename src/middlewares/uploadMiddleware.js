import multer from 'multer';
import path from 'path';
import fs from 'fs';

const createUploadMiddleware = (folderName, identifierKey = 'email') => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            const uploadPath = path.join('uploads', folderName);

            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }

            cb(null, uploadPath);
        },
        filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);

            let identifier = req.body[identifierKey] || req.query[identifierKey] || 'unknown';

            // Replace ký tự không hợp lệ trong filename
            identifier = identifier.replace(/[^a-zA-Z0-9]/g, '_');

            if (!req.fileIndexMap) req.fileIndexMap = {};
            if (!req.fileIndexMap[identifier]) req.fileIndexMap[identifier] = 1;
            const index = req.fileIndexMap[identifier]++;

            const filename = `${folderName}_${identifier}_${index}${ext}`;

            cb(null, filename);
        },
    });

    return multer({ storage });
};

export { createUploadMiddleware };
