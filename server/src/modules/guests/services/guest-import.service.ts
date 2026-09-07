import * as xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { guestRepository, GuestRepository, CreateGuestInput } from '../repositories/guest.repository';
import { guestImportRepository, GuestImportRepository } from '../repositories/guest-import.repository';
import { eventRepository, EventRepository } from '../../events/repositories/event.repository';
import { ticketTypeRepository, TicketTypeRepository } from '../../events/repositories/ticket-type.repository';
import { AppError } from '../../../middlewares/error.middleware';

export interface ColumnDetection {
  targetField: string;
  matchedHeader: string;
  confidence: number;
}

export interface HeaderAnalysisResult {
  importId: string;
  fileName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, any>[];
  detectedMappings: Record<string, string>; // header -> targetField
  detectedCategories: string[]; // unique raw values found in category column
  confidenceScores: Record<string, number>;
}

export interface ValidationConfig {
  importId: string;
  columnMapping: Record<string, string>; // header -> targetField ('name' | 'email' | 'phone' | 'organization' | 'designation' | 'category' | 'count' | 'ignore')
  requiredFields: string[]; // e.g. ['name', 'category']
  categoryMapping: Record<string, string>; // rawCategoryValue -> eventTicketTypeName
  defaultCategory?: string;
}

export interface RowError {
  rowNumber: number;
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationResult {
  importId: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  warningRowsCount: number;
  duplicateRowsCount: number;
  errors: RowError[];
  sampleValidRows: Array<{
    rowNumber: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    organization: string | null;
    designation: string | null;
    category: string;
    count: number;
  }>;
}

export class GuestImportService {
  // In-memory cache of parsed file buffers/paths keyed by importId
  private activeUploads = new Map<string, { filePath: string; rawRows: Record<string, any>[] }>();

  constructor(
    private guestRepo: GuestRepository = guestRepository,
    private importRepo: GuestImportRepository = guestImportRepository,
    private eventRepo: EventRepository = eventRepository,
    private ticketTypeRepo: TicketTypeRepository = ticketTypeRepository
  ) {}

  /**
   * Helper to detect field mapping with confidence scoring
   */
  private detectField(header: string): { field: string; confidence: number } {
    const clean = header.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

    if (/^(full\s*name|guest\s*name|name|attendee|person|student|delegate|participant)$/.test(clean)) {
      return { field: 'name', confidence: 0.95 };
    }
    if (clean.includes('name')) {
      return { field: 'name', confidence: 0.8 };
    }

    if (/^(email|e\s*mail|mail|email\s*address)$/.test(clean)) {
      return { field: 'email', confidence: 0.95 };
    }
    if (clean.includes('email') || clean.includes('mail')) {
      return { field: 'email', confidence: 0.8 };
    }

    if (/^(phone|mobile|cell|contact|phone\s*number|mobile\s*number|whatsapp)$/.test(clean)) {
      return { field: 'phone', confidence: 0.95 };
    }
    if (clean.includes('phone') || clean.includes('mobile') || clean.includes('contact') || clean.includes('whatsapp')) {
      return { field: 'phone', confidence: 0.8 };
    }

    if (/^(company|organization|organisation|institute|institution|firm|college|university|business)$/.test(clean)) {
      return { field: 'organization', confidence: 0.9 };
    }
    if (clean.includes('company') || clean.includes('org') || clean.includes('institute') || clean.includes('college')) {
      return { field: 'organization', confidence: 0.75 };
    }

    if (/^(designation|title|job\s*title|role|position|occupation|profession)$/.test(clean)) {
      return { field: 'designation', confidence: 0.9 };
    }
    if (clean.includes('designation') || clean.includes('title') || clean.includes('role') || clean.includes('position')) {
      return { field: 'designation', confidence: 0.75 };
    }

    if (/^(category|guest\s*type|ticket\s*type|pass\s*type|type|class|tier|group)$/.test(clean)) {
      return { field: 'category', confidence: 0.95 };
    }
    if (clean.includes('category') || clean.includes('ticket') || clean.includes('type') || clean.includes('pass')) {
      return { field: 'category', confidence: 0.8 };
    }

    if (/^(count|quantity|qty|seats|pass\s*count|number\s*of\s*tickets|tickets)$/.test(clean)) {
      return { field: 'count', confidence: 0.9 };
    }
    if (clean.includes('count') || clean.includes('qty') || clean.includes('seats')) {
      return { field: 'count', confidence: 0.75 };
    }

    return { field: 'ignore', confidence: 0 };
  }

  /**
   * Step 1 & 2: Upload file, inspect headers, sample data, and detect fields.
   */
  async uploadAndAnalyze(
    eventId: string,
    userId: string,
    filePath: string,
    originalName: string
  ): Promise<HeaderAnalysisResult> {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    if (!fs.existsSync(filePath)) {
      throw new AppError('Uploaded file not found on disk', 400);
    }

    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.readFile(filePath, { cellDates: true });
    } catch (err: any) {
      throw new AppError(`Failed to parse spreadsheet: ${err.message}`, 400);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Spreadsheet contains no sheets', 400);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawJson: Record<string, any>[] = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rawJson.length === 0) {
      throw new AppError('The spreadsheet appears to be empty', 400);
    }

    // Extract headers
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

