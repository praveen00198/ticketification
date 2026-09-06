import QRCode from 'qrcode';
import JSZip from 'jszip';
import templateImgSrc from '../../assets/ticket_template.png';
import { Ticket } from '../types';

let cachedTemplateImg: HTMLImageElement | null = null;

/**
 * Preload and cache the template image for high-speed repeated renders
 */
function loadTemplateImage(): Promise<HTMLImageElement> {
  if (cachedTemplateImg && cachedTemplateImg.complete && cachedTemplateImg.naturalWidth > 0) {
    return Promise.resolve(cachedTemplateImg);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cachedTemplateImg = img;
      resolve(img);
    };
    img.onerror = (err) => reject(new Error('Failed to load ticket template image: ' + err));
    img.src = templateImgSrc;
  });
}

/**
 * Renders a high-resolution 1620x2025 ticket on HTML5 Canvas
 */
export async function renderTicketToCanvas(ticket: Ticket): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1620;
  canvas.height = 2025;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create 2D canvas context');
  }

  // 1. Draw Template Background
  try {
    const templateImg = await loadTemplateImage();
    ctx.drawImage(templateImg, 0, 0, 1620, 2025);
  } catch (err) {
    console.warn('[TicketCanvas] Template load fallback:', err);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, 1620, 2025);
  }

  // 2. Generate Real High-Resolution QR Code Canvas
  const appOrigin = window.location.origin;
  const token = ticket.verificationToken || ticket.ticketId;
  const qrData = `${appOrigin}/verify/${token}`;
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, qrData, {
    width: 380,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });

  // 3. Draw White Rounded QR Box
  const cardX = 604;
  const cardY = 960;
  const cardW = 412;
  const cardH = 412;
  const cardRadius = 24;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 16;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Draw QR Code inside white box
  ctx.drawImage(qrCanvas, cardX + 16, cardY + 16, 380, 380);

  // 5. Draw Guest Name (Hindi / English font)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 72px "Noto Sans Devanagari", "Mukta", "Hind", sans-serif';

  // Text Shadow / Glow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#FFE680';
  ctx.fillText(ticket.name, 810, 1470);
  ctx.restore();

  return canvas;
}

/**
 * Returns a base64 PNG data URL of the rendered ticket
 */
export async function renderTicketToDataUrl(ticket: Ticket): Promise<string> {
  if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/')) {
    return ticket.imageBase64;
  }
  const canvas = await renderTicketToCanvas(ticket);
  return canvas.toDataURL('image/png');
}

/**
 * Instantly downloads a single ticket PNG to the user's browser
 */
export async function downloadTicketPng(ticket: Ticket): Promise<void> {
  const dataUrl = await renderTicketToDataUrl(ticket);
  const safeName = ticket.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  const fileName = `${safeName || 'Guest'}_${ticket.ticketId}.png`;

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Bundles all tickets into a single ZIP archive in the browser and downloads it
 */
export async function downloadAllTicketsZipClient(
  tickets: Ticket[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!tickets || tickets.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder('tickets') || zip;

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (onProgress) {
      onProgress(i + 1, tickets.length);
    }

    const dataUrl = await renderTicketToDataUrl(t);
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const safeName = t.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const fileName = `${safeName || 'Guest'}_${t.ticketId}.png`;

    folder.file(fileName, base64Data, { base64: true });
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticketification-tickets-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
