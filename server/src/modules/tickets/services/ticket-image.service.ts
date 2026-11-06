import { initFonts } from '../../../utils/font-initializer';
// Initialize Fontconfig with bundled Devanagari fonts before Sharp loads
initFonts();

import puppeteer, { Browser, Page } from 'puppeteer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import config from '../../../config/env';
import { AppError, ValidationError } from '../../../middlewares/error.middleware';
import { logMemory } from '../../../utils/memory-logger';
import { getTemplateById, DEFAULT_TEMPLATE_ID, TicketTemplate } from '../ticket-templates';

// Disable libvips operation & buffer caching to prevent RSS retention across tickets in memory-constrained environments (Render 512MB)
sharp.cache(false);
// Limit internal thread pool to 1 thread per operation to avoid multi-threaded memory spikes
sharp.concurrency(1);

// ── DIAGNOSTIC: Verify Sharp config is applied at module load time ──
console.log(`[DIAG:TicketImageService] sharp.cache()=${JSON.stringify(sharp.cache())} sharp.concurrency()=${sharp.concurrency()}`);
console.log(`[DIAG:TicketImageService] sharp.versions=${JSON.stringify(sharp.versions)}`);

export interface TicketImageData {
  ticketId: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  ticketType: string;
  qrCodeDataUrl?: string;
  venue?: string;
  sequenceNumber?: string | number;
  sequence?: string;
  organizerName?: string;
  eventTime?: string;
  issueDate?: string;
  verificationToken?: string;
  organization?: string;
  phone?: string;
  teamName?: string;
}

export interface BuildSvgOptions {
  isCustomTemplate?: boolean;
  includeBackground?: boolean;
}

/**
 * Escapes unsafe XML/SVG characters to prevent XML parsing injection errors.
 */
export function escapeXml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Breaks long text cleanly into up to maxLines without overflowing SVG layout boundaries.
 */
export function splitTextIntoLines(text: string, maxCharsPerLine = 38, maxLines = 2): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s,.-]+$/, '') + '…';
  }

  return lines.length > 0 ? lines : [text];
}

/**
 * Generates a high-resolution PNG ticket image using native sharp rasterization.
 * Produces a 1620x2025 pixel PNG with embedded high-contrast QR code on the default global design
 * (or composited onto an explicitly provided custom template).
 * Invariant (FR-TCK-3): Internal Ticket ID MUST NOT be visibly printed on the image card.
 */
export class TicketImageService {
  private templateBuffer: Buffer | null = null;
  private templateBase64: string | null = null;
  private fontBase64: string | null = null;

  constructor() {
    initFonts();
    this.loadTemplate();
    this.loadFont();
  }

