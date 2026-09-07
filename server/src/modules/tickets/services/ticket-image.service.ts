import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import config from '../../../config/env';

export interface TicketImageData {
  ticketId: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  ticketType: string;
  qrCodeDataUrl: string;
  organization?: string;
  phone?: string;
}

/**
 * Generates a high-resolution PNG ticket image using Puppeteer.
 * The image is designed to be sent via WhatsApp as a scannable ticket card.
 * Produces an 800x1200 pixel PNG with embedded QR code.
 */
export class TicketImageService {
  private templateBase64: string | null = null;

  constructor() {
    this.loadTemplate();
  }

  private loadTemplate() {
    const candidates = [
      path.resolve(__dirname, '../../../../assets/ticket_template.png'),
      path.resolve(__dirname, '../../../assets/ticket_template.png'),
      path.resolve(__dirname, '../../assets/ticket_template.png'),
      path.resolve(__dirname, '../assets/ticket_template.png'),
      path.resolve(process.cwd(), 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'server', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), '../client', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'client', 'assets', 'ticket_template.png'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          this.templateBase64 = `data:image/png;base64,${buf.toString('base64')}`;
          break;
        } catch (e) {
          console.warn('[TicketImageService] Could not load template from:', p, e);
        }
      }
    }
  }

  private buildHtml(data: TicketImageData): string {
    const bgStyle = this.templateBase64
      ? `background-image: url('${this.templateBase64}'); background-size: 1620px 2025px; background-position: center; background-repeat: no-repeat;`
      : `background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);`;

    return `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Mukta:wght@600;700;800&family=Noto+Sans+Devanagari:wght@600;700;800;900&family=Hind:wght@600;700&family=Poppins:wght@600;700;800&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          width: 1620px;
          height: 2025px;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: #000;
          -webkit-print-color-adjust: exact;
        }
        .invitation-container {
          width: 1620px;
          height: 2025px;
          position: relative;
          ${bgStyle}
        }
        .content-wrapper {
          position: absolute;
          top: 960px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 1200px;
        }
        .qr-card {
          background: #FFFFFF;
          padding: 16px;
          border-radius: 24px;
          border: 4px solid #FCD34D;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
          display: inline-block;
        }
        .qr-img {
          width: 380px;
          height: 380px;
          display: block;
          border-radius: 12px;
        }
        .guest-name-box {
          margin-top: 38px;
          text-align: center;
          width: 100%;
          max-width: 1100px;
        }
        .guest-name {
          font-family: 'Noto Sans Devanagari', 'Mukta', 'Hind', 'Poppins', sans-serif;
          font-size: 72px;
          font-weight: 800;
          color: #FFE680;
          letter-spacing: 1px;
          line-height: 1.35;
          text-shadow: 0 4px 12px rgba(0, 0, 0, 0.9), 0 0 22px rgba(252, 211, 77, 0.45);
        }
      </style>
    </head>
    <body>
      <div class="invitation-container">
        <div class="content-wrapper">
          <div class="qr-card">
            <img src="${data.qrCodeDataUrl}" class="qr-img" alt="QR Code" />
          </div>
          <div class="guest-name-box">
            <div class="guest-name">${data.guestName}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  public buildSvg(data: TicketImageData): string {
    const bgImage = this.templateBase64
      ? `<image href="${this.templateBase64}" width="1620" height="2025" preserveAspectRatio="none"/>`
      : `<rect width="1620" height="2025" fill="#7f1d1d"/>`;

    const safeGuestName = (data.guestName || 'Guest')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 2025" width="1620" height="2025">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Mukta:wght@700;800&amp;family=Noto+Sans+Devanagari:wght@700;800;900&amp;display=swap');
      .guest-text {
        font-family: 'Noto Sans Devanagari', 'Mukta', 'Hind', sans-serif;
        font-size: 72px;
        font-weight: 800;
        fill: #FFE680;
        text-anchor: middle;
        filter: drop-shadow(0px 4px 10px rgba(0,0,0,0.9));
      }
    </style>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-opacity="0.5"/>
    </filter>
  </defs>

  ${bgImage}

  <!-- QR White Card -->
  <g transform="translate(604, 960)">
    <rect width="412" height="412" rx="24" fill="#FFFFFF" stroke="#FCD34D" stroke-width="4" filter="url(#card-shadow)"/>
    <image href="${data.qrCodeDataUrl}" x="16" y="16" width="380" height="380"/>
  </g>

  <!-- Guest Name -->
  <text x="810" y="1485" class="guest-text">${safeGuestName}</text>
</svg>`;
  }

  /**
   * Generate an in-memory high-resolution vector SVG ticket asset.
   * Runs in microseconds without disk I/O or external browser processes.
   */
  async generateTicketImage(data: TicketImageData): Promise<{ svg: string; imageBase64: string; fileName: string }> {
    const fileName = `ticket-${data.ticketId}.svg`;
    const svg = this.buildSvg(data);
    const imageBase64 = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return { svg, imageBase64, fileName };
  }
}

export const ticketImageService = new TicketImageService();

