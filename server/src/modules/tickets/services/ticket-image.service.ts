import puppeteer, { Browser, Page } from 'puppeteer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import config from '../../../config/env';
import { AppError } from '../../../middlewares/error.middleware';

// Disable libvips operation & buffer caching to prevent RSS retention across tickets in memory-constrained environments (Render 512MB)
sharp.cache(false);
// Limit internal thread pool to 1 thread per operation to avoid multi-threaded memory spikes
sharp.concurrency(1);

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
 * Generates a high-resolution PNG ticket image using native sharp rasterization with Puppeteer fallback.
 * Produces a 1620x2025 pixel PNG with embedded QR code on the official visual template.
 * Invariant (FR-TCK-3): Internal Ticket ID MUST NOT be visibly printed on the image card.
 */
export class TicketImageService {
  private templateBuffer: Buffer | null = null;
  private templateBase64: string | null = null;
  private fontBase64: string | null = null;

  constructor() {
    this.loadTemplate();
    this.loadFont();
  }

  private loadTemplate() {
    const candidates = [
      path.resolve(__dirname, '../../../../assets/ticket_template.png'),
      path.resolve(__dirname, '../../../assets/ticket_template.png'),
      path.resolve(__dirname, '../../assets/ticket_template.png'),
      path.resolve(__dirname, '../assets/ticket_template.png'),
      path.resolve(process.cwd(), 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'server', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'dist', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'server', 'dist', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), '../client', 'assets', 'ticket_template.png'),
      path.resolve(process.cwd(), 'client', 'assets', 'ticket_template.png'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          this.templateBuffer = fs.readFileSync(p);
          this.templateBase64 = `data:image/png;base64,${this.templateBuffer.toString('base64')}`;
          break;
        } catch (e) {
          console.warn('[TicketImageService] Could not load template from:', p, e);
        }
      }
    }
  }

  private loadFont() {
    const candidates = [
      path.resolve(__dirname, '../../../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'server', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'dist', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'server', 'dist', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), '../client', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'client', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const buf = fs.readFileSync(p);
          this.fontBase64 = buf.toString('base64');
          break;
        } catch (e) {
          console.warn('[TicketImageService] Could not load font from:', p, e);
        }
      }
    }

    if (!this.fontBase64) {
      console.warn('[TicketImageService] NotoSansDevanagari font could not be located in assets/fonts');
    }
  }

  public buildSvg(data: TicketImageData, includeBackground: boolean = false): string {
    const bgImage = includeBackground && this.templateBase64
      ? `<image href="${this.templateBase64}" width="1620" height="2025" preserveAspectRatio="none"/>`
      : (!this.templateBuffer ? `<rect width="1620" height="2025" fill="#7f1d1d"/>` : '');

    const safeGuestName = (data.guestName || 'Valued Guest')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const embeddedFontFace = this.fontBase64
      ? `@font-face {
        font-family: 'Noto Sans Devanagari';
        src: url('data:font/truetype;charset=utf-8;base64,${this.fontBase64}') format('truetype');
        font-weight: 700;
        font-style: normal;
      }
      @font-face {
        font-family: 'Noto Sans Devanagari';
        src: url('data:font/truetype;charset=utf-8;base64,${this.fontBase64}') format('truetype');
        font-weight: 800;
        font-style: normal;
      }`
      : `@import url('https://fonts.googleapis.com/css2?family=Mukta:wght@700;800&amp;family=Noto+Sans+Devanagari:wght@700;800;900&amp;display=swap');`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 2025" width="1620" height="2025">
  <defs>
    <style>
      ${embeddedFontFace}
      .guest-text {
        font-family: 'Noto Sans Devanagari', 'Mukta', 'Hind', sans-serif;
        font-size: 76px;
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

  <!-- Guest Name (Ticket ID is NOT visibly rendered per FR-TCK-3) -->
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
      try {
        return await puppeteer.launch({
          headless: 'shell',
          args: launchArgs,
        });
      } catch (fallbackErr: any) {
        throw new AppError(
          `Headless Chromium browser process failed to launch in this container environment: ${fallbackErr?.message || err?.message}. Sharp native engine should be used for PNG generation.`,
          500,
          undefined,
          'BROWSER_LAUNCH_ERROR'
        );
      }
    }
  }

  /**
   * Converts SVG markup to a genuine PNG image buffer using sharp native rasterization
   * with automatic fallback to Puppeteer if needed.
   * Validates that output is a valid PNG binary with standard PNG header (0x89504E47).
   */
  async svgToPng(svg: string, sharedBrowser?: Browser): Promise<Buffer> {
    // 1. Native sharp rendering via composite on pre-loaded template buffer (blazing fast, ~50ms, zero Chromium, lowest RAM)
    try {
      if (this.templateBuffer && !svg.includes('<image href="data:image/png;base64')) {
        const pngBuffer = await sharp(this.templateBuffer)
          .composite([{ input: Buffer.from(svg) }])
          .png({ compressionLevel: 6 })
          .toBuffer();
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      } else {
        const pngBuffer = await sharp(Buffer.from(svg))
          .png({ compressionLevel: 6 })
          .toBuffer();
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      }
    } catch (sharpErr: any) {
      console.warn('[TicketImageService] Sharp SVG conversion note:', sharpErr?.message || sharpErr);
    }

    // 2. Headless browser fallback if available
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

      const pngBuffer = Buffer.from(screenshot);
      if (!isPngBuffer(pngBuffer)) {
        throw new Error('Puppeteer screenshot failed PNG binary header verification');
      }
      return pngBuffer;
    } finally {
      if (ownBrowser && browser) {
        try {
          await browser.close();
        } catch (_) {}
      }
    }
  }

  /**
   * Fast rendering of SVG onto a pre-existing Puppeteer Page instance.
   */
  async renderSvgOnPage(svg: string, page: Page): Promise<Buffer> {
    try {
      if (this.templateBuffer && !svg.includes('<image href="data:image/png;base64')) {
        const pngBuffer = await sharp(this.templateBuffer)
          .composite([{ input: Buffer.from(svg) }])
          .png({ compressionLevel: 6 })
          .toBuffer();
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      } else {
        const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      }
    } catch (_) {}

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1620px; height: 2025px; overflow: hidden; background-color: #000; }</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    const pngBuffer = Buffer.from(screenshot);
    if (!isPngBuffer(pngBuffer)) {
      throw new Error('Rendered page screenshot failed PNG binary verification');
    }
    return pngBuffer;
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

  /**
   * Batch render multiple tickets with high-speed native sharp rendering.
   * Eliminates browser process crashes and memory exhaustion in cloud containers.
   * Concurrency is bounded to 2 to operate safely under 512MB RAM.
   */
  async renderBatchTickets(
    items: TicketImageData[],
    batchConcurrency = 2
  ): Promise<Array<{ ticketId: string; pngBuffer: Buffer; fileName: string }>> {
    if (items.length === 0) return [];

    const results: Array<{ ticketId: string; pngBuffer: Buffer; fileName: string }> = [];

    for (let i = 0; i < items.length; i += batchConcurrency) {
      const slice = items.slice(i, i + batchConcurrency);
      const batchResults = await Promise.all(
        slice.map(async (item) => {
          const fileName = `ticket-${item.ticketId}.png`;
          const svg = this.buildSvg(item);
          const pngBuffer = await this.svgToPng(svg);
          return {
            ticketId: item.ticketId,
            pngBuffer,
            fileName,
          };
        })
      );
      results.push(...batchResults);
    }

    return results;
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
