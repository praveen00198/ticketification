import * as xlsx from 'xlsx';
import { ValidationError } from '../../../middlewares/error.middleware';

export interface MappedAttendeeRecord {
  name: string;
  email?: string;
  phone?: string;
  category?: string;
  organization?: string;
  designation?: string;
  customFields?: Record<string, any>;
  rowNumber: number;
}

export interface ParsePreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  detectedHeaders: Record<string, string>;
  rawHeaders: string[];
  sampleRows: MappedAttendeeRecord[];
  validationErrors: Array<{ row: number; error: string; raw: any }>;
  allValidRecords: MappedAttendeeRecord[];
}

export class EventImportParserService {
  private readonly SYNONYM_MAP: Record<string, string[]> = {
    name: [
      'name',
      'fullname',
      'full name',
      'attendeename',
      'attendee name',
      'guest name',
      'participant name',
      'student name',
      'first name',
    ],
    email: ['email', 'e-mail', 'mail', 'emailaddress', 'email address', 'contact email'],
    phone: ['phone', 'phonenumber', 'phone number', 'mobile', 'mobilenumber', 'mobile number', 'contact', 'whatsapp'],
    category: ['category', 'role', 'tickettype', 'ticket type', 'passtype', 'pass type', 'type', 'track', 'designation'],
    organization: ['organization', 'org', 'company', 'college', 'university', 'institution', 'school'],
  };

  /**
   * Parse an uploaded spreadsheet buffer (.xlsx, .xls, .csv) and extract validated records.
   */
  parseSpreadsheetBuffer(buffer: Buffer, _originalFilename?: string): ParsePreviewResult {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Uploaded spreadsheet buffer is empty');
    }

    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer' });
    } catch (err: any) {
      throw new ValidationError(`Failed to parse spreadsheet file: ${err.message}`);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new ValidationError('Spreadsheet does not contain any sheets');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) {
      return {
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        detectedHeaders: {},
        rawHeaders: [],
        sampleRows: [],
        validationErrors: [],
        allValidRecords: [],
      };
    }

    // Identify raw headers from first row
    const rawHeaders = Object.keys(rawRows[0] || {});
    const detectedHeaders = this.detectHeaderMapping(rawHeaders);

    const validRecords: MappedAttendeeRecord[] = [];
    const validationErrors: Array<{ row: number; error: string; raw: any }> = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2; // 1-indexed, accounting for header row
      const name = this.extractFieldValue(row, detectedHeaders.name);
      const email = this.extractFieldValue(row, detectedHeaders.email);
      const phone = this.extractFieldValue(row, detectedHeaders.phone);
      const category = this.extractFieldValue(row, detectedHeaders.category);
      const organization = this.extractFieldValue(row, detectedHeaders.organization);

      // Validation Rules
      if (!name || name.trim().length === 0) {
        validationErrors.push({
          row: rowNum,
          error: 'Attendee name is required and cannot be blank',
          raw: row,
        });
        return;
      }

      if (name.trim().length > 150) {
        validationErrors.push({
          row: rowNum,
          error: 'Attendee name exceeds maximum length of 150 characters',
          raw: row,
        });
        return;
      }

      // Email format validation if provided
      if (email && email.trim()) {
        const cleanEmail = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          validationErrors.push({
            row: rowNum,
            error: `Invalid email address format: "${cleanEmail}"`,
            raw: row,
          });
          return;
        }
      }

      validRecords.push({
        rowNumber: rowNum,
        name: name.trim(),
        email: email?.trim().toLowerCase() || undefined,
        phone: phone?.trim() || undefined,
        category: category?.trim() || 'PARTICIPANT',
        organization: organization?.trim() || undefined,
      });
    });

    return {
      totalRows: rawRows.length,
      validCount: validRecords.length,
      invalidCount: validationErrors.length,
      detectedHeaders,
      rawHeaders,
      sampleRows: validRecords.slice(0, 5),
      validationErrors: validationErrors.slice(0, 20),
      allValidRecords: validRecords,
    };
  }

  /**
   * Intelligently map arbitrary column headers to standard attendee attributes.
   */
  private detectHeaderMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const claimedHeaders = new Set<string>();

    // Pass 1: Exact matches (normalized comparison)
    for (const [key, synonyms] of Object.entries(this.SYNONYM_MAP)) {
      if (mapping[key]) continue;
      for (const header of headers) {
        if (claimedHeaders.has(header)) continue;
        const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const syn of synonyms) {
          const synNorm = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalized === synNorm) {
            mapping[key] = header;
            claimedHeaders.add(header);
            break;
          }
        }
        if (mapping[key]) break;
      }
    }

    // Pass 2: Substring matches for remaining unmapped fields
    for (const [key, synonyms] of Object.entries(this.SYNONYM_MAP)) {
      if (mapping[key]) continue;
      for (const header of headers) {
        if (claimedHeaders.has(header)) continue;
        const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const syn of synonyms) {
          const synNorm = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (key === 'phone' && normalized.includes('email')) continue;
          if (normalized.includes(synNorm)) {
            mapping[key] = header;
            claimedHeaders.add(header);
            break;
          }
        }
        if (mapping[key]) break;
      }
    }

    return mapping;
  }

  private extractFieldValue(row: Record<string, any>, headerKey?: string): string | undefined {
    if (!headerKey || row[headerKey] === undefined) return undefined;
    const val = String(row[headerKey]).trim();
    return val === '' ? undefined : val;
  }
}

export const eventImportParserService = new EventImportParserService();
