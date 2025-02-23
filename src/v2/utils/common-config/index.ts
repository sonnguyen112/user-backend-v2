import dotenv from 'dotenv';
import { validateEnvironmentVariables } from './utils';

dotenv.config();
validateEnvironmentVariables();

export const DATABASE_GATEWAY_ORIGIN = process.env.DATABASE_GATEWAY_ORIGIN || '';
export const DISABLE_ROLE_VERIFICATION = process.env.DISABLE_ROLE_VERIFICATION === 'true';
export const JWT_SECRET = process.env.JWT_SECRET || '';
export const SESSION_SECRET = process.env.SESSION_SECRET || '';
export const SESSION_SECRET_ALTERNATIVE = process.env.SESSION_SECRET_ALTERNATIVE || '';
export const CMS_MANAGER_ORIGIN = process.env.CMS_MANAGER_ORIGIN || '';
export const CMS_MANAGER_SIGNATURE = process.env.CMS_MANAGER_SIGNATURE || '';
export const SENDER_EMAIL = process.env.SENDER_EMAIL || '';
export const EMAIL_SERVICE_ORIGIN = process.env.EMAIL_SERVICE_ORIGIN || '';
export const SHOW_DEBUG = process.env.SHOW_DEBUG === 'true';
export const ADMIN_USERNAME_LIST = process.env.ADMIN_USERNAME_LIST || '';
