import QRCode from 'qrcode';
import JSZip from 'jszip';
import templateImgSrc from '../../assets/ticket_template.png';
import { Ticket } from '../types';
import { getTicketPreviewUrl } from '../api/client';

let cachedTemplateImg: HTMLImageElement | null = null;

/**
 * Helper to trigger a browser file download from a URL or Blob URL
 */
function triggerBrowserDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

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
 * Rasterizes any image URL or SVG data string into a genuine 1620x2025 PNG Data URL
 */
export async function convertToRasterPngDataUrl(sourceUrlOrData: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1620;
      canvas.height = 2025;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceUrlOrData);
        return;
      }
      ctx.drawImage(img, 0, 0, 1620, 2025);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      resolve(sourceUrlOrData);
    };
    img.src = sourceUrlOrData;
  });
}

/**
 * Renders a high-resolution 1620x2025 ticket on HTML5 Canvas
 */
export async function renderTicketToCanvas(ticket: Ticket): Promise<HTMLCanvasElement> {
  // Ensure custom web fonts (Noto Sans Devanagari, Mukta, Hind) are fully loaded
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch (_e) {
      // Ignore font wait timeout
    }
  }

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
    margin: 3,
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
  const guestName = (ticket.name || ticket.guestName || 'Guest').trim();
  ctx.fillText(guestName, 810, 1475);
  ctx.restore();

  return canvas;
}

/**
 * Returns a base64 PNG data URL of the rendered ticket
 */
export async function renderTicketToDataUrl(ticket: Ticket): Promise<string> {
  if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/png')) {
    return ticket.imageBase64;
  }
  if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/svg')) {
    return convertToRasterPngDataUrl(ticket.imageBase64);
  }
  const canvas = await renderTicketToCanvas(ticket);
  return canvas.toDataURL('image/png');
}

/**
 * Downloads the single canonical ticket PNG image to the user's browser
 * Filename format: <Guest Name>_<ticketId>.png
 */
export async function downloadTicketPng(ticket: Ticket): Promise<void> {
  const guestName = (ticket.name || ticket.guestName || 'Guest').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = `${guestName}_${ticket.ticketId}.png`;

  // 1. Direct Base64 PNG data download
  if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/png;base64,')) {
    triggerBrowserDownload(ticket.imageBase64, fileName);
    return;
  }

  // 2. Base64 SVG data -> convert to real rasterized PNG first
  if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/svg')) {
    const pngDataUrl = await convertToRasterPngDataUrl(ticket.imageBase64);
    triggerBrowserDownload(pngDataUrl, fileName);
    return;
  }

  // 3. Supabase / Server Image URL -> convert to real rasterized PNG
  if (ticket.ticketImageUrl) {
    try {
      const resolvedUrl = getTicketPreviewUrl(ticket.ticketImageUrl);
      const pngDataUrl = await convertToRasterPngDataUrl(resolvedUrl);
      triggerBrowserDownload(pngDataUrl, fileName);
      return;
    } catch (fetchErr) {
      console.warn('[downloadTicketPng] Direct image rasterization failed, fallback to canvas:', fetchErr);
    }
  }

  // 4. Canvas render fallback
  const dataUrl = await renderTicketToDataUrl(ticket);
  triggerBrowserDownload(dataUrl, fileName);
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

    const guestName = (t.name || t.guestName || 'Guest').trim().replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${guestName}_${t.ticketId}.png`;

    try {
      let pngDataUrl = '';
      if (t.imageBase64 && t.imageBase64.startsWith('data:image/png;base64,')) {
        pngDataUrl = t.imageBase64;
      } else if (t.imageBase64 && t.imageBase64.startsWith('data:image/svg')) {
        pngDataUrl = await convertToRasterPngDataUrl(t.imageBase64);
      } else if (t.ticketImageUrl) {
        const resolvedUrl = getTicketPreviewUrl(t.ticketImageUrl);
        pngDataUrl = await convertToRasterPngDataUrl(resolvedUrl);
      } else {
        pngDataUrl = await renderTicketToDataUrl(t);
      }

      const base64Data = pngDataUrl.replace(/^data:image\/\w+;base64,/, '');
      folder.file(fileName, base64Data, { base64: true });
    } catch (err) {
      console.warn(`[downloadAllTicketsZipClient] Could not process ticket ${t.ticketId}:`, err);
    }
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


