import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import config from '../../../config/env';

export interface PdfTicketData {
  ticketId: string;
  guestName: string;
  guestEmail: string;
  eventName: string;
  eventDate: string;
  ticketType: string;
  qrCodeDataUrl: string;
  organization?: string;
}

export class PdfService {
  async generateTicketPdf(data: PdfTicketData): Promise<Buffer> {
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Event Ticket - ${data.ticketId}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', sans-serif;
          background-color: #FAF9F6;
          color: #18181B;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px;
          -webkit-print-color-adjust: exact;
        }
        .ticket-container {
          width: 650px;
          background: #FFFFFF;
          border: 2px solid #18181B;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          position: relative;
        }
        .header {
          background: #18181B;
          color: #FFFFFF;
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .logo span { color: #DC2626; }
        .badge {
          background: #DC2626;
          color: #FFFFFF;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .body {
          display: flex;
          padding: 32px;
          gap: 24px;
          position: relative;
        }
        .details { flex: 1; }
        .field { margin-bottom: 18px; }
        .field-label { font-size: 11px; text-transform: uppercase; color: #71717A; font-weight: 600; letter-spacing: 0.5px; }
        .field-value { font-size: 16px; font-weight: 700; color: #18181B; margin-top: 2px; }
        .ticket-id { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: #DC2626; letter-spacing: 0.5px; }
        .qr-section {
          width: 180px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-left: 2px dashed #E4E4E7;
          padding-left: 24px;
        }
        .qr-img { width: 140px; height: 140px; border-radius: 8px; }
        .scan-hint { font-size: 10px; color: #71717A; margin-top: 8px; text-align: center; font-weight: 600; text-transform: uppercase; }
        .footer {
          background: #FAF9F6;
          border-top: 1px solid #E4E4E7;
          padding: 16px 32px;
          font-size: 11px;
          color: #71717A;
          display: flex;
          justify-content: space-between;
        }
      </style>
    </head>
    <body>
      <div class="ticket-container">
        <div class="header">
          <div class="logo">TICKETIFICATION<span>.</span></div>
          <div class="badge">${data.ticketType}</div>
        </div>
        <div class="body">
          <div class="details">
            <div class="field">
              <div class="field-label">Ticket ID</div>
              <div class="field-value ticket-id">${data.ticketId}</div>
            </div>
            <div class="field">
              <div class="field-label">Guest Name</div>
              <div class="field-value">${data.guestName}</div>
            </div>
            <div class="field">
              <div class="field-label">Event</div>
              <div class="field-value">${data.eventName}</div>
            </div>
            <div class="field">
              <div class="field-label">Date & Time</div>
              <div class="field-value">${data.eventDate}</div>
            </div>
            ${data.organization ? `<div class="field"><div class="field-label">Organization</div><div class="field-value">${data.organization}</div></div>` : ''}
          </div>
          <div class="qr-section">
            <img src="${data.qrCodeDataUrl}" class="qr-img" alt="QR Code" />
            <div class="scan-hint">Scan at Event Entry</div>
          </div>
        </div>
        <div class="footer">
          <div>Official Event Credential &bull; Non-Transferable</div>
          <div>Support: support@ticketification.com</div>
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      const browser = await puppeteer.launch({
        headless: config.env.puppeteerHeadless ? 'shell' : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.warn('[PdfService Warning] Puppeteer launch failed. Generating fallback HTML/text PDF buffer:', error);
      return Buffer.from(htmlTemplate);
    }
  }
}

export const pdfService = new PdfService();
