import sharp, { OverlayOptions } from 'sharp';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { initFonts } from '../../../utils/font-initializer';
import {
  SupabaseStorageService,
  supabaseStorageService,
} from '../../tickets/services/supabase-storage.service';
import {
  IEventCredentialTemplateDocument,
  ITemplateField,
} from '../../../db/mongo/models/event-credential-template.model';
import { AppError } from '../../../middlewares/error.middleware';

import { memoryBudgetGovernor } from '../../../utils/memory-budget-governor';

// Initialize Fontconfig once on service load
initFonts();

// Memory bounding for Render 512MB RAM constraints (ADR-007, ADR-008)
sharp.cache(false);
sharp.concurrency(1);

export interface CredentialRenderData {
  name?: string;
  sequence?: string;
  verificationToken?: string;
  qrPayload?: string;
  role?: string;
  eventName?: string;
  date?: string;
  venue?: string;
  custom?: string;
}

export class EventCredentialRenderingService {
  private fontBase64: string | null = null;

  constructor(
    private storageService: SupabaseStorageService = supabaseStorageService
  ) {
    this.loadDevanagariFont();
  }

  /**
   * Loads bundled NotoSansDevanagari-Bold.ttf and caches it as base64 for SVG template embedding.
   */
  private loadDevanagariFont(): void {
    const candidatePaths = [
      path.resolve(__dirname, '../../../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(__dirname, '../assets/fonts/NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'server', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'dist', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
      path.resolve(process.cwd(), 'server', 'dist', 'assets', 'fonts', 'NotoSansDevanagari-Bold.ttf'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const fontBuf = fs.readFileSync(p);
          this.fontBase64 = fontBuf.toString('base64');
          break;
        } catch (e: any) {
          console.warn('[CredentialRenderingService] Error reading Devanagari font:', p, e?.message);
        }
      }
    }
  }

  public getFontBase64(): string | null {
    return this.fontBase64;
  }

  /**
   * Asserts whether a given buffer is a valid binary PNG (magic bytes 0x89504E47).
   */
  public isPngBuffer(buf: Buffer): boolean {
    if (!buf || buf.length < 8) return false;
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

  /**
   * Resolves a background image buffer for the template.
   */
  private async resolveBackgroundBuffer(
    template: IEventCredentialTemplateDocument,
    width: number,
    height: number
  ): Promise<Buffer> {
    // 1. If template specifies a custom background in Supabase Storage, try downloading it
    if (template.backgroundStoragePath && this.storageService.isConfigured()) {
      try {
        const remoteBuffer = await this.storageService.downloadTicketImage(
          template.backgroundStoragePath
        );
        if (this.isPngBuffer(remoteBuffer)) {
          return remoteBuffer;
        }
      } catch (err: any) {
        console.warn(
          `[CredentialRenderingService] Failed to fetch custom background (${template.backgroundStoragePath}):`,
          err?.message
        );
      }
    }

    // 2. Check local canonical template PNG assets in server/assets
    const candidateFiles = [
      template.presetId === 'WORKER_PASS' ? 'event-worker-template.png' : 'ticket_template.png',
      'ticket_template.png',
    ];

    for (const filename of candidateFiles) {
      const pathsToCheck = [
        path.resolve(__dirname, '../../../../assets', filename),
        path.resolve(process.cwd(), 'assets', filename),
        path.resolve(process.cwd(), 'server', 'assets', filename),
        path.resolve(process.cwd(), 'dist', 'assets', filename),
        path.resolve(process.cwd(), 'server', 'dist', 'assets', filename),
      ];

      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          try {
            const buf = fs.readFileSync(p);
            if (this.isPngBuffer(buf)) {
              return buf;
            }
          } catch (e) {
            // continue checking
          }
        }
      }
    }

