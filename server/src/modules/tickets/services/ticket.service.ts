import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ticketRepository, TicketRepository, TicketFilterOptions } from '../repositories/ticket.repository';
import { guestRepository, GuestRepository } from '../../guests/repositories/guest.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import { qrService, QrService } from './qr.service';
import { ticketImageService, TicketImageService } from './ticket-image.service';
import { supabaseStorageService, SupabaseStorageService } from './supabase-storage.service';
import { AppError } from '../../../middlewares/error.middleware';

export class TicketService {
  constructor(
    private ticketRepo: TicketRepository = ticketRepository,
    private guestRepo: GuestRepository = guestRepository,
    private eventRepo: EventRepository = eventRepository,
    private ticketTypeRepo: TicketTypeRepository = ticketTypeRepository,
    private qrServ: QrService = qrService,
    private imageServ: TicketImageService = ticketImageService,
    private storageServ: SupabaseStorageService = supabaseStorageService
  ) {}

  /**
   * Generate tickets for all guests of an event.
   */
  async generateTicketsForEvent(eventId: string, userId: string) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    // 1. Fetch all guests for this event
    const guests = await this.guestRepo.findByEventId(eventId, 5000, 0);
    if (guests.length === 0) {
      throw new AppError('No guests found for this event. Please import guests first.', 400);
    }

    // 2. Fetch existing tickets to avoid regenerating duplicate tickets for same guest
    const existingTickets = await this.ticketRepo.findByEventId(eventId, { limit: 5000 });
    const guestsWithTickets = new Set(
      existingTickets.map((t) => t.ticket.guestId).filter(Boolean)
    );

    const pendingGuests = guests.filter((g) => !guestsWithTickets.has(g.id));
    if (pendingGuests.length === 0) {
      return {
        message: 'All guests already have tickets generated.',
        generatedCount: 0,
        totalGuests: guests.length,
      };
    }

    // 3. Fetch ticket types
    const ticketTypes = await this.ticketTypeRepo.findByEventId(eventId);
    const typeMap = new Map(ticketTypes.map((t) => [t.name.toUpperCase(), t]));
    const defaultType = ticketTypes.find((t) => t.name === 'GENERAL') || ticketTypes[0];

    if (!defaultType) {
      throw new AppError('No ticket types configured for this event.', 400);
    }

    let nextSeq = await this.ticketRepo.getNextSequenceNumber(eventId);
    let generatedCount = 0;

    for (const guest of pendingGuests) {
      const guestCategory = (guest.category || 'GENERAL').toUpperCase().trim();
      const matchedType = typeMap.get(guestCategory) || defaultType;

      // Generate 64-char crypto token
      const verificationToken = this.qrServ.generateVerificationToken();
      const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

      // Generate Ticket Image (1620x2025)
      const ticketSeqStr = nextSeq.toString().padStart(5, '0');
      const displayId = `${event.name.substring(0, 3).toUpperCase()}-${ticketSeqStr}`;

      const { filePath, publicUrl, imageBase64 } = await this.imageServ.generateTicketImage({
        ticketId: displayId,
        guestName: guest.name || 'Valued Guest',
        eventName: event.name,
        eventDate: event.date,
        ticketType: matchedType.label || matchedType.name,
        qrCodeDataUrl: qrDataUrl,
        organization: guest.organization || undefined,
        phone: guest.phone || undefined,
      });

      // Optional upload to Supabase Storage
      let assetUrl = publicUrl;
      let assetPath = filePath;

      if (this.storageServ.isConfigured()) {
        const storageFileName = `tickets/${eventId}/${verificationToken}.png`;
        const cloudUrl = await this.storageServ.uploadTicketImage(
          storageFileName,
          imageBase64 || filePath,
          'image/png'
        );
        if (cloudUrl) {
          assetUrl = cloudUrl;
          assetPath = storageFileName;
        }
      }

      // Insert Ticket Record
      await this.ticketRepo.create({
        eventId,
        guestId: guest.id,
        ticketTypeId: matchedType.id,
        verificationToken,
        status: 'ACTIVE',
        usagePolicy: matchedType.usagePolicy || 'SINGLE_USE',
        assetPath,
        assetUrl,
        sequenceNumber: nextSeq,
        createdBy: userId,
      });

      nextSeq++;
      generatedCount++;
    }

