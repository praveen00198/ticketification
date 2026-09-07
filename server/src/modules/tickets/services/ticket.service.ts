import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ticketRepository, TicketRepository, TicketFilterOptions } from '../repositories/ticket.repository';
import { guestRepository, GuestRepository } from '../../guests/repositories/guest.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import { qrService, QrService } from './qr.service';
import {
  ticketImageService,
  TicketImageService,
  TicketImageData,
  isPngBuffer,
  formatTicketFileName,
} from './ticket-image.service';
import { supabaseStorageService, SupabaseStorageService } from './supabase-storage.service';
import {
  AppError,
  NotFoundError,
  ValidationError,
  StorageError,
} from '../../../middlewares/error.middleware';
import { GenerateTicketsResult } from '../ticket.types';
import { logMemory, MemoryTracker } from '../../../utils/memory-logger';

export { formatTicketFileName };

let _archiverModule: any = null;

/**
 * Safely instantiates a ZipArchive instance across archiver version module formats (CJS/ESM).
 */
async function createZipArchive(options: any = { zlib: { level: 6 } }) {
  try {
    if (!_archiverModule) {
      try {
        _archiverModule = require('archiver');
      } catch {
        const imported = await import('archiver');
        _archiverModule = imported.default || imported;
      }
    }

    if (typeof _archiverModule === 'function') {
      return _archiverModule('zip', options);
    }
    if (typeof _archiverModule?.ZipArchive === 'function') {
      return new _archiverModule.ZipArchive(options);
    }
    if (typeof _archiverModule?.default === 'function') {
      return _archiverModule.default('zip', options);
    }
    if (typeof _archiverModule?.default?.ZipArchive === 'function') {
      return new _archiverModule.default.ZipArchive(options);
    }
  } catch (err) {
    console.error('[Archiver] Error initializing archiver engine:', err);
  }
  throw new AppError('Zip compression engine is unavailable.', 500);
}

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
   * Produces genuine PNG binaries (0x89504E47) and uploads directly to Supabase Storage.
   */
  async generateTicketsForEvent(eventId: string, userId: string): Promise<GenerateTicketsResult> {
    const tracker = new MemoryTracker();

    // ── LIFECYCLE POINT 3: Immediately before ticket generation starts ──
    tracker.start('generation_start');

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    // 1. Fetch all guests for this event
    const guests = await this.guestRepo.findByEventId(eventId, 50000, 0);

    // ── LIFECYCLE POINT 4: After guest list is loaded ──
    tracker.checkpoint('guests_loaded', { guestCount: guests.length });

    if (guests.length === 0) {
      throw new ValidationError('No guests found for this event. Please import guests first.');
    }

    // 2. Fetch existing tickets to avoid regenerating duplicates
    const existingTickets = await this.ticketRepo.findByEventId(eventId, { limit: 50000 });
    const guestsWithTickets = new Set(
      existingTickets.map((t) => t.ticket.guestId).filter(Boolean)
    );

    const pendingGuests = guests.filter((g) => !guestsWithTickets.has(g.id));

    tracker.checkpoint('pending_guests_filtered', {
      existingTickets: existingTickets.length,
      pendingGuests: pendingGuests.length,
    });

    if (!this.storageServ.isConfigured()) {
      throw new StorageError(
        'Supabase Storage is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in the environment.'
      );
    }

    if (pendingGuests.length === 0) {
      return {
        message: `All ${existingTickets.length} guests already have valid tickets generated.`,
        generatedCount: 0,
        totalGuests: guests.length,
      };
    }

    // 3. Resolve ticket types (auto-seed default types if none exist)
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
    const generationTasks: Array<{
      storagePath: string;
      ticketData: TicketImageData;
      ticketRecord: any;
    }> = [];

    const safePrefix =
      (event.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';

    for (const guest of pendingGuests) {
      const guestCategory = (guest.category || 'GENERAL').toUpperCase().trim();
      const matchedType = typeMap.get(guestCategory) || defaultType;

      // 64-char crypto token (zero PII)
      const verificationToken = this.qrServ.generateVerificationToken();
      const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

      const ticketSeqStr = nextSeq.toString().padStart(5, '0');
      const displayId = `${safePrefix}-${ticketSeqStr}`;

      const ticketData: TicketImageData = {
        ticketId: displayId,
        guestName: guest.name || 'Valued Guest',
        eventName: event.name,
        eventDate: event.date,
        ticketType: matchedType.label || matchedType.name,
        qrCodeDataUrl: qrDataUrl,
        organization: guest.organization || undefined,
        phone: guest.phone || undefined,
      };

      // Canonical PNG storage path
      const storagePath = `events/${eventId}/tickets/ticket-${displayId}.png`;

      const ticketRecord = {
        eventId,
        guestId: guest.id,
        ticketTypeId: matchedType.id,
        verificationToken,
        status: 'ACTIVE',
        usagePolicy: matchedType.usagePolicy || 'SINGLE_USE',
        assetPath: storagePath,
        assetUrl: '',
        sequenceNumber: nextSeq,
        createdBy: userId,
      };

      ticketsToInsert.push(ticketRecord);
      generationTasks.push({
        storagePath,
        ticketData,
        ticketRecord,
      });

      nextSeq++;
    }

    // ── After QR generation loop ──
    tracker.checkpoint('qr_generation_complete', {
      tasksQueued: generationTasks.length,
      ticketsToInsert: ticketsToInsert.length,
    });

    // High-performance batch PNG rendering & upload to Supabase Storage
    // BATCH_SIZE is 1 to prevent concurrent librsvg native memory allocations on 512MB containers
    const BATCH_SIZE = 1;
    let batchIndex = 0;
    for (let i = 0; i < generationTasks.length; i += BATCH_SIZE) {
      batchIndex++;
      const batch = generationTasks.slice(i, i + BATCH_SIZE);

      // ── LIFECYCLE POINT 5: Before rendering each ticket/batch ──
      tracker.checkpoint('batch_render_before', { batch: batchIndex, batchSize: batch.length });

      const renderStart = Date.now();
      const renderedBatch = await this.imageServ.renderBatchTickets(
        batch.map((b) => b.ticketData),
        1
      );

      // ── LIFECYCLE POINT 6: Immediately after rendering ──
      const renderDuration = Date.now() - renderStart;
      tracker.checkpoint('batch_render_after', { batch: batchIndex, renderMs: renderDuration });

      const uploadStart = Date.now();
      await Promise.all(
        batch.map(async (task, idx) => {
          const rendered = renderedBatch[idx];
          if (!rendered || !isPngBuffer(rendered.pngBuffer)) {
            throw new StorageError(
              `Rendered ticket failed PNG binary validation for ticket ${task.ticketData.ticketId}`
            );
          }

          const uploadResult = await this.storageServ.uploadTicketImage(
            task.storagePath,
            rendered.pngBuffer,
            'image/png'
          );

          task.ticketRecord.assetUrl = uploadResult.publicUrl;
          task.ticketRecord.assetPath = uploadResult.storagePath;

          // Explicitly clear buffer reference to allow immediate V8/libvips garbage collection
          (rendered as any).pngBuffer = null;
        })
      );

      // ── LIFECYCLE POINT 7: After Supabase Storage upload ──
      const uploadDuration = Date.now() - uploadStart;
      tracker.checkpoint('batch_upload_after', { batch: batchIndex, uploadMs: uploadDuration });

      // Release batch references to keep memory usage bounded
      renderedBatch.length = 0;

      // ── LIFECYCLE POINT 9: After every batch ──
      tracker.checkpoint('batch_complete', {
        batch: batchIndex,
        ticketsProcessedSoFar: Math.min(i + BATCH_SIZE, generationTasks.length),
        totalTickets: generationTasks.length,
      });
    }

    // ── LIFECYCLE POINT 8: After DB insert/batch insert ──
    const dbStart = Date.now();
    // Persist to PostgreSQL only after all PNGs are successfully uploaded to Supabase Storage
    const inserted = await this.ticketRepo.createMany(ticketsToInsert);
    const dbDuration = Date.now() - dbStart;
    tracker.checkpoint('db_insert_complete', { insertedCount: inserted.length, dbMs: dbDuration });

    // ── LIFECYCLE POINT 10: Ticket generation completion ──
    tracker.summarize(inserted.length);

    return {
      message: `Successfully generated and uploaded ${inserted.length} PNG tickets to Supabase Storage.`,
      generatedCount: inserted.length,
      totalGuests: guests.length,
    };
  }

  /**
   * Generate unassigned worker tickets (guestId = null).
   * Renders genuine PNG binaries and uploads directly to Supabase Storage.
   */
  async generateUnassignedWorkerTickets(
    eventId: string,
    userId: string,
    count: number,
    ticketTypeName = 'WORKER'
  ) {
    if (count <= 0 || count > 500) {
      throw new ValidationError('Quantity must be between 1 and 500.');
    }

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    if (!this.storageServ.isConfigured()) {
      throw new StorageError(
        'Supabase Storage is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in the environment.'
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
    const generationTasks: Array<{
      storagePath: string;
      ticketData: TicketImageData;
      ticketRecord: any;
    }> = [];

    for (let i = 0; i < count; i++) {
      const verificationToken = this.qrServ.generateVerificationToken();
      const qrDataUrl = await this.qrServ.generateQrDataUrl(verificationToken);

      const ticketSeqStr = nextSeq.toString().padStart(5, '0');
      const displayId = `WRK-${ticketSeqStr}`;

      const workerData: TicketImageData = {
        ticketId: displayId,
        guestName: 'Event Staff',
        eventName: event.name,
        eventDate: event.date,
        ticketType: workerType.label || 'Event Staff',
        qrCodeDataUrl: qrDataUrl,
      };

      const storagePath = `events/${eventId}/tickets/ticket-${displayId}.png`;

      const ticketRecord = {
        eventId,
        guestId: null, // Unassigned
        ticketTypeId: workerType.id,
        verificationToken,
        status: 'ACTIVE',
        usagePolicy: 'REUSABLE',
        assetPath: storagePath,
        assetUrl: '',
        sequenceNumber: nextSeq,
        createdBy: userId,
      };

      ticketsToInsert.push(ticketRecord);
      generationTasks.push({
        storagePath,
        ticketData: workerData,
        ticketRecord,
      });

      nextSeq++;
    }

    // High-performance batch PNG rendering & upload to Supabase Storage
    // BATCH_SIZE is 1 to prevent concurrent librsvg native memory allocations on 512MB containers
    const BATCH_SIZE = 1;
    for (let i = 0; i < generationTasks.length; i += BATCH_SIZE) {
      const batch = generationTasks.slice(i, i + BATCH_SIZE);
      const renderedBatch = await this.imageServ.renderBatchTickets(
        batch.map((b) => b.ticketData),
        1
      );

      await Promise.all(
        batch.map(async (task, idx) => {
          const rendered = renderedBatch[idx];
          if (!rendered || !isPngBuffer(rendered.pngBuffer)) {
            throw new StorageError(
              `Rendered worker ticket failed PNG binary validation for ticket ${task.ticketData.ticketId}`
            );
          }

          const uploadResult = await this.storageServ.uploadTicketImage(
            task.storagePath,
            rendered.pngBuffer,
            'image/png'
          );

          task.ticketRecord.assetUrl = uploadResult.publicUrl;
          task.ticketRecord.assetPath = uploadResult.storagePath;

          // Explicitly clear buffer reference to allow immediate V8/libvips garbage collection
          (rendered as any).pngBuffer = null;
        })
      );

      // Release batch references to keep memory usage bounded
      renderedBatch.length = 0;
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
      throw new NotFoundError('Event not found or unauthorized');
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
   * Get a single ticket by ID or verification token.
   */
  async getTicketById(idOrToken: string) {
    let ticket = await this.ticketRepo.findById(idOrToken);
    if (!ticket) {
      ticket = await this.ticketRepo.findByVerificationToken(idOrToken);
    }
    return ticket;
  }

  /**
   * Download a single ticket asset as a genuine PNG buffer with canonical filename.
   * Directly reuses existing stored PNG asset; zero on-demand ticket regeneration.
   */
  async downloadTicket(
    ticketIdOrToken: string,
    userId: string
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const rawRecord: any = await this.getTicketById(ticketIdOrToken);
    if (!rawRecord) {
      throw new NotFoundError('Ticket not found');
    }

    // Support both joined record from Repository and plain ticket object
    const ticket = rawRecord.ticket || rawRecord;
    let event = rawRecord.event;
    if (!event && ticket.eventId) {
      event = await this.eventRepo.findByIdAndOwner(ticket.eventId, userId);
    }

    // Verify ownership via event createdBy
    if (!event || event.createdBy !== userId) {
      throw new NotFoundError('Ticket not found or unauthorized');
    }

    const guest = rawRecord.guest || (ticket.guestId ? await this.guestRepo.findById(ticket.guestId) : null);
    const guestName = guest?.name || null;
    const seqStr = ticket.sequenceNumber.toString().padStart(5, '0');
    const isWorker = !ticket.guestId || ticket.usagePolicy === 'REUSABLE';
    const safePrefix =
      (event.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';
    const displayId = isWorker ? `WRK-${seqStr}` : `${safePrefix}-${seqStr}`;
    const fileName = formatTicketFileName(guestName, displayId);

    const candidatePaths = [
      ticket.assetPath,
      `events/${ticket.eventId}/tickets/ticket-${displayId}.png`,
    ].filter(Boolean) as string[];

    let fileBuffer: Buffer | null = null;
    for (const p of candidatePaths) {
      try {
        const buf = await this.storageServ.downloadTicketImage(p);
        if (isPngBuffer(buf)) {
          fileBuffer = buf;
          break;
        }
      } catch {
        // try next candidate path
      }
    }

    if (!fileBuffer || !isPngBuffer(fileBuffer)) {
      throw new NotFoundError('Stored ticket PNG asset could not be located in storage');
    }

    return {
      buffer: fileBuffer,
      fileName,
      contentType: 'image/png',
    };
  }

  /**
   * Stream a ZIP archive containing genuine PNG ticket assets retrieved from Supabase Storage.
   * Reuses existing stored PNG assets directly; zero on-demand ticket regeneration.
   */
  async streamTicketsZip(eventId: string, userId: string, streamOut: NodeJS.WritableStream) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    const tickets = await this.ticketRepo.findByEventId(eventId, { limit: 50000 });
    if (tickets.length === 0) {
      throw new ValidationError('No tickets found to export for this event.');
    }

    const archive = await createZipArchive({ zlib: { level: 6 } });
    archive.on('error', (err: any) => {
      console.error('[BulkExport] Archive error:', err);
    });
    archive.pipe(streamOut);

    const safePrefix =
      (event.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';

    const BATCH_SIZE = 10;
    for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
      const batch = tickets.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (t) => {
          const seqStr = t.ticket.sequenceNumber.toString().padStart(5, '0');
          const isWorker = !t.ticket.guestId || t.ticketType.usagePolicy === 'REUSABLE';
          const displayId = isWorker ? `WRK-${seqStr}` : `${safePrefix}-${seqStr}`;
          const fileName = formatTicketFileName(t.guest?.name, displayId);

          const candidatePaths = [
            t.ticket.assetPath,
            `events/${eventId}/tickets/ticket-${displayId}.png`,
          ].filter(Boolean) as string[];

          let fileBuffer: Buffer | null = null;
          for (const p of candidatePaths) {
            try {
              const buf = await this.storageServ.downloadTicketImage(p);
              if (isPngBuffer(buf)) {
                fileBuffer = buf;
                break;
              }
            } catch {
              // try next path
            }
          }

          if (fileBuffer && isPngBuffer(fileBuffer)) {
            archive.append(fileBuffer, { name: fileName });
          }
        })
      );
    }

    await archive.finalize();
  }
}

export const ticketService = new TicketService();
