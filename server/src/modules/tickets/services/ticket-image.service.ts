import puppeteer, { Browser, Page } from 'puppeteer';
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
  <text
    x="810"
    y="1490"
    text-anchor="middle"
    font-family="'Noto Sans Devanagari', 'Mukta', 'Hind', 'Poppins', Arial, sans-serif"
    font-size="76"
    font-weight="800"
    fill="#FFE680"
    stroke="#000000"
    stroke-width="1.5"
    paint-order="stroke fill"
    style="font-family: 'Noto Sans Devanagari', 'Mukta', 'Hind', 'Poppins', Arial, sans-serif; font-size: 76px; font-weight: 800; fill: #FFE680; text-anchor: middle;"
  >${safeGuestName}</text>
</svg>`;
  }

  /**
   * Launch a shared Puppeteer browser instance with headless flags optimized for high-performance rendering.
   */
  async launchBrowser(): Promise<Browser> {
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ];

    try {
      return await puppeteer.launch({
        headless: true,
        args: launchArgs,
      });
    } catch (err: any) {
      console.warn('[TicketImageService] Standard headless launch failed, trying fallback mode:', err?.message || err);
      return await puppeteer.launch({
        headless: 'shell',
        args: launchArgs,
      });
    }
  }

  /**
   * Converts SVG markup to a genuine PNG image buffer using Puppeteer.
   * Ensures output is a valid PNG binary with standard PNG header (0x89504E47).
   */
  async svgToPng(svg: string, sharedBrowser?: Browser): Promise<Buffer> {
    const ownBrowser = !sharedBrowser;
    const browser = sharedBrowser || (await this.launchBrowser());

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1620, height: 2025 });
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1620px; height: 2025px; overflow: hidden; background-color: #000; }</style></head><body>${svg}</body></html>`;
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.evaluateHandle('document.fonts.ready');
      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      await page.close();
      return Buffer.from(screenshot);
    } finally {
      if (ownBrowser && browser) {
        await browser.close();
      }
    }
  }

  /**
   * Fast rendering of SVG onto a pre-existing Puppeteer Page instance.
   * Reuses the open page rather than opening/closing browser tabs to achieve ~10-20ms conversion per image.
   */
  async renderSvgOnPage(svg: string, page: Page): Promise<Buffer> {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1620px; height: 2025px; overflow: hidden; background-color: #000; }</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    return Buffer.from(screenshot);
  }

  /**
   * Generate an in-memory high-resolution PNG ticket asset.
   */
  async generateTicketImage(
    data: TicketImageData,
    sharedBrowser?: Browser
  ): Promise<{ pngBuffer: Buffer; svg: string; imageBase64: string; fileName: string }> {
    const fileName = `ticket-${data.ticketId}.png`;
    const svg = this.buildSvg(data);
    const pngBuffer = await this.svgToPng(svg, sharedBrowser);
    const imageBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return { pngBuffer, svg, imageBase64, fileName };
  }
}

/**
 * Formats a clean, safe, and collision-resistant ticket download filename.
 * Pattern: <Guest-Name>-<Ticket-ID>.png (e.g. Rahul-Sharma-GAN-00001.png).
 * If guest name is missing or unassigned: <Ticket-ID>.png (e.g. GAN-00001.png).
 */
export function formatTicketFileName(guestName: string | null | undefined, ticketId: string): string {
  const cleanId = (ticketId || '00000').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!guestName || !guestName.trim()) {
    return `${cleanId}.png`;
  }

  const cleanName = guestName
    .replace(/[/\\?%*:|"<>.]+/g, ' ') // convert illegal chars, slashes, and traversal dots to spaces
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '') // strip any remaining unexpected characters
    .replace(/[\s_]+/g, '-') // replace whitespace & underscores with hyphens
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

  if (!cleanName || cleanName === '-' || cleanName.toLowerCase() === 'undefined' || cleanName.toLowerCase() === 'null') {
    return `${cleanId}.png`;
  }

  return `${cleanName}-${cleanId}.png`;
}

/**
 * Validates whether a given buffer has a standard 8-byte PNG header (89 50 4E 47 0D 0A 1A 0A).
 */
export function isPngBuffer(buf: Buffer | null | undefined): boolean {
  if (!buf || !Buffer.isBuffer(buf) || buf.length < 8) return false;
  return (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

export const ticketImageService = new TicketImageService();