    return {
      message: `Successfully generated ${generatedCount} tickets.`,
      generatedCount,
      totalGuests: guests.length,
    };
  }

  /**
   * Generate unassigned worker tickets (guestId = null).
   */
  async generateUnassignedWorkerTickets(
    eventId: string,
    userId: string,
    count: number,
    ticketTypeName = 'WORKER'
  ) {
    if (count <= 0 || count > 500) {
      throw new AppError('Quantity must be between 1 and 500.', 400);
    }

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const ticketTypes = await this.ticketTypeRepo.findByEventId(eventId);
    let workerType = ticketTypes.find(
      (t) => t.name.toUpperCase() === ticketTypeName.toUpperCase()
    );

    if (!workerType) {
      workerType = await this.ticketTypeRepo.create({
        eventId,
        name: 'WORKER',
        label: 'Event Staff / Worker',
        usagePolicy: 'REUSABLE_WORKER',
      });
    }

    let nextSeq = await this.ticketRepo.getNextSequenceNumber(eventId);
    const createdTickets = [];

    for (let i = 0; i < count; i++) {
      const verificationToken = this.qrServ.generateVerificationToken();
      const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

      const ticketSeqStr = nextSeq.toString().padStart(5, '0');
      const displayId = `WRK-${ticketSeqStr}`;

      const { filePath, publicUrl, imageBase64 } = await this.imageServ.generateTicketImage({
        ticketId: displayId,
        guestName: 'UNASSIGNED STAFF',
        eventName: event.name,
        eventDate: event.date,
        ticketType: workerType.label || 'Event Staff',
        qrCodeDataUrl: qrDataUrl,
      });

      let assetUrl = publicUrl;
      let assetPath = filePath;

      if (this.storageServ.isConfigured()) {
        const storageFileName = `tickets/${eventId}/${verificationToken}.png`;
        const cloudUrl = await this.storageServ.uploadTicketImage(
          storageFileName,
          imageBase64 || filePath,
          'image/png'
        );
        if (cloudUrl) {
          assetUrl = cloudUrl;
          assetPath = storageFileName;
        }
      }

      const ticket = await this.ticketRepo.create({
        eventId,
        guestId: null, // Unassigned
        ticketTypeId: workerType.id,
        verificationToken,
        status: 'ACTIVE',
        usagePolicy: 'REUSABLE_WORKER',
        assetPath,
        assetUrl,
        sequenceNumber: nextSeq,
        createdBy: userId,
      });

      createdTickets.push(ticket);
      nextSeq++;
    }

    return {
      message: `Successfully generated ${count} unassigned worker tickets.`,
      tickets: createdTickets,
    };
  }

  /**
   * Get tickets for an event with pagination and filters.
   */
  async getTicketsByEvent(eventId: string, userId: string, options: TicketFilterOptions = {}) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const tickets = await this.ticketRepo.findByEventId(eventId, options);
    const total = await this.ticketRepo.countByEventId(eventId, options);

    return {
      tickets: tickets.map((t) => ({
        id: t.ticket.id,
        sequenceNumber: t.ticket.sequenceNumber,
        verificationToken: t.ticket.verificationToken,
        status: t.ticket.status,
        usagePolicy: t.ticket.usagePolicy,
        assetUrl: t.ticket.assetUrl,
        createdAt: t.ticket.createdAt,
        guest: t.guest
          ? {
              id: t.guest.id,
              name: t.guest.name,
              email: t.guest.email,
              phone: t.guest.phone,
              organization: t.guest.organization,
              designation: t.guest.designation,
              category: t.guest.category,
            }
          : {
              name: 'UNASSIGNED',
              category: t.ticketType.name,
            },
        ticketType: {
          id: t.ticketType.id,
          name: t.ticketType.name,
          label: t.ticketType.label,
          usagePolicy: t.ticketType.usagePolicy,
        },
      })),
      total,
      limit: options.limit || 1000,
      offset: options.offset || 0,
    };
  }

  /**
   * Get a single ticket by ID or token.
   */
  async getTicketById(idOrToken: string) {
    let ticket = await this.ticketRepo.findById(idOrToken);
    if (!ticket) {
      ticket = await this.ticketRepo.findByVerificationToken(idOrToken);
    }
    return ticket;
  }

  /**
   * Stream a ZIP archive containing all ticket images and a CSV manifest for an event.
   */
  async streamTicketsZip(eventId: string, userId: string, streamOut: NodeJS.WritableStream) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const tickets = await this.ticketRepo.findByEventId(eventId, { limit: 10000 });
    if (tickets.length === 0) {
      throw new AppError('No tickets found to export for this event.', 400);
    }

    const archive = (archiver as any)('zip', { zlib: { level: 6 } });
    archive.pipe(streamOut);

    // Build Manifest CSV
    const csvRows = [
      ['Sequence', 'Guest Name', 'Category', 'Status', 'Usage Policy', 'Verification Token', 'Asset URL'].join(','),
    ];

    for (const t of tickets) {
      const seqStr = t.ticket.sequenceNumber.toString().padStart(5, '0');
      const guestName = t.guest?.name || 'UNASSIGNED STAFF';
      const category = t.ticketType.name;
      const status = t.ticket.status;
      const policy = t.ticket.usagePolicy;
      const token = t.ticket.verificationToken;
      const assetUrl = t.ticket.assetUrl || '';

      csvRows.push(
        [
          `#${seqStr}`,
          `"${guestName.replace(/"/g, '""')}"`,
          `"${category.replace(/"/g, '""')}"`,
          status,
          policy,
          token,
          `"${assetUrl}"`,
        ].join(',')
      );

      // Add image file to archive if exists on local disk
      if (t.ticket.assetPath && fs.existsSync(t.ticket.assetPath)) {
        const fileExt = path.extname(t.ticket.assetPath) || '.png';
        const zipFileName = `tickets/ticket-${seqStr}-${guestName.replace(/[^a-zA-Z0-9]/g, '_')}${fileExt}`;
        archive.file(t.ticket.assetPath, { name: zipFileName });
      }
    }

    archive.append(csvRows.join('\n'), { name: 'tickets-manifest.csv' });

    await archive.finalize();
  }
}

export const ticketService = new TicketService();
