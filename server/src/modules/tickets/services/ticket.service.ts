import { Response } from 'express';
import { ZipArchive } from 'archiver';
import { ticketRepository, TicketRepository } from '../repositories/ticket.repository';
import { userRepository, UserRepository } from '../../auth/repositories/user.repository';
import { qrService, QrService } from './qr.service';
import { ticketImageService, TicketImageService } from './ticket-image.service';
import { deliveryService, DeliveryService } from '../../delivery/services/delivery.service';
import { ITicketDocument } from '../models/ticket.model';
import { AppError } from '../../../middlewares/error.middleware';
import config from '../../../config/env';
import path from 'path';
import fs from 'fs';

export interface GenerateTicketsPayload {
  guests: Array<{
    name: string;
    email?: string;
    phone?: string;
    event?: string;
    ticketType?: string;
    organization?: string;
    designation?: string;
  }>;
}

export function generateEventPrefix(eventName?: string): string {
  if (!eventName || !eventName.trim()) return 'EVT';
  const clean = eventName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    if (words.length === 2) {
      // E.g. Ganesh Chaturthi -> GNCH
      const w1 = words[0].toUpperCase();
      const w2 = words[1].toUpperCase();
      const p1 = w1.length >= 2 ? w1.substring(0, 2) : w1;
      const p2 = w2.length >= 2 ? w2.substring(0, 2) : w2;
      return `${p1}${p2}`;
    } else {
      // E.g. Grand Annual Tech Meet -> GATM
      const initials = words.map((w) => w[0]).join('').toUpperCase().substring(0, 4);
      return initials.length >= 2 ? initials : 'EVT';
    }
  } else if (words.length === 1) {
    const word = words[0].toUpperCase();
    return word.substring(0, 4);
  }
  return 'EVT';
}

export class TicketService {
  constructor(
    private ticketRepo: TicketRepository = ticketRepository,
    private userRepo: UserRepository = userRepository,
    private qrServ: QrService = qrService,
    private imageServ: TicketImageService = ticketImageService,
    private deliverySvc: DeliveryService = deliveryService
  ) {}

  private async generateNextTicketId(eventName: string): Promise<string> {
    const prefix = generateEventPrefix(eventName);
    const existing = await this.ticketRepo.findAll({});
    let maxNum = 0;
    const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
    for (const t of existing) {
      const match = t.ticketId.match(regex);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    }
    let counter = maxNum + 1;
    let candidate = `${prefix}-${counter.toString().padStart(5, '0')}`;
    let exists = await this.ticketRepo.findByTicketId(candidate);
    while (exists) {
      counter++;
      candidate = `${prefix}-${counter.toString().padStart(5, '0')}`;
      exists = await this.ticketRepo.findByTicketId(candidate);
    }
    return candidate;
  }

  async generateTickets(payload: GenerateTicketsPayload, userId?: string) {
    if (!payload.guests || payload.guests.length === 0) {
      throw new AppError('No guest records provided for ticket generation.', 400);
    }

    const user = userId ? await this.userRepo.findById(userId) : null;
    const eventName = user?.eventName || payload.guests[0]?.event || 'Ticketification Event';

    const providerName = this.deliverySvc.getProviderName();
    const generatedTickets: ITicketDocument[] = [];

    // Phase 1: Generate all tickets (QR + image)
    for (const g of payload.guests) {
      const ticketId = await this.generateNextTicketId(eventName);
      const verificationToken = this.qrServ.generateVerificationToken();

      // 1. Save ticket metadata to database
      const ticket = await this.ticketRepo.create({
        ticketId,
        verificationToken,
        name: g.name,
        email: g.email,
        phone: g.phone,
        event: eventName,
        eventDate: new Date(),
        ticketType: g.ticketType || 'Guest Pass',
        organization: g.organization,
        designation: g.designation,
        status: 'ACTIVE',
        emailStatus: 'PENDING',
        deliveryProvider: providerName === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
        deliveryStatus: 'PENDING',
        createdBy: userId,
      });

      // 2. Generate QR code Data URL
      const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

      // 3. Generate ticket image (PNG)
      const { filePath, publicUrl } = await this.imageServ.generateTicketImage({
        ticketId: ticket.ticketId,
        guestName: ticket.name,
        eventName: ticket.event,
        eventDate: '',
        ticketType: ticket.ticketType,
        qrCodeDataUrl: qrDataUrl,
        organization: ticket.organization,
        phone: ticket.phone,
      });

      // 4. Store the public URL in DB
      await this.ticketRepo.updateTicketImageUrl(ticket._id.toString(), publicUrl);
      ticket.ticketImageUrl = publicUrl;

      generatedTickets.push(ticket);
    }

    // WhatsApp and Email sharing disabled per user request:
    // Simply return generated tickets for instant download.
    /*
    await this.deliverySvc.sendBatch(deliveryItems, async (completed, total, result) => {
      if (result.success) {
        sentCount++;
        const t = generatedTickets.find((t) => t.ticketId === result.ticketId);
        if (t) {
          await this.ticketRepo.updateDeliveryStatus(t._id.toString(), 'SENT', result.providerMessageId);
        }
      } else {
        failedCount++;
        const t = generatedTickets.find((t) => t.ticketId === result.ticketId);
        if (t) {
          await this.ticketRepo.updateDeliveryStatus(t._id.toString(), 'FAILED');
        }
      }
    });
    */

    return {
      totalGenerated: generatedTickets.length,
      deliveryProvider: 'NONE',
      sent: 0,
      failed: 0,
      tickets: generatedTickets,
    };
  }

