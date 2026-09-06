import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { guestImportService, normalizePhoneNumber, isValidE164 } from '../src/modules/guests/services/guest-import.service';

describe('GuestImportService - Phone Normalization & Validation', () => {
  const tempFilePath = path.resolve(__dirname, 'temp_test_guests.xlsx');

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });

  it('should normalize Indian and international phone numbers into E.164 format', () => {
    expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('+919876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('+1-555-123-4567')).toBe('+15551234567');
    expect(normalizePhoneNumber('12345')).toBeNull();
  });

  it('should validate E.164 format correctly', () => {
    expect(isValidE164('+919876543210')).toBe(true);
    expect(isValidE164('+15551234567')).toBe(true);
    expect(isValidE164('9876543210')).toBe(false);
  });

  it('should correctly parse valid rows and detect invalid missing phone / name / duplicate records', () => {
    const data = [
      { Name: 'Rahul Sharma', Phone: '9876543210', Email: 'rahul@example.com', Event: 'Eventify 2026', 'Ticket Type': 'VIP' },
      { Name: '', Phone: '9876543211', Email: 'missingname@example.com', Event: 'Eventify 2026' },
      { Name: 'Priya Verma', Phone: '', Email: 'priya@example.com', Event: 'Eventify 2026' },
      { Name: 'Invalid Phone Guest', Phone: '12345', Email: 'invalid@example.com', Event: 'Eventify 2026' },
      { Name: 'Duplicate Phone Guest', Phone: '+919876543210', Email: 'duplicate@example.com', Event: 'Eventify 2026' },
    ];

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Guests');
    xlsx.writeFile(workbook, tempFilePath);

    const summary = guestImportService.parseAndValidateExcel(tempFilePath);

    expect(summary.totalRecords).toBe(5);
    expect(summary.validRecordsCount).toBe(2); // Rahul Sharma (with phone) & Priya Verma (optional phone)
    expect(summary.invalidRecordsCount).toBe(3);
    expect(summary.validRows[0].data.name).toBe('Rahul Sharma');
    expect(summary.validRows[0].data.phone).toBe('+919876543210');
    expect(summary.validRows[1].data.name).toBe('Priya Verma');
    expect(summary.validRows[1].data.phone).toBeUndefined();

    // Diagnostic error checks
    expect(summary.errors.some((e) => e.field === 'Name')).toBe(true);
    expect(summary.errors.some((e) => e.problem.includes('Invalid phone number'))).toBe(true);
    expect(summary.errors.some((e) => e.problem.includes('Duplicate phone'))).toBe(true);
  });
});
