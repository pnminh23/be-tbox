import PayOS from '@payos/node';
import { env } from './enviroment.js';

const payos = new PayOS(env.PAYOS_CLIENT_ID, env.PAYOS_API_KEY, env.PAYOS_CHECKSUM_KEY);

export default payos;
