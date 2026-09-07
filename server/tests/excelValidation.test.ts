import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { GuestImportService } from '../src/modules/guests/services/guest-import.service';

describe('GuestImportService - Header Detection & Validation Pipeline', () => {
  const tempFilePath = path.resolve(__dirname, 'temp_test_guests.xlsx');

  afterEach(() => {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  });

  it('should analyze file headers and detect column mappings automatically', async () => {
    const data = [
      { 'Full Name': 'Rahul Sharma', 'Mobile Number': '9876543210', 'Email Address': 'rahul@example.com', 'Ticket Type': 'VIP' },
      { 'Full Name': 'Priya Verma', 'Mobile Number': '9876543211', 'Email Address': 'priya@example.com', 'Ticket Type': 'GENERAL' },
    ];

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Guests');
    xlsx.writeFile(workbook, tempFilePath);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Demo Event' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
      findById: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
      update: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
    };

    const service = new GuestImportService(
      {} as any,
      mockImportRepo,
      mockEventRepo,
      {} as any
    );

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempFilePath, 'guests.xlsx');

    expect(analysis.rowCount).toBe(2);
    expect(analysis.headers).toContain('Full Name');
    expect(analysis.headers).toContain('Mobile Number');
    expect(analysis.headers).toContain('Email Address');
    expect(analysis.headers).toContain('Ticket Type');

    // Confirmed detections
    expect(analysis.detectedMappings['Full Name']).toBe('name');
    expect(analysis.detectedMappings['Mobile Number']).toBe('phone');
    expect(analysis.detectedMappings['Email Address']).toBe('email');
    expect(analysis.detectedMappings['Ticket Type']).toBe('category');
    expect(analysis.detectedCategories).toContain('VIP');
    expect(analysis.detectedCategories).toContain('GENERAL');
  });

  it('should validate rows: catch missing required fields and warn on duplicate emails', async () => {
    const data = [
      { 'Full Name': 'Rahul Sharma', 'Mobile': '9876543210', 'Email': 'rahul@example.com' },
      { 'Full Name': '', 'Mobile': '9876543211', 'Email': 'missingname@example.com' }, // Invalid (no name)
      { 'Full Name': 'Rahul Duplicate', 'Mobile': '9876543212', 'Email': 'rahul@example.com' }, // Duplicate email warning
    ];

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Guests');
    xlsx.writeFile(workbook, tempFilePath);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Demo Event' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
      findById: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
      update: jest.fn().mockResolvedValue({ id: 'import_123', eventId: 'evt_1' }),
    };

    const service = new GuestImportService(
      {} as any,
      mockImportRepo,
      mockEventRepo,
      {} as any
    );

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempFilePath, 'guests.xlsx');

    const validation = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: {
        'Full Name': 'name',
        'Mobile': 'phone',
        'Email': 'email',
      },
      requiredFields: ['name'],
      categoryMapping: {},
      defaultCategory: 'GENERAL',
    });

    expect(validation.totalRows).toBe(3);
    expect(validation.validRowsCount).toBe(2);
    expect(validation.invalidRowsCount).toBe(1);
    expect(validation.duplicateRowsCount).toBe(1);
    expect(validation.errors.some((e: any) => e.field === 'name' && e.severity === 'ERROR')).toBe(true);
    expect(validation.errors.some((e: any) => e.field === 'email' && e.severity === 'WARNING')).toBe(true);
  });
});
