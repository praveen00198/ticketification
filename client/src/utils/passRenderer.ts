import QRCode from 'qrcode';
import { AttendeeWalletItem } from '../api/attendee';

/**
 * Renders an AttendeeWalletItem into a high-resolution 1200x1500 PNG Blob
 * directly on client-side HTML5 Canvas.
 *
 * Enforces all product invariants:
 * 1. NO Pass ID, Credential ID, or sequence number visible.
 * 2. NO static verification status (ACTIVE, VERIFIED, etc.) visible.
 * 3. Pure black QR code modules on crisp white background with quiet zone.
 * 4. Contemporary editorial typography, lanyard slot, and perforation dividers.
 */
export async function renderWalletPassToBlob(pass: AttendeeWalletItem): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Canvas rendering requires a browser environment');
  }

  // Ensure document fonts (Inter) are ready
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch (_) {}
  }

  const width = 1200;
  const height = 1500;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D canvas context');
  }

  // 1. Overall Outer Background
  ctx.fillStyle = '#F4F4F5';
  ctx.fillRect(0, 0, width, height);

  // 2. Main Ticket Card Container (Elevated rounded card)
  const cardX = 80;
  const cardY = 60;
  const cardW = width - 160; // 1040px
  const cardH = height - 120; // 1380px
  const cardRadius = 36;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
  ctx.fill();
  ctx.restore();

  // Card Border
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
  ctx.stroke();

  // 3. Top Emerald Brand Accent Ribbon
  ctx.save();
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, 12, [cardRadius, cardRadius, 0, 0]);
  ctx.fill();
  ctx.restore();

  // 4. Lanyard Punch Slot (Centered badge pill)
  ctx.save();
  ctx.fillStyle = '#F4F4F5';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  const slotW = 160;
  const slotH = 24;
  const slotX = (width - slotW) / 2;
  const slotY = cardY + 28;
  ctx.beginPath();
  ctx.roundRect(slotX, slotY, slotW, slotH, 12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 5. Header Branding & Category Badge
  const headerY = cardY + 85;

  // Left: Ticketification Brand Mark
  ctx.save();
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.arc(cardX + 50, headerY, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#71717A';
  ctx.font = '800 16px "Inter", -apple-system, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('TICKETIFICATION', cardX + 66, headerY + 5);
  ctx.restore();

  // Right: Event Category Pill
  const categoryText = (pass.categoryName || pass.eventType || 'EVENT PASS').toUpperCase().replace('_', ' ');
  ctx.save();
  ctx.font = '700 15px "Inter", -apple-system, sans-serif';
  const textWidth = ctx.measureText(categoryText).width;
  const pillW = Math.max(120, textWidth + 36);
  const pillH = 34;
  const pillX = cardX + cardW - 50 - pillW;
  const pillY = headerY - 17;

  ctx.fillStyle = '#ECFDF5';
  ctx.strokeStyle = '#A7F3D0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 17);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#059669';
  ctx.textAlign = 'center';
  ctx.fillText(categoryText, pillX + pillW / 2, pillY + 22);
  ctx.restore();

  // Thin separator under header
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cardX + 50, headerY + 30);
  ctx.lineTo(cardX + cardW - 50, headerY + 30);
  ctx.stroke();

  // 6. Event Title (Hero editorial text)
  ctx.save();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 38px "Inter", -apple-system, sans-serif';
  const eventTitle = pass.eventName || 'Official Event Gathering';
  // Wrap or truncate title to 1-2 lines
  const words = eventTitle.split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    if ((line1 + ' ' + w).length <= 28) {
      line1 += (line1 ? ' ' : '') + w;
    } else if ((line2 + ' ' + w).length <= 32) {
      line2 += (line2 ? ' ' : '') + w;
    } else {
      break;
    }
  }
  const titleY = headerY + 75;
  ctx.fillText(line1, cardX + 50, titleY);
  if (line2) {
    ctx.fillText(line2, cardX + 50, titleY + 44);
  }
  ctx.restore();

  // 7. Schedule & Location Columns
  const infoY = line2 ? titleY + 95 : titleY + 65;

  // Schedule Column
  let dayOfWeek = 'EVENT PASS';
  let dateText = 'Date TBA';
  let timeText = '';
  if (pass.schedule?.startAt) {
    const d = new Date(pass.schedule.startAt);
    if (!isNaN(d.getTime())) {
      dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      dateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      timeText = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  }

  ctx.save();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 13px "Inter", -apple-system, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('DATE & TIME', cardX + 50, infoY);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 20px "Inter", -apple-system, sans-serif';
  ctx.fillText(dayOfWeek, cardX + 50, infoY + 28);

  ctx.fillStyle = '#475569';
  ctx.font = '600 16px "Inter", -apple-system, sans-serif';
  ctx.fillText(timeText ? `${dateText} • ${timeText}` : dateText, cardX + 50, infoY + 52);

  // Location Column
  const locX = cardX + 520;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 13px "Inter", -apple-system, sans-serif';
  ctx.fillText('LOCATION', locX, infoY);

  const venueName = pass.venue?.city
    ? `${pass.venue?.name ? `${pass.venue.name}, ` : ''}${pass.venue.city}`
    : pass.venue?.name || (pass.venue?.type === 'ONLINE' ? 'Virtual Gathering' : 'Venue TBA');

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 20px "Inter", -apple-system, sans-serif';
  const cleanVenue = venueName.length > 32 ? venueName.slice(0, 30) + '…' : venueName;
  ctx.fillText(cleanVenue, locX, infoY + 28);
  ctx.restore();

  // 8. Optional Team / Cohort Section & Hero Attendee
  const teamName = pass.teamName || (pass as any).team?.name;
  let attendeeSectionY = infoY + 95;

  if (teamName) {
    ctx.save();
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 12px "Inter", -apple-system, sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText('TEAM / COHORT', cardX + 50, attendeeSectionY);

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 24px "Inter", -apple-system, sans-serif';
    ctx.fillText(teamName.toUpperCase(), cardX + 50, attendeeSectionY + 30);
    ctx.restore();

    attendeeSectionY += 75;
  }

  // Hero Attendee Name
  ctx.save();
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 13px "Inter", -apple-system, sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('ATTENDEE', cardX + 50, attendeeSectionY);

  const holderName = pass.holder?.name || 'Valued Guest';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 36px "Inter", "Noto Sans Devanagari", -apple-system, sans-serif';
  ctx.fillText(holderName, cardX + 50, attendeeSectionY + 42);

  if (pass.holder?.organization && pass.holder.organization !== teamName) {
    ctx.fillStyle = '#64748B';
    ctx.font = '600 16px "Inter", -apple-system, sans-serif';
    ctx.fillText(pass.holder.organization, cardX + 50, attendeeSectionY + 70);
  }
  ctx.restore();

  // 9. Perforation Line with Edge Notches
  const perfoY = 790;
  const notchRadius = 24;

  // Left notch
  ctx.save();
  ctx.fillStyle = '#F4F4F5';
  ctx.beginPath();
  ctx.arc(cardX, perfoY, notchRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Right notch
  ctx.beginPath();
  ctx.arc(cardX + cardW, perfoY, notchRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Dashed line
  ctx.save();
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(cardX + notchRadius + 10, perfoY);
  ctx.lineTo(cardX + cardW - notchRadius - 10, perfoY);
  ctx.stroke();
  ctx.restore();

  // 10. Admission Zone (Centered High-Contrast QR Code)
  const qrCardW = 440;
  const qrCardH = 440;
  const qrCardX = (width - qrCardW) / 2;
  const qrCardY = perfoY + 45;

  ctx.save();
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(qrCardX, qrCardY, qrCardW, qrCardH, 24);
  ctx.fill();
  ctx.stroke();

  // Inner pure white surface
  const innerPad = 24;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(qrCardX + innerPad, qrCardY + innerPad, qrCardW - innerPad * 2, qrCardH - innerPad * 2, 16);
  ctx.fill();
  ctx.restore();

  // Generate QR Code onto in-memory canvas
  const verifyUrl = `${window.location.origin}/verify/${pass.verificationToken}`;
  const qrCanvas = document.createElement('canvas');
  const qrSize = qrCardW - innerPad * 2 - 32;

  await QRCode.toCanvas(qrCanvas, verifyUrl, {
    width: qrSize,
    margin: 1,
    color: {
      dark: '#09090b',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });

  // Draw QR canvas centered
  const qrDrawX = qrCardX + innerPad + 16;
  const qrDrawY = qrCardY + innerPad + 16;
  ctx.drawImage(qrCanvas, qrDrawX, qrDrawY, qrSize, qrSize);

  // 11. Gate Turnstile Instruction
  ctx.save();
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "Inter", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Present this QR code at the entry gate turnstile for admission', width / 2, qrCardY + qrCardH + 45);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 13px "Inter", monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('SECURE TAMPER-PROOF ACCESS CREDENTIAL', width / 2, qrCardY + qrCardH + 75);

  // 12. Bottom Footer
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cardX + 50, cardY + cardH - 55);
  ctx.lineTo(cardX + cardW - 50, cardY + cardH - 55);
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 15px "Inter", -apple-system, sans-serif';
  ctx.fillText('Powered by Ticketification • Official Event Pass', width / 2, cardY + cardH - 25);
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob from pass canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Renders a TicketListItem and event metadata into a high-resolution 1200x1500 PNG Blob
 * using the official editorial pass layout.
 */
export async function renderTicketListItemToBlob(
  ticket: {
    id: string;
    sequenceNumber: number;
    verificationToken: string;
    status: string;
    usagePolicy: string;
    assetUrl?: string | null;
    guest?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      organization?: string | null;
      designation?: string | null;
      category?: string;
    };
    ticketType?: {
      id?: string;
      name?: string;
      label?: string;
      usagePolicy?: string;
    };
  },
  event: any
): Promise<Blob> {
  const isWorker = ticket.ticketType?.name === 'WORKER' || !ticket.guest?.name || ticket.guest.name === 'UNASSIGNED';
  const holderName =
    ticket.guest?.name && ticket.guest.name !== 'UNASSIGNED'
      ? ticket.guest.name
      : (isWorker ? 'Event Staff' : 'Valued Guest');

  const walletItem: AttendeeWalletItem = {
    credentialId: ticket.id,
    eventId: event?.id || '',
    eventName: event?.name || 'Event',
    eventType: event?.category || event?.eventType || 'General Event',
    categoryName: ticket.ticketType?.label || ticket.guest?.category || 'General Admission',
    schedule: event?.schedule || {},
    venue: event?.venue || {},
    credentialTerminology: 'Pass',
    credentialType: ticket.ticketType?.name || 'GENERAL',
    formattedId: `PASS-${ticket.sequenceNumber.toString().padStart(5, '0')}`,
    verificationToken: ticket.verificationToken,
    status: (ticket.status as any) || 'ACTIVE',
    usagePolicy: ticket.usagePolicy || 'SINGLE_USE',
    checkInCount: 0,
    holder: {
      name: holderName,
      email: ticket.guest?.email || null,
      phone: ticket.guest?.phone || null,
      organization: ticket.guest?.organization || null,
      designation: ticket.guest?.designation || null,
      category: ticket.guest?.category || ticket.ticketType?.name || 'GENERAL',
    },
    asset: {
      storagePath: null,
      publicUrl: ticket.assetUrl || null,
      mimeType: 'image/png',
    },
  };

  return renderWalletPassToBlob(walletItem);
}
