import cloudinary from 'cloudinary';
import { env } from '../config/enviroment.js';

cloudinary.config({
    cloud_name: 'dphcnr6ld',
    api_key: '332881657232433',
    api_secret: 'KhkQ_pEJpzSmnM-FgEfahG9q3_s',
});

cloudinary.api.ping((error, result) => {
    if (error) {
        console.error('Cloudinary connection failed:', error);
    } else {
        console.log('Cloudinary connection successful:', result);
    }
});

export default cloudinary;
