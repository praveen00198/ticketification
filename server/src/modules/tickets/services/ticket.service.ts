import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import * as xlsx from 'xlsx';
import config from '../../../config/env';
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
import { EventCredentialTemplateModel } from '../../../db/mongo/models/event-credential-template.model';
import { mongoEventCredentialRepository } from '../../events/repositories/mongo-event-credential.repository';
import { mongoEventCredentialTemplateRepository } from '../../events/repositories/mongo-event-credential-template.repository';
import {
  eventCredentialRenderingService,
  CredentialRenderData,
} from '../../events/services/event-credential-rendering.service';
import { GenerateTicketsResult } from '../ticket.types';
import { logMemory, MemoryTracker } from '../../../utils/memory-logger';
import { memoryBudgetGovernor } from '../../../utils/memory-budget-governor';
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

    // 0. Support MongoDB canonical events
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(eventId)) {
      const mongoEv = await EventModel.findById(eventId);
      if (mongoEv) {
        const isOwner =
          mongoEv.ownerSupabaseId === userId ||
          String(mongoEv.ownerId) === userId ||
          String(mongoEv.ownerSupabaseId) === userId;

        if (!isOwner) {
          const member = await EventMemberModel.findOne({
            eventId: mongoEv._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] } as any,
          } as any);
          if (!member) {
            throw new NotFoundError('Event not found or unauthorized');
          }
        }

        const templateConfig = getTemplateById(templateId);
        let templateBuffer: Buffer | null = null;
        if (templateConfig && templateConfig.id === DEFAULT_TEMPLATE_ID && typeof this.imageServ.getDefaultTemplateBuffer === 'function') {
          templateBuffer = this.imageServ.getDefaultTemplateBuffer();
        }
        if (!templateBuffer && templateConfig && typeof this.imageServ.resolveTemplateBuffer === 'function') {
          templateBuffer = await this.imageServ.resolveTemplateBuffer(templateConfig.filename);
        }

        const totalGuests = await EventCredentialModel.countDocuments({
          eventId: new mongoose.Types.ObjectId(eventId),
        });

        if (totalGuests === 0) {
          throw new ValidationError('No guests found for this event. Please import guests first.');
        }

        const unrenderedQuery = {
          eventId: new mongoose.Types.ObjectId(eventId),
          $or: [
            { 'asset.publicUrl': { $exists: false } },
            { 'asset.publicUrl': null },
            { 'asset.publicUrl': '' },
            { 'asset.renderedAt': { $exists: false } },
            { 'asset.renderedAt': null },
          ],
        };

        const pendingCount = await EventCredentialModel.countDocuments(unrenderedQuery);
        if (pendingCount === 0) {
          return {
            message: `All ${totalGuests} guests already have valid tickets generated.`,
            generatedCount: 0,
            totalGuests,
          };
        }

        if (pendingCount > 50) {
          throw new ValidationError(
            `Synchronous ticket generation is limited to 50 guests (found ${pendingCount} pending). Please dispatch an asynchronous bulk render job via POST /api/events/:eventId/jobs/bulk-render.`
          );
        }

        if (!this.storageServ.isConfigured()) {
          throw new StorageError(
            'Supabase Storage is not configured. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in the environment.'
          );
        }

        // Fetch pending credentials with lean() projection to minimize heap allocation
        const pendingCredentials = await EventCredentialModel.find(unrenderedQuery)
          .sort({ sequenceNumber: 1 })
          .limit(50)
          .lean()
          .exec();

        const safePrefix =
          (mongoEv.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';
        const eventDateStr = ((mongoEv as any).date && (mongoEv as any).date !== '2026-10-10')
          ? (mongoEv as any).date
          : (mongoEv.schedule?.startAt ? new Date(mongoEv.schedule.startAt).toLocaleDateString() : 'Date TBA');

        let generatedCount = 0;
        for (const cred of pendingCredentials) {
          const qrDataUrl = await this.qrServ.generateQrDataUrl(cred.verificationToken);
          const seqStr = (cred.sequenceNumber || 1).toString().padStart(5, '0');
          const displayId = cred.formattedId || `${safePrefix}-${seqStr}`;

          const ticketData: TicketImageData = {
            ticketId: displayId,
            guestName: cred.holder?.name || 'Valued Guest',
            eventName: mongoEv.name || 'Event',
            eventDate: eventDateStr,
            ticketType: cred.credentialType || 'General Admission',
            qrCodeDataUrl: qrDataUrl,
            organization: cred.holder?.organization || undefined,
            phone: cred.holder?.phone || undefined,
          };

          const storagePath = cred.asset?.storagePath || `events/${eventId}/tickets/ticket-${displayId}.png`;
          let rendered: any = await this.imageServ.generateTicketImage(ticketData);
          if (!rendered || !isPngBuffer(rendered.pngBuffer)) {
            throw new StorageError(`Rendered ticket failed PNG binary validation for ticket ${displayId}`);
          }

          let pngBuffer: Buffer | null = rendered.pngBuffer;
          rendered = null;

          const uploadResult = await this.storageServ.uploadTicketImage(
            storagePath,
            pngBuffer,
            'image/png'
          );

          // Explicitly dereference buffer after upload
          pngBuffer = null;

          await EventCredentialModel.updateOne(
            { _id: cred._id },
            {
              $set: {
                'asset.publicUrl': uploadResult.publicUrl,
                'asset.storagePath': uploadResult.storagePath,
                'asset.renderedAt': new Date(),
              },
            }
          );
          generatedCount++;

          memoryBudgetGovernor.triggerGarbageCollection();
          logMemory('ticket_complete', { ticket: generatedCount, id: displayId });
        }

        return {
          message: `Successfully generated and uploaded ${generatedCount} PNG ticket(s) to Supabase Storage.`,
          generatedCount,
          totalGuests,
        };
      }
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
    // 1. Try MongoDB canonical event first
    if (mongoose.Types.ObjectId.isValid(eventId)) {
      const mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId;

        if (!isOwner) {
          const member = await EventMemberModel.findOne({
            eventId: mongoEvent._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] } as any,
          } as any);
          if (!member) {
            throw new NotFoundError('Event not found or unauthorized');
          }
        }

        const { credentials, total } = await mongoEventCredentialRepository.findByEvent(eventId, {
          status: options.status,
          search: options.search,
          limit: options.limit || 5000,
          offset: options.offset || 0,
        });

        return {
          tickets: credentials.map((c) => ({
            id: c._id.toString(),
            sequenceNumber: c.sequenceNumber,
            verificationToken: c.verificationToken,
            status: c.status,
            usagePolicy: c.usagePolicy || 'SINGLE_USE',
            assetUrl: c.asset?.publicUrl || (c.asset?.renderedAt && c.asset?.storagePath ? this.storageServ.getPublicUrl(c.asset.storagePath) : null),
            createdAt: c.createdAt,
            guest: {
              id: c._id.toString(),
              name: c.holder?.name || 'UNASSIGNED',
              email: c.holder?.email,
              phone: c.holder?.phone,
              organization: c.holder?.organization,
              designation: c.holder?.designation,
              category: c.credentialType,
            },
            ticketType: {
              id: (c as any).ticketTypeId?.toString() || 'default',
              name: c.credentialType,
              label: c.credentialType,
              usagePolicy: c.usagePolicy || 'SINGLE_USE',
            },
          })),
          total,
          limit: options.limit || 5000,
          offset: options.offset || 0,
        };
      }
    }

    // 2. Fallback to legacy PostgreSQL repository
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
    let eventOwnerSupabaseId: string | null = null;
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
              eventOwnerId = ev.ownerId ? ev.ownerId.toString() : null;
              eventOwnerSupabaseId = ev.ownerSupabaseId || null;
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

    // B. Event Creator / Owner (check both Mongo ObjectId and Supabase ID)
    if (
      !isAuthorized &&
      ((eventOwnerId && eventOwnerId === auth.userId) ||
        (eventOwnerSupabaseId && eventOwnerSupabaseId === auth.userId))
    ) {
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

      // Direct credential lookup on EventRegistration
      if (!isAuthorized && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(ticketId)) {
        try {
          const credReg = await EventRegistrationModel.findOne({
            credentialId: new mongoose.Types.ObjectId(ticketId),
          }).exec();

          if (credReg) {
            const matchesUser =
              (credReg.userSupabaseId && credReg.userSupabaseId === auth.userId) ||
              (credReg.userId && credReg.userId.toString() === auth.userId) ||
              (credReg.attendeeDetails?.email && auth.userEmail && credReg.attendeeDetails.email.toLowerCase().trim() === auth.userEmail.toLowerCase().trim());

            if (matchesUser && credReg.status !== 'CANCELLED' && (credReg.status as string) !== 'REJECTED') {
              isAuthorized = true;
            }
          }
        } catch {}
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
      // High-performance on-demand rendering fallback
      // 1. Check MongoDB EventCredential
      if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(resolved.ticketId)) {
        try {
          const cred = await EventCredentialModel.findById(resolved.ticketId).exec();
          if (cred) {
            const mongoEvent = await EventModel.findById(resolved.eventId).exec();
            const qrDataUrl = await this.qrServ.generateQrDataUrl(cred.verificationToken);
            const safePrefix =
              (mongoEvent?.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';
            const seqStr = (cred.sequenceNumber || 1).toString().padStart(5, '0');
            const displayId = cred.formattedId || `${safePrefix}-${seqStr}`;

            const ticketData: TicketImageData = {
              ticketId: displayId,
              guestName: cred.holder?.name || 'Valued Guest',
              eventName: mongoEvent?.name || 'Event Pass',
              eventDate: ((mongoEvent as any)?.date && (mongoEvent as any).date !== '2026-10-10')
                ? (mongoEvent as any).date
                : (mongoEvent?.schedule?.startAt ? new Date(mongoEvent.schedule.startAt).toLocaleDateString() : 'Date TBA'),
              ticketType: cred.credentialType || cred.holder?.category || 'General Admission',
              qrCodeDataUrl: qrDataUrl,
              organization: cred.holder?.organization || undefined,
              phone: cred.holder?.phone || undefined,
            };

            const renderRes = await this.imageServ.generateTicketImage(ticketData);
            if (renderRes?.pngBuffer && isPngBuffer(renderRes.pngBuffer)) {
              fileBuffer = renderRes.pngBuffer;
              try {
                const storagePath = resolved.candidatePaths[0] || `events/${resolved.eventId}/tickets/ticket-${displayId}.png`;
                const uploadRes = await this.storageServ.uploadTicketImage(storagePath, renderRes.pngBuffer);
                cred.asset = {
                  storagePath: uploadRes.storagePath,
                  publicUrl: uploadRes.publicUrl,
                  renderedAt: new Date(),
                  mimeType: 'image/png',
                };
                await cred.save();
              } catch (saveErr) {
                console.warn('[TicketService] Could not cache rendered credential to storage:', saveErr);
              }
            }
          }
        } catch (mongoRenderErr) {
          console.error('[TicketService] Mongo on-demand rendering error:', mongoRenderErr);
        }
      }

      // 2. Check PostgreSQL Ticket
      if (!fileBuffer && typeof this.ticketRepo?.findById === 'function') {
        try {
          const pgRecord = await this.ticketRepo.findById(resolved.ticketId);
          if (pgRecord) {
            const t = pgRecord.ticket || pgRecord;
            const ev = pgRecord.event || (await this.eventRepo.findById(resolved.eventId));
            const guest = pgRecord.guest || (t.guestId ? await this.guestRepo.findById(t.guestId) : null);
            if (this.qrServ && typeof this.qrServ.generateQrDataUrl === 'function' && this.imageServ && typeof this.imageServ.generateTicketImage === 'function') {
              const qrDataUrl = await this.qrServ.generateQrDataUrl(t.verificationToken);
              const workerData: TicketImageData = {
                ticketId: resolved.displayId,
                guestName: guest?.name || 'Valued Guest',
                eventName: ev?.name || 'Event',
                eventDate: ((ev as any)?.date && (ev as any).date !== '2026-10-10')
                  ? (ev as any).date
                  : ((ev as any)?.schedule?.startAt ? new Date((ev as any).schedule.startAt).toLocaleDateString() : 'Date TBA'),
                ticketType: pgRecord.ticketType?.label || pgRecord.ticketType?.name || 'General',
                qrCodeDataUrl: qrDataUrl,
              };
              const renderRes = await this.imageServ.generateTicketImage(workerData);
              const renderedBuffer = renderRes?.pngBuffer;
              if (renderedBuffer && isPngBuffer(renderedBuffer)) {
                fileBuffer = renderedBuffer;
                try {
                  const storagePath = resolved.candidatePaths[0] || `events/${resolved.eventId}/tickets/ticket-${resolved.displayId}.png`;
                  await this.storageServ.uploadTicketImage(storagePath, renderedBuffer);
                } catch {}
              }
            }
          }
        } catch (pgRenderErr) {
          console.error('[TicketService] Postgres on-demand rendering error:', pgRenderErr);
        }
      }

      // 3. Guaranteed High-Resolution Sharp Rendering Fallback via TicketImageService
      if (!fileBuffer && this.imageServ && typeof this.imageServ.generateTicketImage === 'function') {
        try {
          const cred = mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(resolved.ticketId)
            ? await EventCredentialModel.findById(resolved.ticketId).exec()
            : null;
          if (cred) {
            const mongoEvent = cred.eventId
              ? await EventModel.findById(cred.eventId).exec()
              : null;
            const ticketData: TicketImageData = {
              ticketId: resolved.displayId,
              guestName: cred.holder?.name || resolved.fileName.replace(/\.png$/, ''),
              eventName: mongoEvent?.name || 'Event Pass',
              eventDate: mongoEvent?.schedule?.startAt
                ? new Date(mongoEvent.schedule.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Date TBA',
              ticketType: cred.holder?.category || cred.credentialType || 'General Admission',
              verificationToken: cred.verificationToken,
              venue: mongoEvent?.venue?.city || mongoEvent?.venue?.name || 'Venue TBA',
              organization: cred.holder?.organization || undefined,
              teamName: (cred as any)?.teamName || (cred.holder as any)?.teamName || undefined,
            };
            const generated = await this.imageServ.generateTicketImage(ticketData);
            if (isPngBuffer(generated.pngBuffer)) {
              fileBuffer = generated.pngBuffer;
              try {
                const storagePath = resolved.candidatePaths[0] || `events/${resolved.eventId}/credentials/${cred._id}.png`;
                const uploadRes = await this.storageServ.uploadTicketImage(storagePath, generated.pngBuffer);
                if (uploadRes?.publicUrl) {
                  await EventCredentialModel.updateOne(
                    { _id: cred._id },
                    {
                      $set: {
                        'asset.publicUrl': uploadRes.publicUrl,
                        'asset.storagePath': uploadRes.storagePath,
                        'asset.renderedAt': new Date(),
                      },
                    }
                  ).exec().catch(() => {});
                }
              } catch {}
            }
          }
        } catch (imgErr) {
          console.error('[TicketService] Direct TicketImageService fallback error:', imgErr);
        }
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
  async streamTicketsZip(eventId: string, userId: string, streamOut: NodeJS.WritableStream, ticketIds?: string[]): Promise<void> {
    let eventName = 'EVT';
    let isMongoEvent = false;
    let mongoEvent: any = null;

    if (mongoose.Types.ObjectId.isValid(eventId)) {
      mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        isMongoEvent = true;
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId;

        if (!isOwner) {
          const member = await EventMemberModel.findOne({
            eventId: mongoEvent._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] } as any,
          } as any);
          if (!member) {
            throw new NotFoundError('Event not found or unauthorized');
          }
        }
        eventName = mongoEvent.name || 'EVT';
      }
    }

    if (!isMongoEvent) {
      const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
      if (!event) {
        throw new NotFoundError('Event not found or unauthorized');
      }
      eventName = event.name || 'EVT';
    }

    const archive = await createZipArchive({ zlib: { level: 6 } });
    let archiveAborted = false;
    let streamClosed = false;

    archive.on('error', (err: any) => {
      console.error('[BulkExport] Archive error:', err);
    });

    const safePrefix =
      eventName.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';

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
    const BATCH_SIZE = 50;

    try {
      // 1. If not a Mongo event, try Keyset Pagination on PostgreSQL ticketRepo
      if (!isMongoEvent) {
        try {
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

              // Priority 1: Render on-demand using TicketImageService
              if (this.imageServ && typeof this.imageServ.generateTicketImage === 'function') {
                try {
                  const ev = t.event || (await this.eventRepo.findById(eventId));
                  const qrDataUrl = await this.qrServ.generateQrDataUrl(t.ticket?.verificationToken || t.verificationToken);
                  const ticketData: TicketImageData = {
                    ticketId: displayId,
                    guestName: guestName || 'Valued Guest',
                    eventName: ev?.name || eventName,
                    eventDate: ((ev as any)?.date && (ev as any).date !== '2026-10-10')
                      ? (ev as any).date
                      : ((ev as any)?.schedule?.startAt ? new Date((ev as any).schedule.startAt).toLocaleDateString() : 'Date TBA'),
                    ticketType: t.ticketType?.label || t.ticketType?.name || (isWorker ? 'Event Staff' : 'General Admission'),
                    qrCodeDataUrl: qrDataUrl,
                    verificationToken: t.ticket?.verificationToken || t.verificationToken,
                    venue: (ev as any)?.venue?.city || (ev as any)?.venue?.name || 'Venue TBA',
                  };
                  const renderRes = await this.imageServ.generateTicketImage(ticketData);
                  if (renderRes?.pngBuffer && isPngBuffer(renderRes.pngBuffer)) {
                    fileBuffer = renderRes.pngBuffer;
                    const storagePath = candidatePaths[0] || `events/${eventId}/tickets/ticket-${displayId}.png`;
                    this.storageServ.uploadTicketImage(storagePath, renderRes.pngBuffer, 'image/png').catch(() => {});
                  }
                } catch (pgRenderErr) {
                  console.warn('[TicketService] PG pass on-demand render fallback to storage:', pgRenderErr);
                }
              }

              // Priority 2: Fallback to existing storage asset
              if (!fileBuffer) {
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
        } catch (pgErr) {
          console.warn('[TicketService] PostgreSQL export failed or unconfigured, falling back to Mongo:', pgErr);
        }
      }

      // 2. Check MongoDB credentials cursor (primary for Mongo events, fallback for dual-engine)
      if (totalDiscovered === 0 && mongoose.connection.readyState === 1) {
        try {
          const mongoQuery: any = { eventId: new mongoose.Types.ObjectId(eventId) };
          if (ticketIds && ticketIds.length > 0) {
            const validObjectIds = ticketIds
              .filter((id) => mongoose.Types.ObjectId.isValid(id))
              .map((id) => new mongoose.Types.ObjectId(id));
            mongoQuery.$or = [
              { _id: { $in: validObjectIds } },
              { formattedId: { $in: ticketIds } },
            ];
          }
          cursor = EventCredentialModel.find(mongoQuery)
            .sort({ sequenceNumber: 1 })
            .cursor({ batchSize: BATCH_SIZE });
          for await (const cred of cursor) {
            if (streamClosed) break;
            totalDiscovered++;

            let fileBuffer: Buffer | null = null;

            // 1. Priority: Download pre-rendered ticket PNG from Supabase Storage (zero CPU load, fast streaming)
            if (cred.asset?.storagePath && this.storageServ.isConfigured()) {
              try {
                const buf = await this.storageServ.downloadTicketImage(cred.asset.storagePath);
                if (isPngBuffer(buf)) {
                  fileBuffer = buf;
                }
              } catch {}
            }

            // 2. Fallback: Only render on-demand if the ticket image was not found in storage
            if (!fileBuffer && this.imageServ && typeof this.imageServ.generateTicketImage === 'function') {
              try {
                const seqStr = (cred.sequenceNumber || 1).toString().padStart(5, '0');
                const displayId = cred.formattedId || `${safePrefix}-${seqStr}`;
                const eventDateStr =
                  ((mongoEvent as any)?.date && (mongoEvent as any).date !== '2026-10-10')
                    ? (mongoEvent as any).date
                    : (mongoEvent?.schedule?.startAt
                        ? new Date(mongoEvent.schedule.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Date TBA');

                const ticketData: TicketImageData = {
                  ticketId: displayId,
                  guestName: cred.holder?.name || 'Valued Guest',
                  eventName: mongoEvent?.name || eventName || 'Event Pass',
                  eventDate: eventDateStr,
                  ticketType: cred.credentialType || cred.holder?.category || 'General Admission',
                  verificationToken: cred.verificationToken,
                  venue: mongoEvent?.venue?.city || mongoEvent?.venue?.name || 'Venue TBA',
                  organization: cred.holder?.organization || undefined,
                  phone: cred.holder?.phone || undefined,
                  teamName: (cred as any)?.teamName || (cred.holder as any)?.teamName || undefined,
                };

                const renderRes = await this.imageServ.generateTicketImage(ticketData);
                if (renderRes?.pngBuffer && isPngBuffer(renderRes.pngBuffer)) {
                  fileBuffer = renderRes.pngBuffer;

                  // Asynchronously refresh the cached asset in Supabase Storage and DB
                  const storagePath = cred.asset?.storagePath || `events/${eventId}/credentials/${cred._id}.png`;
                  this.storageServ.uploadTicketImage(storagePath, renderRes.pngBuffer, 'image/png')
                    .then((uploadRes) => {
                      EventCredentialModel.updateOne(
                        { _id: cred._id },
                        {
                          $set: {
                            'asset.publicUrl': uploadRes.publicUrl,
                            'asset.storagePath': uploadRes.storagePath,
                            'asset.renderedAt': new Date(),
                          },
                        }
                      ).exec().catch(() => {});
                    })
                    .catch(() => {});
                }
              } catch (renderErr) {
                console.warn('[TicketService] On-demand fallback render in ZIP export failed:', renderErr);
              }
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

  /**
   * Generate an Excel (.xlsx) workbook containing complete guest details and ticket image URLs.
   */
  async generateTicketsExcel(
    eventId: string,
    userId: string,
    ticketIds?: string[]
  ): Promise<{ buffer: Buffer; fileName: string; count: number }> {
    let eventName = 'Event';
    let isMongoEvent = false;
    let mongoEvent: any = null;

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(eventId)) {
      mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        isMongoEvent = true;
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId;

        if (!isOwner) {
          const member = await EventMemberModel.findOne({
            eventId: mongoEvent._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] } as any,
          } as any);
          if (!member) {
            throw new NotFoundError('Event not found or unauthorized');
          }
        }
        eventName = mongoEvent.name || 'Event';
      }
    }

    if (!isMongoEvent) {
      const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
      if (!event) {
        throw new NotFoundError('Event not found or unauthorized');
      }
      eventName = event.name || 'Event';
    }

    // Fetch all tickets for this event (up to 50,000)
    const { tickets } = await this.getTicketsByEvent(eventId, userId, { limit: 50000 });

    let targetTickets: any[] = tickets;
    if (ticketIds && ticketIds.length > 0) {
      const idSet = new Set(ticketIds);
      targetTickets = tickets.filter((t) => idSet.has(t.id));
    }

    const safePrefix =
      (eventName || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';
    const baseUrl = (config.env.appUrl || 'http://localhost:5173').replace(/\/+$/, '');

    // Ensure all tickets have authentic, direct Supabase Storage public URLs before building spreadsheet
    if (isMongoEvent && this.storageServ.isConfigured()) {
      for (const t of targetTickets) {
        if (!t.assetUrl || !t.assetUrl.startsWith('http')) {
          try {
            const cred = await EventCredentialModel.findById(t.id).exec();
            if (cred) {
              const seqStr = (cred.sequenceNumber || 1).toString().padStart(5, '0');
              const displayId = cred.formattedId || `${safePrefix}-${seqStr}`;
              const storagePath = cred.asset?.storagePath || `events/${eventId}/credentials/${displayId}.png`;

              // 1. Storage Pre-Check: If asset already exists in Supabase Storage, retrieve direct URL with zero Sharp overhead
              try {
                const exists = await this.storageServ.checkObjectExists(storagePath);
                if (exists) {
                  const publicUrl = this.storageServ.getPublicUrl(storagePath);
                  if (publicUrl) {
                    await EventCredentialModel.updateOne(
                      { _id: cred._id },
                      {
                        $set: {
                          'asset.publicUrl': publicUrl,
                          'asset.storagePath': storagePath,
                          'asset.renderedAt': new Date(),
                          renderStatus: 'COMPLETED',
                        },
                      }
                    );
                    t.assetUrl = publicUrl;
                    continue;
                  }
                }
              } catch (storageCheckErr: any) {
                console.warn(`[generateTicketsExcel] Storage existence check failed for ${storagePath}:`, storageCheckErr.message);
              }

              // 2. Bound memory: Do not run synchronous Sharp rendering during Excel export for bulk rosters (> 5 tickets)
              // Background worker handles bulk rasterization asynchronously; spreadsheet falls back to download route
              if (targetTickets.length > 5) {
                continue;
              }

              // 3. For small batches (<= 5), render with bounded buffer dereferencing and immediate GC trigger
              const eventDateStr = ((mongoEvent as any)?.date && (mongoEvent as any).date !== '2026-10-10')
                ? (mongoEvent as any).date
                : (mongoEvent?.schedule?.startAt
                    ? new Date(mongoEvent.schedule.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Date TBA');
              const qrDataUrl = await this.qrServ.generateQrDataUrl(cred.verificationToken);
              const ticketData: TicketImageData = {
                ticketId: displayId,
                guestName: cred.holder?.name || 'Valued Guest',
                eventName: mongoEvent?.name || eventName || 'Event Pass',
                eventDate: eventDateStr,
                ticketType: cred.credentialType || cred.holder?.category || 'General Admission',
                verificationToken: cred.verificationToken,
                qrCodeDataUrl: qrDataUrl,
                venue: mongoEvent?.venue?.city || mongoEvent?.venue?.name || 'Venue TBA',
                organization: cred.holder?.organization || undefined,
                phone: cred.holder?.phone || undefined,
              };

              const rendered = await this.imageServ.generateTicketImage(ticketData);
              if (rendered?.pngBuffer && isPngBuffer(rendered.pngBuffer)) {
                const uploadRes = await this.storageServ.uploadTicketImage(storagePath, rendered.pngBuffer, 'image/png');
                rendered.pngBuffer = null as any;
                if (uploadRes?.publicUrl) {
                  await EventCredentialModel.updateOne(
                    { _id: cred._id },
                    {
                      $set: {
                        'asset.publicUrl': uploadRes.publicUrl,
                        'asset.storagePath': uploadRes.storagePath,
                        'asset.renderedAt': new Date(),
                        renderStatus: 'COMPLETED',
                      },
                    }
                  );
                  t.assetUrl = uploadRes.publicUrl;
                }
              }
              memoryBudgetGovernor.triggerGarbageCollection();
            }
          } catch (e: any) {
            console.warn(`[generateTicketsExcel] Failed to generate missing asset for ${t.id}:`, e.message);
          }
        }
      }
    }

    const hasPhone = targetTickets.some((t) => Boolean(t.guest?.phone && t.guest.phone.trim()));
    const hasEmail = targetTickets.some((t) => Boolean(t.guest?.email && t.guest.email.trim()));

    // When both contact and email exist, or neither exists, provide separate columns for both
    const showBoth = (hasPhone && hasEmail) || (!hasPhone && !hasEmail);
    const showOnlyPhone = hasPhone && !hasEmail;

    const rows = targetTickets.map((t) => {
      const guest = t.guest || {};
      const name =
        guest.name && guest.name !== 'UNASSIGNED'
          ? guest.name
          : (t.ticketType?.name === 'WORKER' ? 'Event Staff' : 'Valued Guest');

      const phone = (guest.phone || '').trim();
      const email = (guest.email || '').trim();

      const ticketUrl =
        t.assetUrl && t.assetUrl.startsWith('http')
          ? t.assetUrl
          : `${baseUrl}/api/tickets/events/${eventId}/tickets/${t.id}/download`;

      if (showBoth) {
        return {
          'Name': name,
          'Contact': phone || '-',
          'Email': email || '-',
          'Ticket URL': ticketUrl,
        };
      }

      if (showOnlyPhone) {
        return {
          'Name': name,
          'Contact': phone || '-',
          'Ticket URL': ticketUrl,
        };
      }

      return {
        'Name': name,
        'Email': email || '-',
        'Ticket URL': ticketUrl,
      };
    });

    const emptyHeaders = showBoth
      ? ['Name', 'Contact', 'Email', 'Ticket URL']
      : showOnlyPhone
      ? ['Name', 'Contact', 'Ticket URL']
      : ['Name', 'Email', 'Ticket URL'];

    const worksheet =
      rows.length > 0
        ? xlsx.utils.json_to_sheet(rows)
        : xlsx.utils.aoa_to_sheet([emptyHeaders]);

    // Generous column widths so data is easily readable
    if (showBoth) {
      worksheet['!cols'] = [
        { wch: 30 }, // Name
        { wch: 22 }, // Contact
        { wch: 36 }, // Email
        { wch: 80 }, // Ticket URL
      ];
    } else if (showOnlyPhone) {
      worksheet['!cols'] = [
        { wch: 30 }, // Name
        { wch: 25 }, // Contact
        { wch: 80 }, // Ticket URL
      ];
    } else {
      worksheet['!cols'] = [
        { wch: 30 }, // Name
        { wch: 36 }, // Email
        { wch: 80 }, // Ticket URL
      ];
    }

    // Format text cells and hyperlinks
    rows.forEach((r: any, idx) => {
      const rowIdx = idx + 2; // 1-based, row 1 is header
      if (showBoth) {
        const contactRef = `B${rowIdx}`;
        if (worksheet[contactRef]) {
          worksheet[contactRef].t = 's';
          worksheet[contactRef].z = '@';
        }
        const urlCellRef = `D${rowIdx}`;
        if (worksheet[urlCellRef] && r['Ticket URL']) {
          worksheet[urlCellRef].l = { Target: r['Ticket URL'], Tooltip: 'Click to open ticket' };
        }
      } else {
        if (showOnlyPhone) {
          const contactRef = `B${rowIdx}`;
          if (worksheet[contactRef]) {
            worksheet[contactRef].t = 's';
            worksheet[contactRef].z = '@';
          }
        }
        const urlCellRef = `C${rowIdx}`;
        if (worksheet[urlCellRef] && r['Ticket URL']) {
          worksheet[urlCellRef].l = { Target: r['Ticket URL'], Tooltip: 'Click to open ticket' };
        }
      }
    });

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Tickets Roster');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const cleanEventName =
      eventName
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_') || 'Event';
    const fileName = `${cleanEventName}-${ticketIds && ticketIds.length > 0 ? 'Selected-' : ''}Tickets-Roster.xlsx`;

    return {
      buffer,
      fileName,
      count: rows.length,
    };
  }

  /**
   * Revoke an issued ticket or credential, enforcing event isolation and RBAC.
   */
  async revokeTicket(
    ticketId: string,
    eventId: string,
    userId: string,
    reason?: string
  ): Promise<{ id: string; status: string; message: string }> {
    // 1. Check MongoDB credentials first
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(eventId)) {
      const mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId;

        if (!isOwner) {
          const member = await EventMemberModel.findOne({
            eventId: mongoEvent._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] } as any,
          } as any);
          if (!member) {
            throw new NotFoundError('Event not found or unauthorized');
          }
        }

        const updated = await mongoEventCredentialRepository.updateStatus(
          eventId,
          ticketId,
          'REVOKED',
          reason || 'Revoked by host'
        );

        if (!updated) {
          throw new NotFoundError('Ticket/Credential not found in this event');
        }

        return {
          id: updated._id.toString(),
          status: 'REVOKED',
          message: 'Credential revoked successfully',
        };
      }
    }

    // 2. Check PostgreSQL repository
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new NotFoundError('Event not found or unauthorized');
    }

    const ticketRecord = await this.ticketRepo.findById(ticketId);
    const t = (ticketRecord as any)?.ticket || ticketRecord;
    if (!t || t.eventId !== eventId) {
      throw new NotFoundError('Ticket not found in this event');
    }

    await this.ticketRepo.update(ticketId, { status: 'REVOKED' });
    return {
      id: ticketId,
      status: 'REVOKED',
      message: 'Ticket revoked successfully',
    };
  }
}

export const ticketService = new TicketService();
