import axios from 'axios';
import { PAYOS_CONFIG, createChecksum } from '../config/payos.js';

export const createPayment = async (order) => {
    const body = {
        orderCode: order._id,
        amount: order.totalMoney,
        description: order.description,
        returnUrl: order.returnUrl,
        cancelUrl: order.cancelUrl,
    };

    const headers = {
        'Content-Type': 'application/json',
        'x-client-id': PAYOS_CONFIG.clientId,
        'x-api-key': PAYOS_CONFIG.apiKey,
        'x-checksum': createChecksum(body),
    };

    const res = await axios.post('/create-payment-link', body, { headers });
    return res.data;
};

export const getPaymentStatus = async (orderCode) => {
    const headers = {
        'x-client-id': PAYOS_CONFIG.clientId,
        'x-api-key': PAYOS_CONFIG.apiKey,
    };

    const res = await axios.get(`https://api.payos.vn/v1/payment-requests/${orderCode}`, { headers });
    return res.data;
};
