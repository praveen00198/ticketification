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
  private outputDir: string;
  private templateBase64: string | null = null;

  constructor() {
    this.outputDir = path.resolve(process.cwd(), config.env.uploadDir, 'tickets');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    this.loadTemplate();
  }

  private loadTemplate() {
    const candidates = [
      path.resolve(process.cwd(), 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), '../client/assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'client/assets', 'ticket_template.png'),
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

  /**
   * Generate a ticket image PNG and save it to disk.
   * Returns the absolute file path and public URL.
   */
  async generateTicketImage(data: TicketImageData): Promise<{ filePath: string; publicUrl: string }> {
    const fileName = `ticket-${data.ticketId}.png`;
    const filePath = path.join(this.outputDir, fileName);

    const html = this.buildHtml(data);

    try {
      const browser = await puppeteer.launch({
        headless: config.env.puppeteerHeadless ? 'shell' : false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
        ],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1620, height: 2025 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      await page.screenshot({ path: filePath, type: 'png', fullPage: true });
      await browser.close();
    } catch (error) {
      console.warn('[TicketImageService] Puppeteer failed, saving HTML fallback:', error);
      // Fallback: save HTML as file for debugging
      const htmlFallbackPath = path.join(this.outputDir, `ticket-${data.ticketId}.html`);
      fs.writeFileSync(htmlFallbackPath, html, 'utf-8');
    }

    // Construct public URL based on storage base URL (Render supplies RENDER_EXTERNAL_URL)
    const baseUrl =
      process.env.TICKET_STORAGE_BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `http://localhost:${config.env.port}`;
    const publicUrl = `${baseUrl}/uploads/tickets/${fileName}`;

    return { filePath, publicUrl };
  }
}

export const ticketImageService = new TicketImageService();

