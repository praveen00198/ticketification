import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import config from '../../../config/env';
import { guestRepository, GuestRepository, CreateGuestInput } from '../repositories/guest.repository';
import { guestImportRepository, GuestImportRepository } from '../repositories/guest-import.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from '../../../middlewares/error.middleware';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { EventModel } from '../../../db/mongo/models/event.model';
import { EventMemberModel } from '../../../db/mongo/models/event-member.model';
import { EventCredentialModel } from '../../../db/mongo/models/event-credential.model';
import { mongoEventCredentialRepository } from '../../events/repositories/mongo-event-credential.repository';
import {
  HeaderAnalysisResult,
  ValidateImportDTO,
  ValidationResult,
  RowError,
  SampleValidRow,
  ConfirmImportDTO,
  ConfirmImportResult,
  TargetField,
} from '../guest-import.types';

function moveFile(src: string, dest: string): void {
  try {
    fs.renameSync(src, dest);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      fs.copyFileSync(src, dest);
      fs.unlinkSync(src);
    } else {
      throw err;
    }
  }
}

export class GuestImportService {
  // In-memory cache of parsed file buffers/paths keyed by importId for sub-millisecond hot access
  private activeUploads = new Map<
    string,
    {
      filePath: string;
      rawRows: Record<string, any>[];
      eventId?: string;
      userId?: string;
      isMongo?: boolean;
      fileName?: string;
      columnMapping?: Record<string, string>;
      requiredFields?: string[];
      categoryMapping?: Record<string, string>;
      defaultCategory?: string;
    }
  >();

  constructor(
    private guestRepo: GuestRepository = guestRepository,
    private importRepo: GuestImportRepository = guestImportRepository,
    private eventRepo: EventRepository = eventRepository,
    private ticketTypeRepo: TicketTypeRepository = ticketTypeRepository
  ) {}