  /**
   * Idempotent resend — re-uses existing ticket ID, verification token, QR, and image.
   * Only re-triggers delivery without generating duplicate records.
   */
  async resendTicket(ticketId: string, userId?: string) {
    const ticket = await this.ticketRepo.findByTicketId(ticketId, userId);
    if (!ticket) {
      throw new AppError('Ticket not found or access denied.', 404);
    }

    // If ticket image doesn't exist, regenerate it
    let imagePath = '';
    if (ticket.ticketImageUrl) {
      const fileName = `ticket-${ticket.ticketId}.png`;
      imagePath = path.resolve(process.cwd(), config.env.uploadDir, 'tickets', fileName);

      if (!fs.existsSync(imagePath)) {
        const qrDataUrl = await this.qrServ.generateQrDataUrl(ticket.verificationToken);
        const result = await this.imageServ.generateTicketImage({
          ticketId: ticket.ticketId,
          guestName: ticket.name,
          eventName: ticket.event,
          eventDate: ticket.eventDate.toDateString(),
          ticketType: ticket.ticketType,
          qrCodeDataUrl: qrDataUrl,
          organization: ticket.organization,
          phone: ticket.phone,
        });
        imagePath = result.filePath;
      }
    } else {
      const qrDataUrl = await this.qrServ.generateQrDataUrl(ticket.verificationToken);
      const result = await this.imageServ.generateTicketImage({
        ticketId: ticket.ticketId,
        guestName: ticket.name,
        eventName: ticket.event,
        eventDate: ticket.eventDate.toDateString(),
        ticketType: ticket.ticketType,
        qrCodeDataUrl: qrDataUrl,
        organization: ticket.organization,
        phone: ticket.phone,
      });
      imagePath = result.filePath;
      await this.ticketRepo.updateTicketImageUrl(ticket._id.toString(), result.publicUrl);
    }

    // Mark as SENDING
    await this.ticketRepo.updateDeliveryStatus(ticket._id.toString(), 'SENDING');

    const deliveryResult = await this.deliverySvc.sendTicket(ticket, imagePath);

    if (deliveryResult.success) {
      await this.ticketRepo.updateDeliveryStatus(ticket._id.toString(), 'SENT', deliveryResult.providerMessageId);
      return { success: true, message: `Ticket ${ticket.ticketId} resent successfully.` };
    } else {
      await this.ticketRepo.updateDeliveryStatus(ticket._id.toString(), 'FAILED');
      throw new AppError(`Failed to resend ticket ${ticket.ticketId}: ${deliveryResult.error}`, 500);
    }
  }

  // Legacy method name preserved for backward compatibility
  async resendTicketEmail(ticketId: string, userId?: string) {
    return this.resendTicket(ticketId, userId);
  }

