import * as xlsx from 'xlsx';
import fs from 'fs';
import { AppError } from '../../../middlewares/error.middleware';

export interface RawGuestRecord {
  name?: string;
  email?: string;
  event?: string;
  eventDate?: string;
  ticketType?: string;
  phone?: string;
  organization?: string;
  designation?: string;
  [key: string]: any;
}

export interface ValidationErrorDetail {
  rowNumber: number;
  field: string;
  problem: string;
  suggestedCorrection?: string;
}

export interface ValidatedGuestRow {
  rowNumber: number;
  data: {
    name: string;
    email?: string;
    event: string;
    eventDate: string;
    ticketType: string;
    phone?: string;
    organization?: string;
    designation?: string;
  };
}

export interface ImportValidationSummary {
  totalRecords: number;
  validRecordsCount: number;
  invalidRecordsCount: number;
  validRows: ValidatedGuestRow[];
  errors: ValidationErrorDetail[];
}

/**
 * Normalize a phone number to E.164 format.
 * Handles common Indian formats and international prefixes.
 * Examples:
 *   "9876543210"    → "+919876543210"
 *   "09876543210"   → "+919876543210"
 *   "+919876543210" → "+919876543210"
 *   "919876543210"  → "+919876543210"
 *   "+1-555-123-4567" → "+15551234567"
 */
export function normalizePhoneNumber(raw: string): string | null {
  // Strip all non-digit characters except leading +
  let cleaned = raw.replace(/[^\d+]/g, '');

  if (!cleaned) return null;

  // If it already starts with +, validate length
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    return null;
  }

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Indian numbers: 10 digits starting with 6-9
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Already has country code (11+ digits)
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Validate that a phone number looks correct in E.164 format.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{9,14}$/.test(phone);
}

export class GuestImportService {
  parseAndValidateExcel(filePath: string): ImportValidationSummary {
    if (!fs.existsSync(filePath)) {
      throw new AppError('Import file not found on server.', 400);
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new AppError('Excel file does not contain any readable sheets.', 400);
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: RawGuestRecord[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      throw new AppError('Excel spreadsheet is empty.', 400);
    }

    const errors: ValidationErrorDetail[] = [];
    const validRows: ValidatedGuestRow[] = [];
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row numbering (1 = Header)
      let isRowValid = true;

      // Extract properties tolerating varying casing in column names
      const nameKey = Object.keys(row).find((k) => k.toLowerCase().includes('name')) || 'name';
      const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes('email')) || 'email';
      const eventKey = Object.keys(row).find((k) => k.toLowerCase().includes('event')) || 'event';
      const dateKey = Object.keys(row).find((k) => k.toLowerCase().includes('date')) || 'eventDate';
      const typeKey = Object.keys(row).find((k) => k.toLowerCase().includes('type') || k.toLowerCase().includes('ticket')) || 'ticketType';
      const phoneKey = Object.keys(row).find((k) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('whatsapp')) || 'phone';
      const orgKey = Object.keys(row).find((k) => k.toLowerCase().includes('org') || k.toLowerCase().includes('company')) || 'organization';
      const desigKey = Object.keys(row).find((k) => k.toLowerCase().includes('designation') || k.toLowerCase().includes('title')) || 'designation';

      const name = String(row[nameKey] || '').trim();
      const email = String(row[emailKey] || '').trim().toLowerCase();
      const event = String(row[eventKey] || 'Ticketification 2026').trim();
      const eventDate = String(row[dateKey] || '2026-08-25').trim();
      const ticketType = String(row[typeKey] || 'VIP Pass').trim();
      const rawPhone = String(row[phoneKey] || '').trim();
      const organization = String(row[orgKey] || '').trim();
      const designation = String(row[desigKey] || '').trim();

      // Validation 1: Check empty row
      if (!name && !email && !rawPhone && !organization && !designation) {
        errors.push({
          rowNumber,
          field: 'Row',
          problem: 'Empty row detected.',
          suggestedCorrection: 'Remove empty row from Excel file.',
        });
        return;
      }

      // Validation 2: Name must exist
      if (!name) {
        errors.push({
          rowNumber,
          field: 'Name',
          problem: 'Guest name is missing.',
          suggestedCorrection: 'Provide a valid full name.',
        });
        isRowValid = false;
      }

      // Validation 3: Phone number is completely optional (never invalidates or rejects an entry)
      let normalizedPhone: string | undefined;
      if (rawPhone) {
        normalizedPhone = normalizePhoneNumber(rawPhone) || rawPhone;
      }

      // Validation 4: Email (optional but validate format if present)
      if (email && !emailRegex.test(email)) {
        errors.push({
          rowNumber,
          field: 'Email',
          problem: `Invalid email format '${email}'.`,
          suggestedCorrection: 'Check email for missing @ or domain typo.',
        });
        isRowValid = false;
      } else if (email && seenEmails.has(email)) {
        errors.push({
          rowNumber,
          field: 'Email',
          problem: `Duplicate email '${email}' found in row ${rowNumber}.`,
          suggestedCorrection: 'Remove duplicate record or use distinct email.',
        });
        isRowValid = false;
      }

      if (isRowValid) {
        if (email) seenEmails.add(email);
        if (normalizedPhone) seenPhones.add(normalizedPhone);
        validRows.push({
          rowNumber,
          data: {
            name,
            email: email || undefined,
            event,
            eventDate,
            ticketType,
            phone: normalizedPhone,
            organization: organization || undefined,
            designation: designation || undefined,
          },
        });
      }
    });

    return {
      totalRecords: rawRows.length,
      validRecordsCount: validRows.length,
      invalidRecordsCount: errors.length,
      validRows,
      errors,
    };
  }
}

export const guestImportService = new GuestImportService();
