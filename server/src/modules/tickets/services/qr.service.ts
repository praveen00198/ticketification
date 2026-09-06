import QRCode from 'qrcode';
import crypto from 'crypto';
import config from '../../../config/env';

export class QrService {
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async generateQrDataUrl(verificationToken: string): Promise<string> {
    const baseUrl = config.env.appUrl || 'https://ticketification.vercel.app';
    const verifyUrl = `${baseUrl.replace(/\/+$/, '')}/verify/${verificationToken}`;
    return QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 3,
      width: 400,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }
}

export const qrService = new QrService();