    // 3. Fallback: Programmatically generate a sleek dark obsidian gradient background via Sharp
    // Ensures rendering NEVER crashes even if assets are missing in a minimalist CI/CD container
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // slate-900 / obsidian dark
      },
    })
      .png()
      .toBuffer();
  }

  /**
   * Generates a high-contrast QR code PNG buffer.
   */
  private async generateQrBuffer(text: string, size: number): Promise<Buffer> {
    return QRCode.toBuffer(text, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }

  /**
   * Helper to escape raw text for SVG XML inclusion.
   */
  private escapeXml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Constructs the SVG text & design overlay buffer from template fields.
   */
  private buildSvgOverlay(
    fields: ITemplateField[],
    data: CredentialRenderData,
    width: number,
    height: number
  ): string {
    const textElements: string[] = [];

    for (const field of fields) {
      if (!field.visible || field.key === 'qr') continue;

      let value = '';
      switch (field.key) {
        case 'name':
          value = data.name || 'ATTENDEE NAME';
          break;
        case 'sequence':
          value = data.sequence || 'PASS-00001';
          break;
        case 'role':
          value = (data.role || 'PARTICIPANT').toUpperCase();
          break;
        case 'eventName':
          value = data.eventName || 'EVENT NAME';
          break;
        case 'date':
          value = data.date || 'OCTOBER 10, 2026';
          break;
        case 'venue':
          value = data.venue || 'MAIN ARENA';
          break;
        case 'custom':
          value = data.custom || '';
          break;
      }

      if (!value) continue;

      const escaped = this.escapeXml(value);
      const textAnchor =
        field.textAlign === 'center'
          ? 'middle'
          : field.textAlign === 'right'
          ? 'end'
          : 'start';

      const fontSize = field.fontSize || 36;
      const fontFamily = field.fontFamily || 'Noto Sans, sans-serif';
      const resolvedFontFamily = fontFamily.includes('Noto Sans Devanagari')
        ? fontFamily
        : `'Noto Sans Devanagari', ${fontFamily}, sans-serif`;
      const fontWeight = field.fontWeight || 'bold';
      const color = field.color || '#FFFFFF';

      // If it's a role badge, render a decorative pill background box behind it
      if (field.key === 'role') {
        const estWidth = value.length * (fontSize * 0.65) + 40;
        const boxX = field.textAlign === 'center' ? field.x - estWidth / 2 : field.x;
        const boxY = field.y - fontSize + 6;
        textElements.push(
          `<rect x="${boxX}" y="${boxY}" width="${estWidth}" height="${fontSize + 16}" rx="8" fill="#10B981" fill-opacity="0.18" stroke="#10B981" stroke-width="2" />`
        );
      }

      textElements.push(
        `<text x="${field.x}" y="${field.y}" font-family="${resolvedFontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${textAnchor}">${escaped}</text>`
      );
    }

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

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            ${embeddedFontFace}
            text { font-family: 'Noto Sans', 'Noto Sans Devanagari', 'DejaVu Sans', sans-serif; }
          </style>
        </defs>
        ${textElements.join('\n')}
      </svg>
    `;
  }

  /**
   * Renders the genuine PNG credential buffer using native Sharp compositing.
   */
  public async renderCredentialBuffer(
    template: IEventCredentialTemplateDocument,
    data: CredentialRenderData
  ): Promise<Buffer> {
    // Check and yield if memory is under pressure on Render 512MB RAM
    await memoryBudgetGovernor.yieldIfConstrained(50);

    const width = template.dimensions?.width || 1620;
    const height = template.dimensions?.height || 2025;

    // 1. Prepare base background
    let bgBuffer: Buffer | null = await this.resolveBackgroundBuffer(template, width, height);

    // 2. Locate QR code field and generate QR buffer
    const qrField = template.fields.find((f) => f.key === 'qr' && f.visible !== false);
    const qrText =
      data.qrPayload ||
      (data.verificationToken
        ? `https://ticketification.app/verify/${data.verificationToken}`
        : 'https://ticketification.app/verify/sample-token-12345');

    const qrSize = qrField?.width || 380;
    const qrX = qrField?.x !== undefined ? qrField.x : Math.round((width - qrSize) / 2);
    const qrY = qrField?.y !== undefined ? qrField.y : Math.round(height * 0.55);

    let qrBuffer: Buffer | null = await this.generateQrBuffer(qrText, qrSize);

    // 3. Build SVG overlay for text fields
    const svgString = this.buildSvgOverlay(template.fields, data, width, height);
    let svgBuffer: Buffer | null = Buffer.from(svgString, 'utf-8');

    // 4. Sharp composition
    const compositeLayers: OverlayOptions[] = [
      { input: qrBuffer, top: qrY, left: qrX },
      { input: svgBuffer, top: 0, left: 0 },
    ];

    const resultBuffer = await sharp(bgBuffer)
      .resize(width, height, { fit: 'cover' })
      .composite(compositeLayers)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // Dereference intermediate buffers to facilitate immediate V8 GC on 512MB RAM
    bgBuffer = null;
    qrBuffer = null;
    svgBuffer = null;

    if (!this.isPngBuffer(resultBuffer)) {
      throw new AppError('Generated credential output failed binary PNG validation', 500);
    }

    return resultBuffer;
  }

  /**
   * Generates a preview image returned as a Base64 data URL.
   */
  public async renderPreviewDataUrl(
    template: IEventCredentialTemplateDocument,
    mockData?: Partial<CredentialRenderData>
  ): Promise<string> {
    const data: CredentialRenderData = {
      name: mockData?.name || 'Rahul Sharma',
      sequence: mockData?.sequence || 'BDG-00001',
      verificationToken:
        mockData?.verificationToken ||
        'c7a31f9b4e820d65a192837465abcdeffedcba5674839201a5b6c7d8e9f01234',
      role: mockData?.role || 'PARTICIPANT',
      eventName: mockData?.eventName || 'Global Tech Summit 2026',
      date: mockData?.date || 'October 15, 2026',
      venue: mockData?.venue || 'Innovation Hall A',
      custom: mockData?.custom || 'VIP Guest Access',
    };

    const buffer = await this.renderCredentialBuffer(template, data);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  /**
   * Renders genuine PNG asset and uploads to Supabase Storage at:
   * events/{eventId}/credentials/{credentialId}.png
   */
  public async renderAndUploadAsset(
    eventId: string,
    credentialId: string,
    template: IEventCredentialTemplateDocument,
    data: CredentialRenderData
  ): Promise<{ storagePath: string; publicUrl: string }> {
    const pngBuffer = await this.renderCredentialBuffer(template, data);
    const storagePath = `events/${eventId}/credentials/${credentialId}.png`;

    const uploadRes = await this.storageService.uploadTicketImage(
      storagePath,
      pngBuffer,
      'image/png'
    );

    return {
      storagePath: uploadRes.storagePath,
      publicUrl: uploadRes.publicUrl,
    };
  }
}

export const eventCredentialRenderingService =
  new EventCredentialRenderingService();