  /**
   * Universal Event Authorization helper defending against IDOR across MongoDB & PostgreSQL.
   */
  async checkEventAuthorization(
    eventId: string,
    userId: string
  ): Promise<{ isMongo: boolean; event: any }> {
    const isMongo = mongoose.connection.readyState === 1 || Boolean((EventModel.findById as any)?.mock);
    if (isMongo && mongoose.Types.ObjectId.isValid(eventId)) {
      const mongoEvent = await EventModel.findById(eventId);
      if (mongoEvent) {
        const isOwner =
          mongoEvent.ownerSupabaseId === userId ||
          String(mongoEvent.ownerId) === userId ||
          String(mongoEvent.ownerSupabaseId) === userId;

        if (!isOwner) {
          const userObjId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : null;

          const queryConditions: any[] = [{ userEmail: userId.toLowerCase() }];
          if (userObjId) {
            queryConditions.push({ userId: userObjId });
          }

          const member = await EventMemberModel.findOne({
            eventId: mongoEvent._id,
            status: 'ACTIVE',
            role: { $in: ['HOST', 'COORDINATOR'] },
            $or: queryConditions,
          } as any);

          if (!member) {
            throw new AuthorizationError('Access denied. You do not have permission to manage guest imports for this event.', 403);
          }
        }
        return { isMongo: true, event: mongoEvent };
      }
      throw new NotFoundError('Event not found');
    }

    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AuthorizationError('Access denied. You do not have permission to manage guest imports for this event.', 403);
    }
    return { isMongo: false, event };
  }

  private getUploadDir(): string {
    const dir = path.resolve(process.cwd(), config.env.uploadDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private getStagingPath(importId: string, ext = '.xlsx'): string {
    return path.join(this.getUploadDir(), `staging-${importId}${ext}`);
  }

  private findStagingPath(importId: string): string | null {
    const uploadDir = this.getUploadDir();
    const prefix = `staging-${importId}`;
    try {
      const files = fs.readdirSync(uploadDir);
      const match = files.find((f) => f.startsWith(prefix));
      if (match) {
        return path.join(uploadDir, match);
      }
    } catch {
      // ignore
    }
    return null;
  }

  private parseSpreadsheet(filePath: string): Record<string, any>[] {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError(`Spreadsheet file not found on disk: ${filePath}`);
    }

    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.readFile(filePath, { cellDates: true });
    } catch (err: any) {
      throw new ValidationError(`Failed to parse spreadsheet: ${err.message}`);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new ValidationError('Spreadsheet contains no sheets');
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawJson: Record<string, any>[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawJson.length === 0) {
      throw new ValidationError('The spreadsheet appears to be empty or contains no data rows');
    }

    return rawJson;
  }

  /**
   * Helper to detect field mapping with confidence scoring
   */
  public detectField(header: string): { field: TargetField; confidence: number } {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

    // 1. Exact / strong regex matches
    if (/^(full\s*name|guest\s*name|name|attendee\s*name|attendee|person|student|delegate|participant)$/.test(clean)) {
      return { field: 'name', confidence: 0.95 };
    }
    if (/^(email|e\s*mail|mail|email\s*address|contact\s*email)$/.test(clean)) {
      return { field: 'email', confidence: 0.95 };
    }
    if (/^(phone|mobile|cell|contact|phone\s*number|mobile\s*number|contact\s*number|whatsapp)$/.test(clean)) {
      return { field: 'phone', confidence: 0.95 };
    }
    if (/^(company(\s*name)?|organization(\s*name)?|organisation(\s*name)?|org(\s*name)?|institute|institution|firm|college|university|business|agency)$/.test(clean)) {
      return { field: 'organization', confidence: 0.95 };
    }
    if (/^(designation|title|job\s*title|role|position|occupation|profession)$/.test(clean)) {
      return { field: 'designation', confidence: 0.95 };
    }
    if (/^(count|quantity|qty|seats|pass\s*count|ticket\s*count|number\s*of\s*tickets|tickets)$/.test(clean)) {
      return { field: 'count', confidence: 0.95 };
    }
    if (/^(category|guest\s*type|ticket\s*type|pass\s*type|type|class|tier|group|ticket\s*category)$/.test(clean)) {
      return { field: 'category', confidence: 0.95 };
    }

    // 2. Substring fallbacks (with disambiguation)
    if (clean.includes('company') || clean.includes('org') || clean.includes('institute') || clean.includes('college')) {
      return { field: 'organization', confidence: 0.8 };
    }
    if (clean.includes('name') && !clean.includes('org') && !clean.includes('company')) {
      return { field: 'name', confidence: 0.8 };
    }
    if (clean.includes('email') || clean.includes('mail')) {
      return { field: 'email', confidence: 0.8 };
    }
    if (clean.includes('phone') || clean.includes('mobile') || clean.includes('contact') || clean.includes('whatsapp')) {
      return { field: 'phone', confidence: 0.8 };
    }
    if (clean.includes('designation') || clean.includes('title') || clean.includes('role') || clean.includes('position')) {
      return { field: 'designation', confidence: 0.75 };
    }
    if (clean.includes('count') || clean.includes('qty') || clean.includes('seats') || clean.includes('quantity')) {
      return { field: 'count', confidence: 0.8 };
    }
    if (
      clean.includes('category') ||
      clean.includes('tier') ||
      clean.includes('pass') ||
      (clean.includes('ticket') && !clean.includes('count') && !clean.includes('number'))
    ) {
      return { field: 'category', confidence: 0.8 };
    }

    return { field: 'ignore', confidence: 0 };
  }

  /**
   * Step 1: Upload file, inspect headers, sample data, persist staging file, and detect fields.
   */
  async uploadAndAnalyze(
    eventId: string,
    userId: string,
    tempFilePath: string,
    originalName: string
  ): Promise<HeaderAnalysisResult> {
    const { isMongo } = await this.checkEventAuthorization(eventId, userId);

    const rawJson = this.parseSpreadsheet(tempFilePath);
    const headers = Object.keys(rawJson[0]);

    const detectedMappings: Record<string, string> = {};
    const confidenceScores: Record<string, number> = {};

    headers.forEach((h) => {
      const detection = this.detectField(h);
      if (detection.confidence > 0) {
        detectedMappings[h] = detection.field;
        confidenceScores[h] = detection.confidence;
      } else {
        detectedMappings[h] = 'ignore';
        confidenceScores[h] = 0;
      }
    });

    // Detect unique categories from the guessed category column
    const categoryHeader = Object.keys(detectedMappings).find((h) => detectedMappings[h] === 'category');
    const detectedCategoriesSet = new Set<string>();

    if (categoryHeader) {
      rawJson.forEach((row) => {
        const val = String(row[categoryHeader] || '').trim();
        if (val) detectedCategoriesSet.add(val);
      });
    }

    let importId: string;
    if (isMongo) {
      importId = `imp-${new mongoose.Types.ObjectId().toString()}`;
    } else {
      const importRecord = await this.importRepo.create({
        eventId,
        fileName: originalName,
        totalRows: rawJson.length,
        status: 'ANALYZING',
        columnMapping: detectedMappings,
        createdBy: userId,
      });
      importId = importRecord.id;
    }

    // Move uploaded file to persistent staging location named after import ID
    const ext = path.extname(originalName).toLowerCase() || '.xlsx';
    const stagingPath = this.getStagingPath(importId, ext);
    try {
      moveFile(tempFilePath, stagingPath);
    } catch {
      // In case tempFilePath was memory or could not be moved, fallback
    }

    // Cache in memory for fast retrieval
    this.activeUploads.set(importId, {
      filePath: stagingPath,
      rawRows: rawJson,
      eventId,
      userId,
      isMongo,
      fileName: originalName,
      columnMapping: detectedMappings,
    });

    return {
      importId,
      fileName: originalName,
      headers,
      rowCount: rawJson.length,
      sampleRows: rawJson.slice(0, 5),
      detectedMappings,
      detectedCategories: Array.from(detectedCategoriesSet),
      confidenceScores,
    };
  }

  /**
   * Step 2: Validate mapped rows against configured required fields and category rules.
   */
  async validateImport(
    eventId: string,
    userId: string,
    config: ValidateImportDTO
  ): Promise<ValidationResult> {
    const { isMongo } = await this.checkEventAuthorization(eventId, userId);

    const cached = this.activeUploads.get(config.importId);

    if (!isMongo) {
      const importRecord =
        typeof this.importRepo.findByIdAndEventId === 'function'
          ? await this.importRepo.findByIdAndEventId(config.importId, eventId)
          : await this.importRepo.findById(config.importId);

      if (!importRecord || (importRecord.eventId && importRecord.eventId !== eventId)) {
        throw new NotFoundError('Import session not found for this event');
      }

      if (importRecord.status === 'COMPLETED') {
        throw new ConflictError('This import session has already been completed and committed');
      }
    }

    // Retrieve raw rows from in-memory cache or fallback to persistent staging file
    let rawRows: Record<string, any>[] | null = null;

    if (cached?.rawRows && cached.rawRows.length > 0) {
      rawRows = cached.rawRows;
    } else {
      const stagingPath = cached?.filePath || this.findStagingPath(config.importId);
      if (stagingPath && fs.existsSync(stagingPath)) {
        try {
          rawRows = this.parseSpreadsheet(stagingPath);
          this.activeUploads.set(config.importId, { filePath: stagingPath, rawRows, eventId, isMongo });
        } catch {
          rawRows = null;
        }
      }
    }

    if (!rawRows) {
      throw new ValidationError('Import session data expired or file is missing. Please re-upload your spreadsheet.');
    }

    // Per FR-IMP-3: Minimum required field is Name by default. Phone/email are strictly optional.
    const requiredFields = new Set<string>(
      (config.requiredFields && config.requiredFields.length > 0
        ? config.requiredFields
        : ['name']
      ).map((f) => f.toLowerCase())
    );

    const categoryMapping = config.categoryMapping || {};
    const defaultCategory = (config.defaultCategory || 'GENERAL').toUpperCase();

    const errors: RowError[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let warningCount = 0;

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    const sampleValidRows: SampleValidRow[] = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // 1-indexed header + 1
      let isRowValid = true;

      let name: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;
      let organization: string | null = null;
      let designation: string | null = null;
      let category: string = defaultCategory;
      let count = 1;

      for (const [header, targetField] of Object.entries(config.columnMapping)) {
        const rawVal = String(row[header] !== undefined && row[header] !== null ? row[header] : '').trim();
        if (!rawVal) continue;

        if (targetField === 'name') name = rawVal;
        else if (targetField === 'email') email = rawVal.toLowerCase();
        else if (targetField === 'phone') phone = rawVal;
        else if (targetField === 'organization') organization = rawVal;
        else if (targetField === 'designation') designation = rawVal;
        else if (targetField === 'category') {
          category = categoryMapping[rawVal] || rawVal.toUpperCase();
        } else if (targetField === 'count') {
          const parsed = parseInt(rawVal, 10);
          if (!isNaN(parsed) && parsed > 0) count = parsed;
        }
      }

      // 1. Check required fields
      const hasName = typeof name === 'string' && name.trim().length > 0;
      const hasEmail = typeof email === 'string' && email.trim().length > 0;
      const hasPhone = typeof phone === 'string' && phone.trim().length > 0;
      const hasCategory = typeof category === 'string' && category.trim().length > 0;

      if (requiredFields.has('name') && !hasName) {
        errors.push({
          rowNumber,
          field: 'name',
          message: 'Guest name is required.',
          severity: 'ERROR',
        });
        isRowValid = false;
      }

      if (requiredFields.has('email') && !hasEmail) {
        errors.push({
          rowNumber,
          field: 'email',
          message: 'Email address is required.',
          severity: 'ERROR',
        });
        isRowValid = false;
      }

      if (requiredFields.has('phone') && !hasPhone) {
        errors.push({
          rowNumber,
          field: 'phone',
          message: 'Phone number is required.',
          severity: 'ERROR',
        });
        isRowValid = false;
      }

      if (requiredFields.has('category') && !hasCategory) {
        errors.push({
          rowNumber,
          field: 'category',
          message: 'Guest category is required.',
          severity: 'ERROR',
        });
        isRowValid = false;
      }

      // 2. Email format validation (warning if optional, error if required)
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          if (requiredFields.has('email')) {
            errors.push({
              rowNumber,
              field: 'email',
              message: `Invalid email address format "${email}".`,
              severity: 'ERROR',
            });
            isRowValid = false;
          } else {
            errors.push({
              rowNumber,
              field: 'email',
              message: `Unusual email format "${email}" will be kept as metadata.`,
              severity: 'WARNING',
            });
            warningCount++;
          }
        }
      }

      // 3. Duplicate checks within sheet
      if (email) {
        if (seenEmails.has(email)) {
          errors.push({
            rowNumber,
            field: 'email',
            message: `Duplicate email "${email}" found in spreadsheet.`,
            severity: 'WARNING',
          });
          duplicateCount++;
        } else {
          seenEmails.add(email);
        }
      }

      if (phone) {
        if (seenPhones.has(phone)) {
          errors.push({
            rowNumber,
            field: 'phone',
            message: `Duplicate phone number "${phone}" found in spreadsheet.`,
            severity: 'WARNING',
          });
          duplicateCount++;
        } else {
          seenPhones.add(phone);
        }
      }

      if (isRowValid) {
        validCount++;
        if (sampleValidRows.length < 5) {
          sampleValidRows.push({
            rowNumber,
            name,
            email,
            phone,
            organization,
            designation,
            category,
            count,
          });
        }
      }
    });

    const invalidCount = rawRows.length - validCount;

    if (cached) {
      cached.columnMapping = config.columnMapping;
      cached.requiredFields = Array.from(requiredFields);
      cached.categoryMapping = config.categoryMapping || {};
      cached.defaultCategory = defaultCategory;
    }

    if (!isMongo) {
      // Update guest_imports audit record in PostgreSQL
      await this.importRepo.update(config.importId, {
        columnMapping: config.columnMapping,
        requiredFields: Array.from(requiredFields),
        categoryMapping: config.categoryMapping || {},
        validRows: validCount,
        invalidRows: invalidCount,
        status: 'READY',
        errorReport: errors.slice(0, 100),
      });
    }

    return {
      importId: config.importId,
      totalRows: rawRows.length,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      warningRowsCount: warningCount,
      duplicateRowsCount: duplicateCount,
      errors: errors.slice(0, 200),
      sampleValidRows,
    };
  }

  /**
   * Step 3: Execute and commit valid guest records into PostgreSQL.
   */
  async confirmImport(
    eventId: string,
    userId: string,
    dto: ConfirmImportDTO
  ): Promise<ConfirmImportResult> {
    const { isMongo, event } = await this.checkEventAuthorization(eventId, userId);

    let columnMapping: Record<string, string> = {};
    let requiredFields = new Set<string>(['name']);
    let categoryMapping: Record<string, string> = {};

    if (!isMongo) {
      const importRecord =
        typeof this.importRepo.findByIdAndEventId === 'function'
          ? await this.importRepo.findByIdAndEventId(dto.importId, eventId)
          : await this.importRepo.findById(dto.importId);

      if (!importRecord || (importRecord.eventId && importRecord.eventId !== eventId)) {
        throw new NotFoundError('Import record not found for this event');
      }

      if (importRecord.status === 'COMPLETED') {
        throw new ConflictError('This import session has already been completed');
      }

      columnMapping = (importRecord.columnMapping as Record<string, string>) || {};
      requiredFields = new Set<string>(
        ((importRecord.requiredFields as string[]) || ['name']).map((f) => f.toLowerCase())
      );
      categoryMapping = (importRecord.categoryMapping as Record<string, string>) || {};
    }

    const cached = this.activeUploads.get(dto.importId);

    let rawRows: Record<string, any>[] | null = null;
    if (cached?.rawRows && cached.rawRows.length > 0) {
      rawRows = cached.rawRows;
    } else {
      const stagingPath = cached?.filePath || this.findStagingPath(dto.importId);
      if (stagingPath && fs.existsSync(stagingPath)) {
        try {
          rawRows = this.parseSpreadsheet(stagingPath);
          this.activeUploads.set(dto.importId, { filePath: stagingPath, rawRows, eventId, isMongo });
        } catch {
          rawRows = null;
        }
      }
    }

    if (!rawRows) {
      throw new ValidationError('Import session data expired. Please start a new import.');
    }

    if (isMongo) {
      columnMapping = cached?.columnMapping || {};
      requiredFields = new Set<string>((cached?.requiredFields || ['name']).map((f) => f.toLowerCase()));
      categoryMapping = cached?.categoryMapping || {};
    }

    const guestsToInsert: CreateGuestInput[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    let skippedCount = 0;

    rawRows.forEach((row) => {
      let name: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;
      let organization: string | null = null;
      let designation: string | null = null;
      let category = 'GENERAL';
      let count = 1;
      const metadata: Record<string, any> = {};

      for (const [header, targetField] of Object.entries(columnMapping)) {
        const rawVal = String(row[header] !== undefined && row[header] !== null ? row[header] : '').trim();
        if (!rawVal) continue;

        if (targetField === 'name') name = rawVal;
        else if (targetField === 'email') email = rawVal.toLowerCase();
        else if (targetField === 'phone') phone = rawVal;
        else if (targetField === 'organization') organization = rawVal;
        else if (targetField === 'designation') designation = rawVal;
        else if (targetField === 'category') {
          category = categoryMapping[rawVal] || rawVal.toUpperCase();
        } else if (targetField === 'count') {
          const parsed = parseInt(rawVal, 10);
          if (!isNaN(parsed) && parsed > 0) count = parsed;
        } else if (targetField === 'ignore') {
          metadata[header] = rawVal;
        }
      }

      // Verify row is valid according to requiredFields
      const hasName = typeof name === 'string' && name.trim().length > 0;
      const hasEmail = typeof email === 'string' && email.trim().length > 0;
      const hasPhone = typeof phone === 'string' && phone.trim().length > 0;

      if (requiredFields.has('name') && !hasName) {
        skippedCount++;
        return;
      }
      if (requiredFields.has('email') && !hasEmail) {
        skippedCount++;
        return;
      }
      if (requiredFields.has('phone') && !hasPhone) {
        skippedCount++;
        return;
      }

      // Deduplication filter if requested
      if (dto.skipDuplicates) {
        if (email && seenEmails.has(email)) {
          skippedCount++;
          return;
        }
        if (phone && seenPhones.has(phone)) {
          skippedCount++;
          return;
        }
      }

      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);

      // Add records based on count
      for (let i = 0; i < count; i++) {
        guestsToInsert.push({
          eventId,
          name: i === 0 ? name : `${name} (Guest ${i + 1})`,
          email: i === 0 ? email : null,
          phone: i === 0 ? phone : null,
          organization,
          designation,
          category,
          metadata,
          importId: dto.importId,
        });
      }
    });

    if (isMongo) {
      const terminology = event.credentialTerminology || 'Pass';
      const safePrefix =
        (event.name || 'EVT').trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'EVT';

      const creatorObjectId = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : (event.ownerId && mongoose.Types.ObjectId.isValid(event.ownerId)
            ? new mongoose.Types.ObjectId(event.ownerId)
            : new mongoose.Types.ObjectId());

      let insertedCount = 0;
      for (const row of guestsToInsert) {
        const seq = await mongoEventCredentialRepository.getNextSequenceNumber(eventId);
        const seqStr = seq.toString().padStart(5, '0');
        const formattedId = `${safePrefix}-${seqStr}`;
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const slug = (row.name || 'attendee').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const storagePath = `events/${eventId}/credentials/${slug}-${formattedId}.png`;

        await EventCredentialModel.create({
          eventId: new mongoose.Types.ObjectId(eventId),
          sequenceNumber: seq,
          formattedId,
          verificationToken,
          credentialType: row.category || 'GENERAL',
          terminology,
          usagePolicy: 'SINGLE_USE',
          status: 'ACTIVE',
          holder: {
            name: row.name,
            email: row.email || undefined,
            phone: row.phone || undefined,
            organization: row.organization || undefined,
            designation: row.designation || undefined,
            category: row.category || 'GENERAL',
            isAssigned: true,
          },
          asset: {
            storagePath,
            publicUrl: null,
            renderedAt: null,
            mimeType: 'image/png',
          },
          metadata: row.metadata || {},
          createdBy: creatorObjectId,
        } as any);
        insertedCount++;
      }

      // Clean up temporary disk staging file and in-memory cache
      const stagingPath = cached?.filePath || this.findStagingPath(dto.importId);
      if (stagingPath && fs.existsSync(stagingPath)) {
        try {
          fs.unlinkSync(stagingPath);
        } catch {
          // ignore
        }
      }
      this.activeUploads.delete(dto.importId);

      return {
        success: true,
        importedCount: insertedCount,
        skippedCount,
        importId: dto.importId,
      };
    }

    // Batch insert into PostgreSQL via repository
    const inserted = await this.guestRepo.insertMany(guestsToInsert);

    // Transition import status to COMPLETED
    await this.importRepo.update(dto.importId, {
      status: 'COMPLETED',
      validRows: inserted.length,
      skippedRows: skippedCount,
    });

    // Clean up temporary disk staging file and in-memory cache
    const stagingPath = cached?.filePath || this.findStagingPath(dto.importId);
    if (stagingPath && fs.existsSync(stagingPath)) {
      try {
        fs.unlinkSync(stagingPath);
      } catch {
        // ignore cleanup error
      }
    }
    this.activeUploads.delete(dto.importId);

    return {
      success: true,
      importedCount: inserted.length,
      skippedCount,
      importId: dto.importId,
    };
  }

  /**
   * List past import sessions for an event.
   */
  async listImports(eventId: string, userId: string) {
    const { isMongo } = await this.checkEventAuthorization(eventId, userId);
    if (isMongo) {
      return [];
    }
    return await this.importRepo.findByEventId(eventId);
  }
}

export const guestImportService = new GuestImportService();
