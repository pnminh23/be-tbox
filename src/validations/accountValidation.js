import Joi from 'joi';

export const accountValidation = (data) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(30).required(),
        phone: Joi.string()
            .pattern(/^[0-9]{10,11}$/) // Phone phải từ 10-11 chữ số
            .required()
            .messages({
                'string.pattern.base': 'Số điện thoại không hợp lệ',
            }),
        email: Joi.string()
            .email({ tlds: { allow: false } })
            .required(),
        password: Joi.string()
            .min(8)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z]).{8,}$')) // ít nhất 1 thường, 1 hoa
            .required()
            .messages({
                'string.pattern.base': 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ thường',
            }),
    });

    return schema.validate(data);
};
