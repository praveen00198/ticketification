import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ticketRepository, TicketRepository, TicketFilterOptions } from '../repositories/ticket.repository';
import { guestRepository, GuestRepository } from '../../guests/repositories/guest.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import { qrService, QrService } from './qr.service';
import { ticketImageService, TicketImageService, isPngBuffer, formatTicketFileName } from './ticket-image.service';
import { supabaseStorageService, SupabaseStorageService } from './supabase-storage.service';
import { AppError } from '../../../middlewares/error.middleware';

export { formatTicketFileName };

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

    // 1. Fetch all guests for this event (up to 50,000)
    const guests = await this.guestRepo.findByEventId(eventId, 50000, 0);
    if (guests.length === 0) {
      throw new AppError('No guests found for this event. Please import guests first.', 400);
    }

    // 2. Fetch existing tickets to avoid regenerating duplicate tickets for same guest
    const existingTickets = await this.ticketRepo.findByEventId(eventId, { limit: 50000 });
    const guestsWithTickets = new Set(
      existingTickets.map((t) => t.ticket.guestId).filter(Boolean)
    );

    const pendingGuests = guests.filter((g) => !guestsWithTickets.has(g.id));

    // Ensure Supabase Storage is configured
    if (!this.storageServ.isConfigured()) {
      throw new AppError(
        'Supabase Storage is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in the environment.',
        500
      );
    }

    if (pendingGuests.length === 0) {
      return {
        message: `All ${existingTickets.length} guests already have valid tickets generated.`,
        generatedCount: 0,
        totalGuests: guests.length,
      };
    }

    // 3. Fetch ticket types (auto-seed default types if none exist)
    let ticketTypes = await this.ticketTypeRepo.findByEventId(eventId);
    if (ticketTypes.length === 0) {
      const defaultTypes = [
        { name: 'GENERAL', label: 'General Guest', usagePolicy: 'SINGLE_USE' },
        { name: 'VIP', label: 'VIP Guest', usagePolicy: 'SINGLE_USE' },
        { name: 'WORKER', label: 'Event Staff / Worker', usagePolicy: 'REUSABLE' },
        { name: 'SPEAKER', label: 'Speaker / Guest of Honor', usagePolicy: 'SINGLE_USE' },
        { name: 'ORGANIZER', label: 'Event Organizer', usagePolicy: 'SINGLE_USE' },
      ].map((t) => ({
        eventId,
        name: t.name,
        label: t.label,
        usagePolicy: t.usagePolicy,
      }));
      ticketTypes = await this.ticketTypeRepo.createMany(defaultTypes);
    }

    const typeMap = new Map(ticketTypes.map((t) => [t.name.toUpperCase(), t]));
    const defaultType = ticketTypes.find((t) => t.name === 'GENERAL') || ticketTypes[0];

    if (!defaultType) {
      throw new AppError('Unable to resolve ticket type for this event.', 500);
    }

    let nextSeq = await this.ticketRepo.getNextSequenceNumber(eventId);
    const ticketsToInsert: any[] = [];
    const uploadTasks: Array<{ storagePath: string; pngBuffer: Buffer; ticketRecord: any }> = [];

    let browser: any = null;
    try {
      browser = await this.imageServ.launchBrowser();

      for (const guest of pendingGuests) {
        const guestCategory = (guest.category || 'GENERAL').toUpperCase().trim();
        const matchedType = typeMap.get(guestCategory) || defaultType;

        // Generate 64-char crypto token
        const verificationToken = this.qrServ.generateVerificationToken();
        const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

        // Generate PNG Ticket Image Asset (1620x2025)
        const ticketSeqStr = nextSeq.toString().padStart(5, '0');
        const displayId = `${event.name.substring(0, 3).toUpperCase()}-${ticketSeqStr}`;

        const svgData = {
          ticketId: displayId,
          guestName: guest.name || 'Valued Guest',
          eventName: event.name,
          eventDate: event.date,
          ticketType: matchedType.label || matchedType.name,
          qrCodeDataUrl: qrDataUrl,
          organization: guest.organization || undefined,
          phone: guest.phone || undefined,
        };

        const svg = this.imageServ.buildSvg(svgData);
        const pngBuffer = await this.imageServ.svgToPng(svg, browser);
        const storagePath = `events/${eventId}/tickets/ticket-${displayId}.png`;

        const ticketRecord = {
          eventId,
          guestId: guest.id,
          ticketTypeId: matchedType.id,
          verificationToken,
          status: 'ACTIVE',
          usagePolicy: matchedType.usagePolicy || 'SINGLE_USE',
          assetPath: storagePath,
          assetUrl: '', // Populated upon successful Supabase Storage upload
          sequenceNumber: nextSeq,
          createdBy: userId,
        };

        ticketsToInsert.push(ticketRecord);
        uploadTasks.push({
          storagePath,
          pngBuffer,
          ticketRecord,
        });

        nextSeq++;
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (_e) {}
      }
    }

    // High-speed parallel upload to Supabase Storage in batches of 25
    if (uploadTasks.length > 0) {
      const BATCH_SIZE = 25;
      for (let i = 0; i < uploadTasks.length; i += BATCH_SIZE) {
        const batch = uploadTasks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (task) => {
            const uploadResult = await this.storageServ.uploadTicketImage(
              task.storagePath,
              task.pngBuffer,
              'image/png'
            );
            task.ticketRecord.assetUrl = uploadResult.publicUrl;
            task.ticketRecord.assetPath = uploadResult.storagePath;
          })
        );
      }
    }

    // Insert records into PostgreSQL only after all images are verified in Supabase Storage
    const inserted = await this.ticketRepo.createMany(ticketsToInsert);

    return {
      message: `Successfully generated and uploaded ${inserted.length} tickets to Supabase Storage.`,
      generatedCount: inserted.length,
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

    if (!this.storageServ.isConfigured()) {
      throw new AppError(
        'Supabase Storage is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in the environment.',
        500
      );
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
        usagePolicy: 'REUSABLE',
      });
    }

    let nextSeq = await this.ticketRepo.getNextSequenceNumber(eventId);
    const ticketsToInsert: any[] = [];
    const uploadTasks: Array<{ storagePath: string; pngBuffer: Buffer; ticketRecord: any }> = [];

    let browser: any = null;
    try {
      browser = await this.imageServ.launchBrowser();

      for (let i = 0; i < count; i++) {
        const verificationToken = this.qrServ.generateVerificationToken();
        const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

        const ticketSeqStr = nextSeq.toString().padStart(5, '0');
        const displayId = `WRK-${ticketSeqStr}`;

        const workerData = {
          ticketId: displayId,
          guestName: 'UNASSIGNED STAFF',
          eventName: event.name,
          eventDate: event.date,
          ticketType: workerType.label || 'Event Staff',
          qrCodeDataUrl: qrDataUrl,
        };

        const svg = this.imageServ.buildSvg(workerData);
        const pngBuffer = await this.imageServ.svgToPng(svg, browser);
        const storagePath = `events/${eventId}/tickets/ticket-${displayId}.png`;

        const ticketRecord = {
          eventId,
          guestId: null, // Unassigned
          ticketTypeId: workerType.id,
          verificationToken,
          status: 'ACTIVE',
          usagePolicy: 'REUSABLE',
          assetPath: storagePath,
          assetUrl: '', // Populated upon Supabase Storage upload
          sequenceNumber: nextSeq,
          createdBy: userId,
        };

        ticketsToInsert.push(ticketRecord);
        uploadTasks.push({
          storagePath,
          pngBuffer,
          ticketRecord,
        });

        nextSeq++;
      }
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (_e) {}
      }
    }

    if (uploadTasks.length > 0) {
      const BATCH_SIZE = 25;
      for (let i = 0; i < uploadTasks.length; i += BATCH_SIZE) {
        const batch = uploadTasks.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (task) => {
            const uploadResult = await this.storageServ.uploadTicketImage(
              task.storagePath,
              task.pngBuffer,
              'image/png'
            );
            task.ticketRecord.assetUrl = uploadResult.publicUrl;
            task.ticketRecord.assetPath = uploadResult.storagePath;
          })
        );
      }
    }

    const createdTickets = await this.ticketRepo.createMany(ticketsToInsert);

    return {
      message: `Successfully generated and uploaded ${createdTickets.length} unassigned worker tickets to Supabase Storage.`,
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
   * Stream a ZIP archive containing all PNG ticket images retrieved from Supabase Storage and a CSV manifest.
   * Processes in memory-conscious batches so large events (1,000+ tickets) stream smoothly.
   * All files inside the ZIP are genuine PNG binaries formatted as <Guest-Name>-<Ticket-ID>.png.
   */
  async streamTicketsZip(eventId: string, userId: string, streamOut: NodeJS.WritableStream) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const tickets = await this.ticketRepo.findByEventId(eventId, { limit: 50000 });
    if (tickets.length === 0) {
      throw new AppError('No tickets found to export for this event.', 400);
    }

    const archive = (archiver as any)('zip', { zlib: { level: 6 } });
    archive.pipe(streamOut);

    const csvRows = [
      ['Sequence', 'Guest Name', 'Category', 'Status', 'Usage Policy', 'File Name', 'Asset Source', 'Verification Token', 'Asset URL'].join(','),
    ];

    let retrievedPngCount = 0;
    let convertedFromSvgCount = 0;
    let recoveredPngCount = 0;
    const BATCH_SIZE = 20;

    let browser: any = null;
    try {
      for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
        const batch = tickets.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (t) => {
            const seqStr = t.ticket.sequenceNumber.toString().padStart(5, '0');
            const displayId = `${event.name.substring(0, 3).toUpperCase()}-${seqStr}`;
            const fileName = formatTicketFileName(t.guest?.name, displayId);

            const pngStoragePath = `events/${eventId}/tickets/ticket-${displayId}.png`;
            const svgStoragePath = t.ticket.assetPath || `events/${eventId}/tickets/ticket-${displayId}.svg`;

            let fileBuffer: Buffer | null = null;
            let source = 'SUPABASE_STORAGE_PNG';

            // 1. Try to download directly from pngStoragePath
            try {
              const buf = await this.storageServ.downloadTicketImage(pngStoragePath);
              if (isPngBuffer(buf)) {
                fileBuffer = buf;
              }
            } catch (_e) {}

            // 2. If not found as PNG, check current assetPath
            if (!fileBuffer && t.ticket.assetPath && t.ticket.assetPath !== pngStoragePath) {
              try {
                const buf = await this.storageServ.downloadTicketImage(t.ticket.assetPath);
                if (isPngBuffer(buf)) {
                  fileBuffer = buf;
                } else {
                  // It's an SVG from Supabase Storage! Convert to genuine PNG
                  if (!browser) {
                    browser = await this.imageServ.launchBrowser();
                  }
                  fileBuffer = await this.imageServ.svgToPng(buf.toString('utf-8'), browser);
                  source = 'CONVERTED_FROM_STORAGE_SVG';

                  // Persist the PNG back to Supabase Storage
                  try {
                    const uploadResult = await this.storageServ.uploadTicketImage(
                      pngStoragePath,
                      fileBuffer,
                      'image/png'
                    );
                    await this.ticketRepo.update(t.ticket.id, {
                      assetUrl: uploadResult.publicUrl,
                      assetPath: uploadResult.storagePath,
                    });
                  } catch (_cacheErr) {}
                }
              } catch (_e) {}
            }

            // 3. Fallback recovery: render fresh PNG from template & QR if storage asset was missing
            if (!fileBuffer) {
              if (!browser) {
                browser = await this.imageServ.launchBrowser();
              }
              source = 'RECOVERED_ON_DEMAND_PNG';
              const qrDataUrl = await this.qrServ.generateQrDataUrl(t.ticket.verificationToken);
              const svg = this.imageServ.buildSvg({
                ticketId: displayId,
                guestName: t.guest?.name || (t.ticket.usagePolicy === 'REUSABLE' ? 'Event Staff' : 'Valued Guest'),
                eventName: event.name,
                eventDate: event.date,
                ticketType: t.ticketType.label || t.ticketType.name,
                qrCodeDataUrl: qrDataUrl,
                organization: t.guest?.organization || undefined,
                phone: t.guest?.phone || undefined,
              });
              fileBuffer = await this.imageServ.svgToPng(svg, browser);

              try {
                const uploadResult = await this.storageServ.uploadTicketImage(
                  pngStoragePath,
                  fileBuffer,
                  'image/png'
                );
                await this.ticketRepo.update(t.ticket.id, {
                  assetUrl: uploadResult.publicUrl,
                  assetPath: uploadResult.storagePath,
                });
              } catch (_saveErr) {}
            }

            // Final guarantee: MUST be genuine PNG binary
            if (!isPngBuffer(fileBuffer)) {
              if (!browser) {
                browser = await this.imageServ.launchBrowser();
              }
              fileBuffer = await this.imageServ.svgToPng(fileBuffer.toString('utf-8'), browser);
            }

            return {
              t,
              fileName,
              fileBuffer,
              source,
              seqStr,
            };
          })
        );

        for (const item of batchResults) {
          if (item.source === 'SUPABASE_STORAGE_PNG') {
            retrievedPngCount++;
          } else if (item.source === 'CONVERTED_FROM_STORAGE_SVG') {
            convertedFromSvgCount++;
          } else {
            recoveredPngCount++;
          }

          archive.append(item.fileBuffer, { name: item.fileName });

          csvRows.push(
            [
              `#${item.seqStr}`,
              `"${(item.t.guest?.name || 'Staff').replace(/"/g, '""')}"`,
              `"${item.t.ticketType.name.replace(/"/g, '""')}"`,
              item.t.ticket.status,
              item.t.ticket.usagePolicy,
              item.fileName,
              item.source,
              item.t.ticket.verificationToken,
              `"${item.t.ticket.assetUrl || ''}"`,
            ].join(',')
          );
        }
      }

      // Include manifest and summary
      archive.append(csvRows.join('\n'), { name: 'tickets-manifest.csv' });
      archive.append(
        [
          '================================================',
          'EVENT TICKET BULK EXPORT SUMMARY',
          '================================================',
          `Event: ${event.name}`,
          `Date: ${event.date}`,
          `Total Tickets Exported: ${tickets.length}`,
          `Retrieved as PNG from Supabase Storage: ${retrievedPngCount}`,
          `Converted from Storage SVG to PNG: ${convertedFromSvgCount}`,
          `Recovered On-Demand PNG: ${recoveredPngCount}`,
          `Export Generated At: ${new Date().toISOString()}`,
          '================================================',
        ].join('\n'),
        { name: 'export-summary.txt' }
      );

      await archive.finalize();
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (_e) {}
      }
    }
  }
}

export const ticketService = new TicketService();