  private loadTemplate() {
    const candidates = [
      path.resolve(__dirname, '../../../../assets/default-ticket-template.png'),
      path.resolve(__dirname, '../../../assets/default-ticket-template.png'),
      path.resolve(__dirname, '../../assets/default-ticket-template.png'),
      path.resolve(__dirname, '../assets/default-ticket-template.png'),
      path.resolve(process.cwd(), 'assets', 'default-ticket-template.png'),
      path.resolve(process.cwd(), 'server', 'assets', 'default-ticket-template.png'),
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

  /**
   * Generates the SVG definition for the clean light default ticket base template.
   */
  public buildDefaultBaseTemplateSvg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 2025" width="1620" height="2025">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FAFAF9"/>
      <stop offset="100%" stop-color="#F4F4F5"/>
    </linearGradient>
    <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#0F172A" flood-opacity="0.07"/>
    </filter>
  </defs>
  <rect width="1620" height="2025" fill="url(#bg-grad)"/>
  <rect x="90" y="80" width="1440" height="1865" rx="36" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2" filter="url(#card-shadow)"/>
  <rect x="90" y="80" width="1440" height="14" rx="7" fill="#10B981"/>
  <!-- Lanyard punch slot -->
  <rect x="710" y="115" width="200" height="34" rx="17" fill="#F4F4F5" stroke="#E2E8F0" stroke-width="2"/>
  <!-- Perforation notches and line -->
  <circle cx="90" cy="860" r="30" fill="#FAFAF9"/>
  <circle cx="1530" cy="860" r="30" fill="#FAFAF9"/>
  <line x1="130" y1="860" x2="1490" y2="860" stroke="#CBD5E1" stroke-width="3" stroke-dasharray="14 10"/>
  <line x1="160" y1="1660" x2="1460" y2="1660" stroke="#F1F5F9" stroke-width="2"/>
  <text x="160" y="1710" font-family="'Inter', -apple-system, 'Segoe UI', Arial, sans-serif" font-size="20" font-weight="600" fill="#94A3B8">Powered by Ticketification • Official Event Pass</text>
</svg>`;
  }

  /**
   * Generates a genuine PNG buffer for the clean light default template.
   */
  public async generateDefaultTemplateBuffer(): Promise<Buffer> {
    const svg = this.buildDefaultBaseTemplateSvg();
    return sharp(Buffer.from(svg))
      .png({ compressionLevel: 6 })
      .toBuffer();
  }

  /**
   * Returns the default template buffer loaded at startup.
   */
  public getDefaultTemplateBuffer(): Buffer | null {
    return this.templateBuffer;
  }

  /**
   * Resolves and loads a template PNG by filename from known asset directories.
   * Returns a NEW, request-local Buffer. Never mutates singleton state.
   */
  public async resolveTemplateBuffer(filename: string): Promise<Buffer> {
    const candidates = [
      path.resolve(__dirname, '../../../../assets', filename),
      path.resolve(__dirname, '../../../assets', filename),
      path.resolve(__dirname, '../../assets', filename),
      path.resolve(__dirname, '../assets', filename),
      path.resolve(process.cwd(), 'assets', filename),
      path.resolve(process.cwd(), 'server', 'assets', filename),
      path.resolve(process.cwd(), 'dist', 'assets', filename),
      path.resolve(process.cwd(), 'server', 'dist', 'assets', filename),
      path.resolve(process.cwd(), '../client', 'assets', filename),
      path.resolve(process.cwd(), 'client', 'assets', filename),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const rawBuf = fs.readFileSync(p);
          console.log(`[TicketImageService] Resolved template '${filename}' from: ${p}`);
          const meta = await sharp(rawBuf).metadata();
          if (meta.width === 1620 && meta.height === 2025) {
            return rawBuf;
          }
          const normalized = await sharp(rawBuf)
            .resize(1620, 2025)
            .png({ compressionLevel: 6 })
            .toBuffer();
          return normalized;
        } catch (e) {
          console.warn(`[TicketImageService] Could not load template '${filename}' from:`, p, e);
        }
      }
    }

    // If filename is the default template and file was not on disk, generate on the fly
    if (filename === 'default-ticket-template.png' || filename === 'ticket_template.png') {
      return this.generateDefaultTemplateBuffer();
    }

    throw new AppError(
      `Selected ticket template '${filename}' is unavailable. The template file could not be found in any known asset directory.`,
      500,
      undefined,
      'TEMPLATE_NOT_FOUND'
    );
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

  /**
   * Validates ticket image generation payload.
   * Throws structured ValidationError if data is missing or critical fields are malformed.
   */
  public validateTicketData(data: TicketImageData): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Ticket image generation payload is required and must be an object', { field: 'data' });
    }

    if (!data.ticketId || typeof data.ticketId !== 'string' || !data.ticketId.trim()) {
      throw new ValidationError('Ticket ID is required for image generation', { field: 'ticketId' });
    }

    const hasQrUrl = typeof data.qrCodeDataUrl === 'string' && data.qrCodeDataUrl.trim().length > 0;
    const hasToken = typeof data.verificationToken === 'string' && data.verificationToken.trim().length > 0;

    if (!hasQrUrl && !hasToken) {
      throw new ValidationError(
        'Either qrCodeDataUrl or verificationToken is required for ticket image generation',
        { field: 'qrCodeDataUrl' }
      );
    }

    if (hasToken && !hasQrUrl) {
      const trimmedToken = data.verificationToken!.trim();
      if (trimmedToken.length < 16) {
        throw new ValidationError('Invalid verification token: token too short', { field: 'verificationToken' });
      }
    }
  }

  /**
   * Builds the SVG markup for ticket rendering.
   * Defaults to the new clean light aesthetic Default Global Ticket design.
   * Invariant (FR-TCK-3): Internal Ticket ID / crypto token must NEVER be visibly printed in text!
   */
  public buildSvg(data: TicketImageData, options?: boolean | BuildSvgOptions): string {
    const isCustomTemplate =
      typeof options === 'object' && options !== null
        ? !!options.isCustomTemplate
        : false;
    const includeBackground =
      typeof options === 'boolean'
        ? options
        : typeof options === 'object' && options !== null
        ? !!options.includeBackground
        : false;

    // Graceful fallbacks for non-critical metadata
    const safeGuestName = escapeXml(
      data.guestName && data.guestName.trim() ? data.guestName.trim() : 'Valued Guest'
    );
    const rawEventName = data.eventName && data.eventName.trim() ? data.eventName.trim() : 'Event Admission Pass';
    const safeEventName = escapeXml(rawEventName);
    const eventNameLines = splitTextIntoLines(safeEventName, 38, 2);

    let rawEventDate = data.eventDate && data.eventDate.trim() ? data.eventDate.trim() : 'Date TBA';
    if (data.eventTime && data.eventTime.trim()) {
      rawEventDate += ` • ${data.eventTime.trim()}`;
    }
    const safeEventDate = escapeXml(rawEventDate);

    // Derive day of week for badge header (matching reference layout)
    let dayOfWeek = 'TUESDAY';
    if (data.eventDate && data.eventDate.trim()) {
      try {
        const d = new Date(data.eventDate.trim());
        if (!isNaN(d.getTime())) {
          dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        } else {
          const match = data.eventDate.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
          dayOfWeek = match ? match[1].toUpperCase() : 'EVENT PASS';
        }
      } catch {
        dayOfWeek = 'EVENT PASS';
      }
    }

    const safeVenue = escapeXml(
      data.venue && data.venue.trim() ? data.venue.trim() : 'Venue TBA'
    );
    const safeTicketType = escapeXml(
      data.ticketType && data.ticketType.trim() ? data.ticketType.trim() : 'General Admission'
    );

    // FR-TCK-3: Internal ticket database ID / crypto token must NEVER be visibly printed in text!
    // Format human-readable sequence number if present; otherwise default cleanly
    let sequenceText = '#00001';
    if (data.sequenceNumber !== undefined && data.sequenceNumber !== null && String(data.sequenceNumber).trim()) {
      const num = Number(data.sequenceNumber);
      sequenceText = !isNaN(num) ? `#${String(num).padStart(5, '0')}` : String(data.sequenceNumber).trim();
    } else if (data.sequence && data.sequence.trim()) {
      sequenceText = data.sequence.trim();
    }
    const safeSequenceId = escapeXml(sequenceText);

    const safeOrganization = data.organization && data.organization.trim()
      ? escapeXml(data.organization.trim())
      : null;

    const safeTeamName = data.teamName && data.teamName.trim()
      ? escapeXml(data.teamName.trim())
      : null;

    const safeQrCodeUrl = data.qrCodeDataUrl || '';

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

    const badgeTextWidth = Math.max(220, safeTicketType.length * 15 + 56);
    const attendeeY = safeTeamName ? 640 : 540;

    let eventTitleSvg = '';
    if (eventNameLines.length === 1) {
      eventTitleSvg = `<text x="160" y="300" font-family="'Inter', -apple-system, 'Segoe UI', Arial, sans-serif" font-size="56" font-weight="800" fill="#0F172A">${eventNameLines[0]}</text>`;
    } else {
      eventTitleSvg = `<text x="160" y="285" font-family="'Inter', -apple-system, 'Segoe UI', Arial, sans-serif" font-size="46" font-weight="800" fill="#0F172A">
        <tspan x="160" dy="0">${eventNameLines[0]}</tspan>
        <tspan x="160" dy="54">${eventNameLines[1]}</tspan>
      </text>`;
    }

    const guestFontSize = safeGuestName.length > 28 ? 52 : 64;

    if (isCustomTemplate) {
      const bgImage = includeBackground && this.templateBase64
        ? `<image href="${this.templateBase64}" width="1620" height="2025" preserveAspectRatio="none"/>`
        : '';

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 2025" width="1620" height="2025">
  <defs>
    <style>
      ${embeddedFontFace}
    </style>
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-opacity="0.5"/>
    </filter>
  </defs>

  ${bgImage}

  <!-- QR White Card -->
  <g transform="translate(604, 960)">
    <rect width="412" height="412" rx="24" fill="#FFFFFF" stroke="#10B981" stroke-width="4" filter="url(#card-shadow)"/>
    <image href="${safeQrCodeUrl}" x="16" y="16" width="380" height="380" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- Guest Name (Ticket ID is NOT visibly rendered per FR-TCK-3) -->
  <text
    x="810"
    y="1490"
    text-anchor="middle"
    font-family="'Noto Sans Devanagari', 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif"
    font-size="76"
    font-weight="800"
    fill="#FFFFFF"
    stroke="#0F172A"
    stroke-width="2"
    paint-order="stroke fill"
  >${safeGuestName}</text>
</svg>`;
    }

    // Default Global Ticket Design (Clean Light Aesthetic & Lanyard Badge Architecture, 1620 x 2025 px)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1620 2025" width="1620" height="2025">
  <defs>
    <style>
      ${embeddedFontFace}
      .font-sans { font-family: 'Inter', -apple-system, 'Segoe UI', Arial, 'DejaVu Sans', 'Noto Sans Devanagari', sans-serif; }
      .font-devanagari { font-family: 'Noto Sans Devanagari', 'Inter', -apple-system, 'Segoe UI', Arial, sans-serif; }
      .font-mono { font-family: 'JetBrains Mono', 'Courier New', monospace; }
    </style>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FAFAF9"/>
      <stop offset="100%" stop-color="#F4F4F5"/>
    </linearGradient>
    <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#0F172A" flood-opacity="0.07"/>
    </filter>
  </defs>

  <!-- 1. Canvas Background -->
  <rect width="1620" height="2025" fill="url(#bg-grad)"/>

  <!-- 2. Elevated Main Pass Card Container -->
  <rect x="90" y="80" width="1440" height="1865" rx="36" fill="#FFFFFF" stroke="#E4E4E7" stroke-width="2" filter="url(#card-shadow)"/>

  <!-- 3. Top Emerald Accent Ribbon -->
  <rect x="90" y="80" width="1440" height="14" rx="7" fill="#10B981"/>

  <!-- 4. Lanyard Punch Slot (Physical Badge Aesthetic) -->
  <rect x="710" y="115" width="200" height="34" rx="17" fill="#F4F4F5" stroke="#E2E8F0" stroke-width="2"/>

  <!-- 5. Header: Official Credential Pill, Tier Badge & Brand Watermark -->
  <g transform="translate(160, 175)">
    <!-- Pill 1: Official Credential -->
    <rect width="280" height="46" rx="23" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="2"/>
    <text x="140" y="30" text-anchor="middle" class="font-sans" font-size="18" font-weight="700" fill="#059669" letter-spacing="1">OFFICIAL CREDENTIAL</text>

    <!-- Pill 2: Ticket Type / Tier -->
    <g transform="translate(300, 0)">
      <rect width="${badgeTextWidth}" height="46" rx="23" fill="#ECFDF5" stroke="#10B981" stroke-width="2"/>
      <text x="${badgeTextWidth / 2}" y="30" text-anchor="middle" class="font-sans" font-size="20" font-weight="700" fill="#059669">${safeTicketType}</text>
    </g>
  </g>
  <text x="1460" y="206" text-anchor="end" class="font-sans" font-size="20" font-weight="800" fill="#94A3B8" letter-spacing="3">TICKETIFICATION</text>

  <!-- 6. Event Title -->
  ${eventTitleSvg}

  <!-- 7. Event Schedule & Location Grid -->
  <g transform="translate(160, 400)">
    <!-- Column 1: Date & Time -->
    <text x="0" y="0" class="font-sans" font-size="16" font-weight="700" fill="#64748B" letter-spacing="1.5">DATE &amp; TIME</text>
    <text x="0" y="38" class="font-sans" font-size="28" font-weight="800" fill="#0F172A">${dayOfWeek}</text>
    <text x="0" y="72" class="font-sans" font-size="22" font-weight="600" fill="#475569">${safeEventDate}</text>

    <!-- Column 2: Venue & Location -->
    <text x="700" y="0" class="font-sans" font-size="16" font-weight="700" fill="#64748B" letter-spacing="1.5">VENUE &amp; LOCATION</text>
    <text x="700" y="38" class="font-sans" font-size="26" font-weight="800" fill="#0F172A">${safeVenue}</text>
  </g>

  <!-- 8. Team / Cohort Block (Only rendered when teamName exists) -->
  ${safeTeamName ? `
  <g transform="translate(160, 530)">
    <text x="0" y="0" class="font-sans" font-size="16" font-weight="700" fill="#64748B" letter-spacing="1.5">TEAM / COHORT</text>
    <text x="0" y="42" class="font-sans" font-size="34" font-weight="800" fill="#0F172A">${safeTeamName}</text>
  </g>` : ''}

  <!-- 9. Attendee Information Section (Hero Element) -->
  <g transform="translate(160, ${attendeeY})">
    <text x="0" y="0" class="font-sans" font-size="16" font-weight="700" fill="#64748B" letter-spacing="1.5">ATTENDEE NAME</text>
    <text x="0" y="58" class="font-devanagari" font-size="${guestFontSize}" font-weight="800" fill="#0F172A">${safeGuestName}</text>
    ${safeOrganization && safeOrganization !== safeTeamName ? `<text x="0" y="102" class="font-sans" font-size="22" font-weight="600" fill="#475569">${safeOrganization}</text>` : ''}
  </g>

  <!-- 10. Perforation Line with Edge Notches (Stub Separation) -->
  <circle cx="90" cy="840" r="30" fill="#FAFAF9"/>
  <circle cx="1530" cy="840" r="30" fill="#FAFAF9"/>
  <line x1="130" y1="840" x2="1490" y2="840" stroke="#CBD5E1" stroke-width="3" stroke-dasharray="14 10"/>

  <!-- 11. Centered High-Contrast Access QR Code Card -->
  <g transform="translate(530, 895)">
    <!-- Elevated Outer Card -->
    <rect width="560" height="560" rx="32" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
    <!-- Inset High-Contrast White Surface -->
    <rect x="30" y="30" width="500" height="500" rx="20" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
    <!-- Emerald Viewport Corner Brackets -->
    <path d="M 50 85 L 50 50 L 85 50" fill="none" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    <path d="M 510 85 L 510 50 L 475 50" fill="none" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    <path d="M 50 475 L 50 510 L 85 510" fill="none" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    <path d="M 510 475 L 510 510 L 475 510" fill="none" stroke="#10B981" stroke-width="5" stroke-linecap="round"/>
    <!-- Dynamic 380x380 px High-Contrast QR Code -->
    <image href="${safeQrCodeUrl}" x="90" y="90" width="380" height="380" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- 12. Instructions & Verification Footnote -->
  <text x="810" y="1515" text-anchor="middle" class="font-sans" font-size="24" font-weight="600" fill="#475569">Present this QR code at the entry gate turnstile for admission</text>
  <text x="810" y="1555" text-anchor="middle" class="font-mono" font-size="18" font-weight="600" fill="#94A3B8" letter-spacing="2">SECURE TAMPER-PROOF ACCESS CREDENTIAL</text>

  <!-- 13. Bottom Divider & Footer (No Status, No Pass ID) -->
  <line x1="160" y1="1640" x2="1460" y2="1640" stroke="#F1F5F9" stroke-width="2"/>
  <text x="810" y="1690" text-anchor="middle" class="font-sans" font-size="20" font-weight="600" fill="#94A3B8">Powered by Ticketification • Official Event Pass</text>
</svg>`;
  }

  /**
   * Launch a shared Puppeteer browser instance with headless flags.
   * Kept for backward compatibility; Sharp native engine is the primary production path.
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
          `Headless Chromium browser process failed to launch: ${fallbackErr?.message || err?.message}. Sharp native engine should be used.`,
          500,
          undefined,
          'BROWSER_LAUNCH_ERROR'
        );
      }
    }
  }

  /**
   * Converts SVG markup to a genuine PNG image buffer using sharp native rasterization.
   * If customTemplateBuffer is provided, composites the SVG onto that template.
   * Otherwise, rasterizes the standalone Default Global Ticket SVG directly.
   * Validates that output is a valid PNG binary with standard PNG header (0x89504E47).
   */
  async svgToPng(svg: string, sharedBrowser?: Browser, customTemplateBuffer?: Buffer | null): Promise<Buffer> {
    try {
      if (customTemplateBuffer) {
        logMemory('sharp_composite_before');
        const pngBuffer = await sharp(customTemplateBuffer)
          .composite([{ input: Buffer.from(svg) }])
          .png({ compressionLevel: 6 })
          .toBuffer();
        logMemory('sharp_composite_after', { pngSizeKB: Math.round(pngBuffer.length / 1024) });
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      } else {
        logMemory('sharp_svg_direct_before');
        const pngBuffer = await sharp(Buffer.from(svg))
          .png({ compressionLevel: 6 })
          .toBuffer();
        logMemory('sharp_svg_direct_after', { pngSizeKB: Math.round(pngBuffer.length / 1024) });
        if (isPngBuffer(pngBuffer)) {
          return pngBuffer;
        }
      }
    } catch (sharpErr: any) {
      console.error('[CRITICAL:TicketImageService] Sharp SVG conversion FAILED:', sharpErr?.message || sharpErr);
      logMemory('sharp_failed');
      throw new AppError(
        `Ticket rasterization failed: ${sharpErr?.message || 'Internal rasterization error'}`,
        500,
        { cause: sharpErr?.message },
        'RASTERIZATION_FAILED'
      );
    }

    throw new AppError(
      'Generated image buffer failed PNG binary header verification',
      500,
      undefined,
      'INVALID_PNG_OUTPUT'
    );
  }

  /**
   * Fast rendering of SVG onto a pre-existing Puppeteer Page instance (legacy fallback).
   */
  async renderSvgOnPage(svg: string, page: Page): Promise<Buffer> {
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    if (isPngBuffer(pngBuffer)) {
      return pngBuffer;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { width: 1620px; height: 2025px; overflow: hidden; background-color: #000; }</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const screenshot = await page.screenshot({ type: 'png', fullPage: true });
    const fallbackBuffer = Buffer.from(screenshot);
    if (!isPngBuffer(fallbackBuffer)) {
      throw new Error('Rendered page screenshot failed PNG binary verification');
    }
    return fallbackBuffer;
  }

  /**
   * Generate an in-memory high-resolution PNG ticket asset.
   */
  async generateTicketImage(
    data: TicketImageData,
    sharedBrowser?: Browser,
    customTemplateBuffer?: Buffer | null
  ): Promise<{ pngBuffer: Buffer; svg: string; imageBase64: string; fileName: string }> {
    this.validateTicketData(data);

    // If verificationToken is provided but qrCodeDataUrl is missing, generate it dynamically
    if (!data.qrCodeDataUrl && data.verificationToken) {
      const verifyUrl = `https://ticketification.app/verify/${data.verificationToken.trim()}`;
      data.qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 380,
        margin: 1,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
    }

    const fileName = `ticket-${data.ticketId}.png`;
    const isCustom = !!customTemplateBuffer;
    const svg = this.buildSvg(data, { isCustomTemplate: isCustom });
    const pngBuffer = await this.svgToPng(svg, sharedBrowser, customTemplateBuffer);
    const imageBase64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    return { pngBuffer, svg, imageBase64, fileName };
  }

  /**
   * Batch render multiple tickets with high-speed native sharp rendering.
   * Eliminates browser process crashes and memory exhaustion in cloud containers.
   *
   * @param items - Ticket data items to render
   * @param batchConcurrency - Max parallel renders per batch (bounded 1-2 for 512MB containers)
   * @param externalTemplateBuffer - Optional request-local template buffer. When provided and
   *   distinct from the default template, this buffer is used for composition.
   */
  async renderBatchTickets(
    items: TicketImageData[],
    batchConcurrency = 1,
    externalTemplateBuffer?: Buffer | null
  ): Promise<Array<{ ticketId: string; pngBuffer: Buffer; fileName: string }>> {
    if (!Array.isArray(items) || items.length === 0) return [];

    const concurrency = Math.max(1, Math.min(batchConcurrency, 2));

    // If externalTemplateBuffer is provided and is NOT the default template, treat as custom
    const isCustom = !!(
      externalTemplateBuffer &&
      externalTemplateBuffer !== this.templateBuffer
    );
    const customTemplate = isCustom ? externalTemplateBuffer : null;

    const results: Array<{ ticketId: string; pngBuffer: Buffer; fileName: string }> = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const slice = items.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        slice.map(async (item) => {
          this.validateTicketData(item);

          if (!item.qrCodeDataUrl && item.verificationToken) {
            const verifyUrl = `https://ticketification.app/verify/${item.verificationToken.trim()}`;
            item.qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, {
              width: 380,
              margin: 1,
              color: {
                dark: '#0F172A',
                light: '#FFFFFF',
              },
              errorCorrectionLevel: 'H',
            });
          }

          const fileName = `ticket-${item.ticketId}.png`;
          const svg = this.buildSvg(item, { isCustomTemplate: isCustom });
          const pngBuffer = await this.svgToPng(svg, undefined, customTemplate);
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
    .replace(/[/\\?%*:|"<>.]+/g, ' ')
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

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