  private normalizeTicketUrl(url?: string): string | undefined {
    if (!url) return undefined;
    const baseUrl =
      process.env.TICKET_STORAGE_BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (config.env.isProduction ? 'https://ticketification.onrender.com' : `http://localhost:${config.env.port}`);
    const uploadsIndex = url.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      const relativePath = url.substring(uploadsIndex);
      return `${baseUrl.replace(/\/+$/, '')}${relativePath}`;
    }
    return url;
  }

  async getAllTickets(filter: any = {}, userId?: string) {
    const finalFilter = { ...filter };
    if (userId) {
      finalFilter.createdBy = userId;
    }
    const tickets = await this.ticketRepo.findAll(finalFilter);
    return tickets.map((t: any) => {
      const doc = typeof t.toObject === 'function' ? t.toObject() : { ...t };
      if (doc.ticketImageUrl) {
        doc.ticketImageUrl = this.normalizeTicketUrl(doc.ticketImageUrl);
      }
      return doc;
    });
  }

  async getTicketById(id: string, userId?: string) {
    const ticket = await this.ticketRepo.findById(id, userId);
    if (!ticket) {
      throw new AppError('Ticket not found or access denied.', 404);
    }
    const doc: any = typeof (ticket as any).toObject === 'function' ? (ticket as any).toObject() : { ...ticket };
    if (doc.ticketImageUrl) {
      doc.ticketImageUrl = this.normalizeTicketUrl(doc.ticketImageUrl);
    }
    return doc;
  }

  async getTicketImageFilePath(ticketId: string, userId?: string): Promise<{ filePath: string; fileName: string }> {
    const ticket = await this.ticketRepo.findByIdOrTicketId(ticketId, userId);
    if (!ticket) {
      throw new AppError('Ticket not found or access denied.', 404);
    }

    const safeName = ticket.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    const downloadFileName = `${safeName || 'Guest'}_${ticket.ticketId}.png`;
    const fileName = `ticket-${ticket.ticketId}.png`;
    let filePath = path.resolve(process.cwd(), config.env.uploadDir, 'tickets', fileName);

    // If image not generated yet, generate it on demand
    if (!fs.existsSync(filePath)) {
      const qrDataUrl = await this.qrServ.generateQrDataUrl(ticket.verificationToken);
      const res = await this.imageServ.generateTicketImage({
        ticketId: ticket.ticketId,
        guestName: ticket.name,
        eventName: ticket.event,
        eventDate: '',
        ticketType: ticket.ticketType,
        qrCodeDataUrl: qrDataUrl,
        organization: ticket.organization,
        phone: ticket.phone,
      });
      filePath = res.filePath;
      await this.ticketRepo.updateTicketImageUrl(ticket._id.toString(), res.publicUrl);
    }

    return { filePath, fileName: downloadFileName };
  }

  async streamAllTicketsZip(res: Response, userId?: string) {
    const filter = userId ? { createdBy: userId } : {};
    const tickets = await this.ticketRepo.findAll(filter);

    if (!tickets || tickets.length === 0) {
      throw new AppError('No tickets found to download.', 404);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="ticketification-all-tickets.zip"');

    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on('error', (err: any) => {
      console.error('[TicketService Archive Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Failed to generate zip file.' } });
      }
    });

    archive.pipe(res);

    for (const ticket of tickets) {
      const fileName = `ticket-${ticket.ticketId}.png`;
      let filePath = path.resolve(process.cwd(), config.env.uploadDir, 'tickets', fileName);

      if (!fs.existsSync(filePath)) {
        try {
          const qrDataUrl = await this.qrServ.generateQrDataUrl(ticket.verificationToken);
          const gen = await this.imageServ.generateTicketImage({
            ticketId: ticket.ticketId,
            guestName: ticket.name,
            eventName: ticket.event,
            eventDate: '',
            ticketType: ticket.ticketType,
            qrCodeDataUrl: qrDataUrl,
            organization: ticket.organization,
            phone: ticket.phone,
          });
          filePath = gen.filePath;
          await this.ticketRepo.updateTicketImageUrl(ticket._id.toString(), gen.publicUrl);
        } catch (e) {
          console.warn(`[TicketService Zip Warning] Could not render image for ${ticket.ticketId}:`, e);
          continue;
        }
      }

      if (fs.existsSync(filePath)) {
        // Sanitize name for clean zip filename starting with guest name: GuestName_TicketID.png
        const safeName = ticket.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
        const zipEntryName = `${safeName || 'Guest'}_${ticket.ticketId}.png`;
        archive.file(filePath, { name: zipEntryName });
      }
    }

    await archive.finalize();
  }
}

export const ticketService = new TicketService();
