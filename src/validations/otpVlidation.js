import Joi from 'joi';

export const validateOTP = (data) => {
    const schema = Joi.object({
        userId: Joi.string().required(),
        verifyOTP: Joi.string().length(6).required(),
        verifyOTPExpireAt: Joi.number().required(),
    });

    return schema.validate(data);
};