    // Create a guest_imports record
    const importRecord = await this.importRepo.create({
      eventId,
      fileName: originalName,
      totalRows: rawJson.length,
      status: 'ANALYZING',
      columnMapping: detectedMappings,
      createdBy: userId,
    });

    // Cache parsed rows in memory
    this.activeUploads.set(importRecord.id, { filePath, rawRows: rawJson });

    return {
      importId: importRecord.id,
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
   * Step 3 & 4: Validate mapped rows against configured required fields and category rules.
   */
  async validateImport(
    eventId: string,
    userId: string,
    config: ValidationConfig
  ): Promise<ValidationResult> {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    let cached = this.activeUploads.get(config.importId);
    let rawRows: Record<string, any>[] | null = cached?.rawRows || null;

    if (!rawRows && cached?.filePath && fs.existsSync(cached.filePath)) {
      try {
        const workbook = xlsx.readFile(cached.filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if (sheetName) {
          rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
          this.activeUploads.set(config.importId, { filePath: cached.filePath, rawRows });
        }
      } catch (readErr) {
        console.warn('[GuestImportService] Failed to re-read cached file:', readErr);
      }
    }

    if (!rawRows) {
      throw new AppError('Import session data expired. Please re-upload your spreadsheet to proceed.', 400);
    }
    const requiredFields = new Set(config.requiredFields || ['name', 'category']);
    const categoryMapping = config.categoryMapping || {};
    const defaultCategory = config.defaultCategory || 'GENERAL';

    const errors: RowError[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let warningCount = 0;

    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    const sampleValidRows: ValidationResult['sampleValidRows'] = [];

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row index
      let isRowValid = true;

      // Extract values according to columnMapping
      let name: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;
      let organization: string | null = null;
      let designation: string | null = null;
      let category: string = defaultCategory;
      let count = 1;

      for (const [header, targetField] of Object.entries(config.columnMapping)) {
        const rawVal = String(row[header] || '').trim();
        if (!rawVal) continue;

        if (targetField === 'name') name = rawVal;
        else if (targetField === 'email') email = rawVal.toLowerCase();
        else if (targetField === 'phone') phone = rawVal;
        else if (targetField === 'organization') organization = rawVal;
        else if (targetField === 'designation') designation = rawVal;
        else if (targetField === 'category') {
          const mapped = categoryMapping[rawVal] || rawVal.toUpperCase();
          category = mapped;
        } else if (targetField === 'count') {
          const parsed = parseInt(rawVal, 10);
          if (!isNaN(parsed) && parsed > 0) count = parsed;
        }
      }

      // 1. Check required fields
      const hasName = typeof name === 'string' && name.trim().length > 0;
      const hasEmail = typeof email === 'string' && email.trim().length > 0;
      const hasPhone = typeof phone === 'string' && phone.trim().length > 0;

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

    // Update guest_imports audit record
    await this.importRepo.update(config.importId, {
      columnMapping: config.columnMapping,
      requiredFields: Array.from(requiredFields),
      categoryMapping: config.categoryMapping,
      validRows: validCount,
      invalidRows: invalidCount,
      status: 'VALIDATED',
      errorReport: errors.slice(0, 100), // persist sample of errors
    });

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
   * Step 5: Execute and commit valid guest records into PostgreSQL.
   */
  async confirmImport(
    eventId: string,
    userId: string,
    importId: string,
    options: { skipDuplicates?: boolean } = {}
  ) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const importRecord = await this.importRepo.findById(importId);
    if (!importRecord) {
      throw new AppError('Import record not found', 404);
    }

    const cached = this.activeUploads.get(importId);
    if (!cached) {
      throw new AppError('Import session data expired. Please start a new import.', 400);
    }

    const { rawRows } = cached;
    const columnMapping = (importRecord.columnMapping as Record<string, string>) || {};
    const requiredFields = new Set((importRecord.requiredFields as string[]) || ['name', 'category']);
    const categoryMapping = (importRecord.categoryMapping as Record<string, string>) || {};

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
        const rawVal = String(row[header] || '').trim();
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

      // Verify row is valid
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

      // Check skip duplicates
      if (options.skipDuplicates) {
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
          importId,
        });
      }
    });

    // Batch insert into database
    const inserted = await this.guestRepo.insertMany(guestsToInsert);

    // Update import audit record
    await this.importRepo.update(importId, {
      status: 'COMPLETED',
      validRows: inserted.length,
      skippedRows: skippedCount,
    });

    // Clean up temporary cache and disk file
    try {
      if (fs.existsSync(cached.filePath)) {
        fs.unlinkSync(cached.filePath);
      }
    } catch (_err) {
      // Ignore cleanup error
    }
    this.activeUploads.delete(importId);

    return {
      success: true,
      importedCount: inserted.length,
      skippedCount,
      importId,
    };
  }

  /**
   * List all guests for an event.
   */
  async listGuests(eventId: string, userId: string, limit = 500, offset = 0) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    const guests = await this.guestRepo.findByEventId(eventId, limit, offset);
    const total = await this.guestRepo.countByEventId(eventId);

    return {
      guests,
      total,
      limit,
      offset,
    };
  }

  /**
   * List past import sessions for an event.
   */
  async listImports(eventId: string, userId: string) {
    const event = await this.eventRepo.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new AppError('Event not found or unauthorized', 404);
    }

    return await this.importRepo.findByEventId(eventId);
  }
}

export const guestImportService = new GuestImportService();
