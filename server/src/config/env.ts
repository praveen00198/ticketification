import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  resendApiKey: string;
  emailFrom: string;
  appUrl: string;
  uploadDir: string;
  puppeteerHeadless: boolean;
  isProduction: boolean;
  // New variables for delivery provider selection and WhatsApp integration
  deliveryProvider: string;
  whatsappEnabled: boolean;
  whatsappMock: boolean;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappAccessToken: string;
  whatsappApiVersion: string;
  whatsappTicketTemplateName: string;
  whatsappTicketTemplateLanguage: string;
  whatsappWebhookVerifyToken: string;
  whatsappBatchSize: number;
  whatsappConcurrency: number;
  whatsappDelayMs: number;
}

function validateAndLoadEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'fallback_local_jwt_secret');
  
  if (isProduction && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production mode.');
  }

  if (isProduction && !process.env.MONGODB_URI) {
    throw new Error('FATAL: MONGODB_URI environment variable must be set in production mode.');
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '5000', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_ticket_db',
    jwtSecret: jwtSecret || 'fallback_local_jwt_secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    resendApiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'tickets@example.com',
    appUrl: process.env.APP_URL || 'http://localhost:5173',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',
    isProduction,
    // Delivery provider defaults to email; can be overridden to whatsapp
    deliveryProvider: process.env.DELIVERY_PROVIDER || 'email',
    whatsappEnabled: (process.env.WHATSAPP_ENABLED || 'true').toLowerCase() === 'true',
    whatsappMock: (process.env.WHATSAPP_MOCK || 'true').toLowerCase() === 'true',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    whatsappBusinessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    whatsappApiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    whatsappTicketTemplateName: process.env.WHATSAPP_TICKET_TEMPLATE_NAME || 'event_ticket',
    whatsappTicketTemplateLanguage: process.env.WHATSAPP_TICKET_TEMPLATE_LANGUAGE || 'en',
    whatsappWebhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'default_verify_token',
    whatsappBatchSize: parseInt(process.env.WHATSAPP_BATCH_SIZE || '20', 10),
    whatsappConcurrency: parseInt(process.env.WHATSAPP_CONCURRENCY || '5', 10),
    whatsappDelayMs: parseInt(process.env.WHATSAPP_DELAY_MS || '200', 10),
  };
}

export const config = {
  env: validateAndLoadEnv(),
};

export default config;
