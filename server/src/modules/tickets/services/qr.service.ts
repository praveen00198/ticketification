import QRCode from 'qrcode';
import crypto from 'crypto';
import config from '../../../config/env';

export class QrService {
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async generateQrDataUrl(verificationToken: string): Promise<string> {
    const verifyUrl = `${config.env.appUrl}/verify/${verificationToken}`;
    return QRCode.toDataURL(verifyUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 300,
      color: {
        dark: '#18181B',
        light: '#FFFFFF',
      },
    });
  }
}

export const qrService = new QrService();
