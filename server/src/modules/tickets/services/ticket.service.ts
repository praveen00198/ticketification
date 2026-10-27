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
import mongoose from 'mongoose';
import { EventCredentialModel } from '../../../db/mongo/models/event-credential.model';
import { EventMemberModel } from '../../../db/mongo/models/event-member.model';
import { EventRegistrationModel } from '../../../db/mongo/models/event-registration.model';
import { EventModel } from '../../../db/mongo/models/event.model';
import { mongoEventCredentialRepository } from '../../events/repositories/mongo-event-credential.repository';
import { GenerateTicketsResult } from '../ticket.types';
import { logMemory, MemoryTracker } from '../../../utils/memory-logger';
import { getTemplateById, DEFAULT_TEMPLATE_ID } from '../ticket-templates';

export { formatTicketFileName };

export interface TicketDownloadAuthContext {
  userId: string;
  userEmail?: string;
  userRole?: string;
  scopedEventId?: string;
}

export interface ResolvedTicketDownload {
  ticketId: string;
  eventId: string;
  sequenceNumber: number;
  fileName: string;
  displayId: string;
  candidatePaths: string[];
}

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
  async generateTicketsForEvent(
    eventId: string,
    userId: string,
    templateId: string = DEFAULT_TEMPLATE_ID
  ): Promise<GenerateTicketsResult> {
    const tracker = new MemoryTracker();

    // ── LIFECYCLE POINT 3: Immediately before ticket generation starts ──
    tracker.start('generation_start');

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    const templateConfig = getTemplateById(templateId);
    if (!templateConfig) {
      throw new ValidationError(`Invalid template ID: ${templateId}`);
    }

    let templateBuffer: Buffer | null = null;
    if (templateConfig.id === DEFAULT_TEMPLATE_ID && typeof this.imageServ.getDefaultTemplateBuffer === 'function') {
      templateBuffer = this.imageServ.getDefaultTemplateBuffer();
    }
    if (!templateBuffer && typeof this.imageServ.resolveTemplateBuffer === 'function') {
      templateBuffer = await this.imageServ.resolveTemplateBuffer(templateConfig.filename);
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

    if (pendingGuests.length > 50) {
      throw new ValidationError(
        `Synchronous ticket generation is limited to 50 guests (found ${pendingGuests.length} pending). Please dispatch an asynchronous bulk render job via POST /api/events/:eventId/jobs/bulk-render.`
      );
    }

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
        eventDate: (event.date && event.date !== '2026-10-10')
          ? event.date
          : ((event as any).schedule?.startAt ? new Date((event as any).schedule.startAt).toLocaleDateString() : 'Date TBA'),
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
        1,
        templateBuffer || undefined
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
    templateBuffer = null;

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
    ticketTypeName = 'WORKER',
    templateId: string = DEFAULT_TEMPLATE_ID
  ) {
    if (count <= 0 || count > 50) {
      throw new ValidationError(
        'Synchronous worker pass generation is limited to 50 passes to prevent server resource exhaustion. Please queue an asynchronous background job via POST /api/events/:eventId/jobs/bulk-render.'
      );
    }

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    const templateConfig = getTemplateById(templateId);
    if (!templateConfig) {
      throw new ValidationError(`Invalid template ID: ${templateId}`);
    }

    let templateBuffer: Buffer | null = null;
    if (templateConfig.id === DEFAULT_TEMPLATE_ID && typeof this.imageServ.getDefaultTemplateBuffer === 'function') {
      templateBuffer = this.imageServ.getDefaultTemplateBuffer();
    }
    if (!templateBuffer && typeof this.imageServ.resolveTemplateBuffer === 'function') {
      templateBuffer = await this.imageServ.resolveTemplateBuffer(templateConfig.filename);
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
        eventDate: (event.date && event.date !== '2026-10-10')
          ? event.date
          : ((event as any).schedule?.startAt ? new Date((event as any).schedule.startAt).toLocaleDateString() : 'Date TBA'),
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
        1,
        templateBuffer || undefined
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
    templateBuffer = null;

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
   * Get a single ticket by ID or verification token, verifying event ownership.
   */
  async getTicketByIdForOwner(idOrToken: string, userId: string) {
    const rawRecord: any = await this.getTicketById(idOrToken);
    if (!rawRecord) {
      throw new NotFoundError('Ticket not found');
    }

    const ticket = rawRecord.ticket || rawRecord;
    let event = rawRecord.event;
    if (!event && ticket.eventId) {
      event = await this.eventRepo.findByIdAndOwner(ticket.eventId, userId);
    }

    if (!event || event.createdBy !== userId) {
      throw new NotFoundError('Ticket not found or unauthorized');
    }

    return rawRecord;
  }

  /**
   * Securely authorizes the requesting user against the target ticket, event, and RBAC permissions.
   * Defends against IDOR, validates cross-event scoping, and resolves canonical storage paths.
   */
  async authorizeAndResolveTicket(
    ticketIdOrToken: string,
    authContext: string | TicketDownloadAuthContext
  ): Promise<ResolvedTicketDownload> {
    const auth: TicketDownloadAuthContext =
      typeof authContext === 'string' ? { userId: authContext } : authContext;

    if (!ticketIdOrToken || typeof ticketIdOrToken !== 'string') {
      throw new NotFoundError('Ticket not found');
    }

    let ticketId: string | null = null;
    let eventId: string | null = null;
    let sequenceNumber: number = 1;
    let assetPath: string | null = null;
    let guestName: string | null = null;
    let guestEmail: string | null = null;
    let holderUserId: string | null = null;
    let eventOwnerId: string | null = null;
    let eventName: string | null = null;
    let usagePolicy: string = 'SINGLE_USE';

    // 1. Check PostgreSQL / Drizzle Tickets
    let pgRecord: any = null;
    try {
      if (typeof this.getTicketById === 'function') {
        pgRecord = await this.getTicketById(ticketIdOrToken);
      }
    } catch {}

    if (!pgRecord) {
      try {
        if (typeof this.ticketRepo?.findById === 'function') {
          pgRecord = await this.ticketRepo.findById(ticketIdOrToken);
        }
        if (!pgRecord && typeof this.ticketRepo?.findByVerificationToken === 'function') {
          pgRecord = await this.ticketRepo.findByVerificationToken(ticketIdOrToken);
        }
      } catch {
        // Postgres query failed or unconfigured, proceed to Mongo check
      }
    }

    if (pgRecord) {
      const t = pgRecord.ticket || pgRecord;
      ticketId = t.id ? t.id.toString() : ticketIdOrToken;
      eventId = t.eventId ? t.eventId.toString() : null;
      sequenceNumber = Number(t.sequenceNumber) || 1;
      assetPath = t.assetPath || null;
      usagePolicy = t.usagePolicy || 'SINGLE_USE';

      const g =
        pgRecord.guest ||
        (t.guestId && typeof this.guestRepo?.findById === 'function'
          ? await this.guestRepo.findById(t.guestId)
          : null);
      guestName = g?.name || null;
      guestEmail = g?.email || null;

      let ev = pgRecord.event;
      if (!ev && eventId) {
        if (typeof this.eventRepo?.findById === 'function') {
          try {
            ev = await this.eventRepo.findById(eventId);
          } catch {}
        }
        if (!ev && typeof this.eventRepo?.findByIdAndOwner === 'function') {
          try {
            ev = await this.eventRepo.findByIdAndOwner(eventId, auth.userId);
          } catch {}
        }
      }
      eventName = ev?.name || null;
      eventOwnerId = ev?.createdBy || null;
    }

    // 2. Check MongoDB EventCredentials if not found in Postgres
    if (!ticketId && mongoose.connection.readyState === 1) {
      try {
        let cred: any = null;
        if (mongoose.Types.ObjectId.isValid(ticketIdOrToken)) {
          cred = await EventCredentialModel.findById(ticketIdOrToken).exec();
        }
        if (!cred && ticketIdOrToken.length === 64) {
          cred = await EventCredentialModel.findOne({ verificationToken: ticketIdOrToken }).exec();
        }
        if (!cred) {
          cred = await EventCredentialModel.findOne({ formattedId: ticketIdOrToken }).exec();
        }

        if (cred) {
          ticketId = cred._id.toString();
          eventId = cred.eventId ? cred.eventId.toString() : null;
          sequenceNumber = Number(cred.sequenceNumber) || 1;
          assetPath = cred.asset?.storagePath || null;
          usagePolicy = cred.usagePolicy || 'SINGLE_USE';
          guestName = cred.holder?.name || null;
          guestEmail = cred.holder?.email || null;
          holderUserId = cred.holder?.userId ? cred.holder.userId.toString() : null;

          if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
            const ev = await EventModel.findById(eventId).exec();
            if (ev) {
              eventName = ev.name || null;
              eventOwnerId = ev.ownerId ? ev.ownerId.toString() : (ev.ownerSupabaseId || null);
            }
          }
        }
      } catch {
        // Mongo query error
      }
    }

    if (!ticketId || !eventId) {
      throw new NotFoundError('Ticket not found');
    }

    // Cross-Event Scoping Check: Never allow cross-event ticket access
    if (auth.scopedEventId && auth.scopedEventId.toString() !== eventId.toString()) {
      throw new NotFoundError('Ticket not found in this event');
    }

    // Strict Authorization Verification
    let isAuthorized = false;

    // A. Platform Administrator
    if (auth.userRole === 'ADMIN') {
      isAuthorized = true;
    }

    // B. Event Creator / Owner
    if (!isAuthorized && eventOwnerId && eventOwnerId.toString() === auth.userId) {
      isAuthorized = true;
    }

    // C. Event Staff with DOWNLOAD_CREDENTIALS permission
    if (!isAuthorized && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(eventId)) {
      try {
        const staffOr: any[] = [];
        if (mongoose.Types.ObjectId.isValid(auth.userId)) {
          staffOr.push({ userId: new mongoose.Types.ObjectId(auth.userId) });
        }
        if (auth.userEmail) {
          staffOr.push({ userEmail: auth.userEmail.toLowerCase().trim() });
        }

        if (staffOr.length > 0) {
          const member = await EventMemberModel.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            $or: staffOr,
            status: 'ACTIVE',
          }).exec();

          if (member) {
            if (
              member.role === 'HOST' ||
              member.role === 'COORDINATOR' ||
              member.permissions?.includes('DOWNLOAD_CREDENTIALS')
            ) {
              isAuthorized = true;
            }
          }
        }
      } catch {
        // Staff check error
      }
    }

    // D. Ticket Holder / Attendee
    if (!isAuthorized) {
      if (guestEmail && auth.userEmail && guestEmail.toLowerCase().trim() === auth.userEmail.toLowerCase().trim()) {
        isAuthorized = true;
      }
      if (holderUserId && holderUserId.toString() === auth.userId) {
        isAuthorized = true;
      }

      // Check registered attendee status in MongoDB
      if (!isAuthorized && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(eventId)) {
        try {
          const regOr: any[] = [{ userSupabaseId: auth.userId }];
          if (mongoose.Types.ObjectId.isValid(auth.userId)) {
            regOr.push({ userId: new mongoose.Types.ObjectId(auth.userId) });
          }
          if (auth.userEmail) {
            regOr.push({ 'attendeeDetails.email': auth.userEmail.toLowerCase().trim() });
          }

          const reg = await EventRegistrationModel.findOne({
            eventId: new mongoose.Types.ObjectId(eventId),
            $or: regOr,
            status: { $in: ['CONFIRMED', 'ATTENDED'] },
          }).exec();

          if (reg) {
            if (
              (reg.credentialId && reg.credentialId.toString() === ticketId.toString()) ||
              (reg.attendeeDetails?.email && guestEmail && reg.attendeeDetails.email.toLowerCase() === guestEmail.toLowerCase())
            ) {
              isAuthorized = true;
            }
          }
        } catch {
          // Registration check error
        }
      }
    }

    if (!isAuthorized) {
      throw new NotFoundError('Ticket not found or unauthorized');
    }

    // Compute canonical filename and displayId
    const seqStr = sequenceNumber.toString().padStart(5, '0');
    const isWorker = !guestName || usagePolicy === 'REUSABLE';
    const safePrefix =
      (eventName || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';
    const displayId = isWorker ? `WRK-${seqStr}` : `${safePrefix}-${seqStr}`;
    const fileName = formatTicketFileName(guestName, displayId);

    const candidatePaths = [
      assetPath,
      `events/${eventId}/tickets/ticket-${displayId}.png`,
    ].filter(Boolean) as string[];

    return {
      ticketId,
      eventId,
      sequenceNumber,
      fileName,
      displayId,
      candidatePaths,
    };
  }

  /**
   * Download a single ticket asset as a genuine PNG buffer with canonical filename.
   * Directly reuses existing stored PNG asset; zero on-demand ticket regeneration.
   */
  async downloadTicket(
    ticketIdOrToken: string,
    authContext: string | TicketDownloadAuthContext
  ): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
    const resolved = await this.authorizeAndResolveTicket(ticketIdOrToken, authContext);

    let fileBuffer: Buffer | null = null;
    for (const p of resolved.candidatePaths) {
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
      fileName: resolved.fileName,
      contentType: 'image/png',
    };
  }

  /**
   * Generates a signed direct download URL from Supabase Storage for the ticket asset.
   * Avoids proxying large binary image buffers through Node.js heap.
   * Defaults to 900 seconds (15 minutes) expiration with Content-Disposition attachment.
   */
  async getPresignedTicketDownloadUrl(
    ticketIdOrToken: string,
    authContext: string | TicketDownloadAuthContext,
    expiresInSeconds: number = 900
  ): Promise<{ url: string; fileName: string } | null> {
    const resolved = await this.authorizeAndResolveTicket(ticketIdOrToken, authContext);

    for (const p of resolved.candidatePaths) {
      try {
        const url = await this.storageServ.createPresignedDownloadUrl(p, expiresInSeconds, {
          download: resolved.fileName,
        });
        if (url) {
          return { url, fileName: resolved.fileName };
        }
      } catch {
        // Fallback to next candidate path or return null for buffer streaming
      }
    }

    return null;
  }

  /**
   * Stream a ZIP archive containing genuine PNG ticket assets with bounded memory.
   * Uses keyset pagination / Mongo cursor; zero whole-dataset in-memory buffering.
   * Respects stream backpressure and releases buffers immediately.
   */
  async streamTicketsZip(eventId: string, userId: string, streamOut: NodeJS.WritableStream): Promise<void> {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    const archive = await createZipArchive({ zlib: { level: 6 } });
    let archiveAborted = false;
    let streamClosed = false;

    archive.on('error', (err: any) => {
      console.error('[BulkExport] Archive error:', err);
    });

    const safePrefix =
      (event.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';

    archive.pipe(streamOut);

    const onStreamClose = () => {
      streamClosed = true;
      if (!archiveAborted) {
        try {
          archive.abort();
          archiveAborted = true;
        } catch {}
      }
    };
    streamOut.on('close', onStreamClose);

    const waitForDrain = async () => {
      if ((streamOut as any).writableNeedDrain || (streamOut as any)._writableState?.needDrain) {
        await new Promise<void>((resolve) => streamOut.once('drain', () => resolve()));
      }
    };

    let totalDiscovered = 0;
    let packagedCount = 0;
    let cursor: any = null;

    try {
      // 1. Try Keyset Pagination on PostgreSQL ticketRepo
      const BATCH_SIZE = 50;
      let lastSeq = 0;
      let offset = 0;
      let hasMorePg = true;

      while (hasMorePg && !streamClosed) {
        let batch: any[] = [];
        if (typeof (this.ticketRepo as any)?.findExportBatchKeyset === 'function') {
          batch = await (this.ticketRepo as any).findExportBatchKeyset(eventId, lastSeq, BATCH_SIZE);
        } else if (typeof this.ticketRepo?.findByEventId === 'function') {
          batch = await this.ticketRepo.findByEventId(eventId, { limit: BATCH_SIZE, offset });
        }

        if (!batch || batch.length === 0) {
          hasMorePg = false;
          break;
        }

        totalDiscovered += batch.length;
        let highestSeqInBatch = lastSeq;

        for (const t of batch) {
          if (streamClosed) break;

          const rawSeq = t.ticket?.sequenceNumber ?? t.sequenceNumber ?? 0;
          const seqNum = Number(rawSeq);
          if (seqNum > highestSeqInBatch) {
            highestSeqInBatch = seqNum;
          }

          const seqStr = seqNum.toString().padStart(5, '0');
          const isWorker = (!t.ticket?.guestId && !t.guestId) || (t.ticketType?.usagePolicy === 'REUSABLE');
          const displayId = isWorker ? `WRK-${seqStr}` : `${safePrefix}-${seqStr}`;
          const guestName = t.guest?.name ?? t.guestName;
          const fileName = formatTicketFileName(guestName, displayId);

          const candidatePaths = [
            t.ticket?.assetPath ?? t.assetPath,
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
            packagedCount++;
            await waitForDrain();
          }
        }

        if (batch.length < BATCH_SIZE || (highestSeqInBatch === lastSeq && offset > 0)) {
          hasMorePg = false;
        } else {
          lastSeq = highestSeqInBatch;
          offset += batch.length;
        }
      }

      // 2. If no tickets were found in PostgreSQL, check MongoDB credentials cursor
      if (totalDiscovered === 0 && mongoose.connection.readyState === 1) {
        try {
          cursor = mongoEventCredentialRepository.findExportCursor(eventId, {}, BATCH_SIZE);
          for await (const cred of cursor) {
            if (streamClosed) break;
            totalDiscovered++;

            let fileBuffer: Buffer | null = null;
            if (cred.asset?.storagePath) {
              try {
                const buf = await this.storageServ.downloadTicketImage(cred.asset.storagePath);
                if (isPngBuffer(buf)) {
                  fileBuffer = buf;
                }
              } catch {}
            }

            if (fileBuffer && isPngBuffer(fileBuffer)) {
              const safeName = (cred.holder?.name || 'Attendee')
                .replace(/[^a-zA-Z0-9_-]/g, '_')
                .replace(/_+/g, '_');
              const fileName = `${cred.formattedId || 'PASS'}-${safeName}.png`;
              archive.append(fileBuffer, { name: fileName });
              packagedCount++;
              await waitForDrain();
            }
          }
        } catch (mongoErr: any) {
          if (totalDiscovered === 0) {
            throw mongoErr;
          }
        }
      }

      if (totalDiscovered === 0) {
        try {
          archive.abort();
          archiveAborted = true;
        } catch {}
        throw new ValidationError('No tickets found to export for this event.');
      }

      if (totalDiscovered > 0 && packagedCount < totalDiscovered) {
        try {
          archive.abort();
          archiveAborted = true;
        } catch {}
        if (packagedCount === 0) {
          throw new ValidationError('No valid ticket assets could be packaged into archive.');
        } else {
          const missingCount = totalDiscovered - packagedCount;
          throw new ValidationError(
            `Incomplete export: only ${packagedCount} of ${totalDiscovered} ticket assets could be packaged (${missingCount} missing or inaccessible). Export aborted to prevent incomplete delivery.`
          );
        }
      }

      await archive.finalize();
    } catch (err) {
      if (!archiveAborted) {
        try {
          archive.abort();
          archiveAborted = true;
        } catch {}
      }
      throw err;
    } finally {
      streamOut.removeListener('close', onStreamClose);
      if (cursor && typeof cursor.close === 'function') {
        try {
          await cursor.close();
        } catch {}
      }
    }
  }
}

export const ticketService = new TicketService();
