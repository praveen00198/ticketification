import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { GuestImportService } from '../src/modules/guests/services/guest-import.service';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '../src/middlewares/error.middleware';

describe('Phase 3: Excel Import Workflow & Mapping Engine', () => {
  const tempDir = path.resolve(__dirname, '../uploads');
  const tempUploadFile = path.resolve(tempDir, 'temp_raw_upload.xlsx');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up any test files in upload dir
    if (fs.existsSync(tempUploadFile)) {
      try {
        fs.unlinkSync(tempUploadFile);
      } catch {}
    }
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      if (file.startsWith('staging-test_')) {
        try {
          fs.unlinkSync(path.join(tempDir, file));
        } catch {}
      }
    }
  });

  function createTestWorkbook(data: Record<string, any>[], filePath: string) {
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Attendees');
    xlsx.writeFile(workbook, filePath);
  }

  it('1. should dynamically detect headers and score confidence across synonyms', async () => {
    const data = [
      {
        'Attendee Name': 'Aman Gupta',
        'Mobile Number': '9876543210',
        'Contact Email': 'aman@example.com',
        'Pass Category': 'VIP',
        'Number of Tickets': 2,
        'Organization Name': 'Google DeepMind',
        'Job Title': 'Staff Engineer',
      },
    ];

    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Tech Summit' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockImplementation((payload) => Promise.resolve({ id: 'test_imp_1', ...payload })),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'attendees.xlsx');

    expect(analysis.importId).toBe('test_imp_1');
    expect(analysis.rowCount).toBe(1);
    expect(analysis.detectedMappings['Attendee Name']).toBe('name');
    expect(analysis.detectedMappings['Mobile Number']).toBe('phone');
    expect(analysis.detectedMappings['Contact Email']).toBe('email');
    expect(analysis.detectedMappings['Pass Category']).toBe('category');
    expect(analysis.detectedMappings['Number of Tickets']).toBe('count');
    expect(analysis.detectedMappings['Organization Name']).toBe('organization');
    expect(analysis.detectedMappings['Job Title']).toBe('designation');
    expect(analysis.detectedCategories).toContain('VIP');
  });

  it('2. should treat email and phone as strictly optional by default (FR-IMP-3)', async () => {
    const data = [
      { 'Full Name': 'Guest One', 'Category': 'GENERAL' }, // Phone & email completely omitted
      { 'Full Name': 'Guest Two', 'Category': 'VIP', 'Phone': '', 'Email': '' }, // Empty strings
    ];

    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Annual Gala' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_optional', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_optional',
        eventId: 'evt_1',
        status: 'ANALYZING',
      }),
      update: jest.fn().mockResolvedValue({ id: 'test_imp_optional', eventId: 'evt_1' }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'guests.xlsx');

    const validation = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: {
        'Full Name': 'name',
        'Category': 'category',
      },
      // requiredFields left empty to verify default is strictly ['name']
    });

    expect(validation.totalRows).toBe(2);
    expect(validation.validRowsCount).toBe(2);
    expect(validation.invalidRowsCount).toBe(0);
    expect(validation.errors.filter((e) => e.severity === 'ERROR')).toHaveLength(0);
  });

  it('3. should invalidate row when required field (e.g. name) is missing', async () => {
    const data = [
      { 'Full Name': 'Valid Guest', 'Category': 'GENERAL' },
      { 'Full Name': '', 'Category': 'GENERAL' }, // Missing name
      { 'Full Name': '   ', 'Category': 'VIP' }, // Whitespace only
    ];

    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Annual Gala' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_missing_name', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_missing_name',
        eventId: 'evt_1',
        status: 'ANALYZING',
      }),
      update: jest.fn().mockResolvedValue({ id: 'test_imp_missing_name', eventId: 'evt_1' }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'guests.xlsx');

    const validation = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: {
        'Full Name': 'name',
        'Category': 'category',
      },
      requiredFields: ['name'],
    });

    expect(validation.totalRows).toBe(3);
    expect(validation.validRowsCount).toBe(1);
    expect(validation.invalidRowsCount).toBe(2);
    const errors = validation.errors.filter((e) => e.field === 'name' && e.severity === 'ERROR');
    expect(errors).toHaveLength(2);
    expect(errors[0].rowNumber).toBe(3); // Excel row 3
    expect(errors[1].rowNumber).toBe(4); // Excel row 4
  });

  it('4. should treat unusual email as WARNING when email is optional, but ERROR when required', async () => {
    const data = [
      { 'Full Name': 'Guest One', 'Email': 'not-a-valid-email' },
    ];

    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Tech Conference' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_email_check', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_email_check',
        eventId: 'evt_1',
        status: 'ANALYZING',
      }),
      update: jest.fn().mockResolvedValue({ id: 'test_imp_email_check', eventId: 'evt_1' }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'guests.xlsx');

    // Scenario A: Email is optional -> WARNING, row remains valid
    const validationOptional = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: { 'Full Name': 'name', 'Email': 'email' },
      requiredFields: ['name'],
    });
    expect(validationOptional.validRowsCount).toBe(1);
    expect(validationOptional.warningRowsCount).toBe(1);
    expect(validationOptional.errors.some((e) => e.field === 'email' && e.severity === 'WARNING')).toBe(true);

    // Scenario B: Email is marked required -> ERROR, row becomes invalid
    const validationRequired = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: { 'Full Name': 'name', 'Email': 'email' },
      requiredFields: ['name', 'email'],
    });
    expect(validationRequired.validRowsCount).toBe(0);
    expect(validationRequired.invalidRowsCount).toBe(1);
    expect(validationRequired.errors.some((e) => e.field === 'email' && e.severity === 'ERROR')).toBe(true);
  });

  it('5. should expand multi-seat rows (count > 1) and skip duplicates on confirm', async () => {
    const data = [
      { 'Full Name': 'Alice Cooper', 'Email': 'alice@example.com', 'Seats': 3, 'Category': 'VIP' },
      { 'Full Name': 'Alice Duplicate', 'Email': 'alice@example.com', 'Seats': 1, 'Category': 'VIP' },
      { 'Full Name': 'Bob Marley', 'Email': 'bob@example.com', 'Seats': 1, 'Category': 'GENERAL' },
    ];

    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Music Festival' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_confirm', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_confirm',
        eventId: 'evt_1',
        status: 'READY',
        columnMapping: {
          'Full Name': 'name',
          'Email': 'email',
          'Seats': 'count',
          'Category': 'category',
        },
        requiredFields: ['name'],
        categoryMapping: {},
      }),
      update: jest.fn().mockResolvedValue({ id: 'test_imp_confirm', eventId: 'evt_1' }),
    };

    let insertedRecords: any[] = [];
    const mockGuestRepo: any = {
      insertMany: jest.fn().mockImplementation((records) => {
        insertedRecords = records;
        return Promise.resolve(records);
      }),
    };

    const service = new GuestImportService(mockGuestRepo, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'guests.xlsx');

    const result = await service.confirmImport('evt_1', 'user_1', {
      importId: analysis.importId,
      skipDuplicates: true, // Should skip row 2 because alice@example.com was seen
    });

    expect(result.success).toBe(true);
    expect(result.skippedCount).toBe(1); // Row 2 duplicate skipped
    // Row 1 created 3 tickets, Row 3 created 1 ticket -> Total 4
    expect(insertedRecords).toHaveLength(4);
    expect(insertedRecords[0].name).toBe('Alice Cooper');
    expect(insertedRecords[1].name).toBe('Alice Cooper (Guest 2)');
    expect(insertedRecords[2].name).toBe('Alice Cooper (Guest 3)');
    expect(insertedRecords[3].name).toBe('Bob Marley');
  });

  it('6. should enforce zero-trust event scoping and block unauthorized / IDOR access', async () => {
    const data = [{ 'Full Name': 'Target Guest' }];
    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      // Event owned by User 1
      findByIdAndOwner: jest.fn().mockImplementation((eventId, userId) => {
        if (eventId === 'evt_1' && userId === 'user_1') return Promise.resolve({ id: 'evt_1', createdBy: 'user_1' });
        return Promise.resolve(null);
      }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_idor', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockImplementation((importId, eventId) => {
        if (importId === 'test_imp_idor' && eventId === 'evt_1') {
          return Promise.resolve({ id: 'test_imp_idor', eventId: 'evt_1', status: 'READY' });
        }
        return Promise.resolve(null);
      }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'guests.xlsx');

    // Unauthorized User 2 tries to validate User 1's event
    await expect(
      service.validateImport('evt_1', 'user_2', {
        importId: 'test_imp_idor',
        columnMapping: { 'Full Name': 'name' },
      })
    ).rejects.toThrow(NotFoundError);

    // User 1 tries to validate using mismatched eventId (evt_2)
    await expect(
      service.validateImport('evt_2', 'user_1', {
        importId: 'test_imp_idor',
        columnMapping: { 'Full Name': 'name' },
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('7. should prevent double confirmation with 409 Conflict', async () => {
    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Event' }),
    };
    const mockImportRepo: any = {
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_done',
        eventId: 'evt_1',
        status: 'COMPLETED', // Already completed
      }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    await expect(
      service.confirmImport('evt_1', 'user_1', {
        importId: 'test_imp_done',
      })
    ).rejects.toThrow(ConflictError);
  });

  it('8. should recover and validate from persistent disk staging even after memory cache is cleared', async () => {
    const data = [{ 'Full Name': 'Persisted Guest', 'Ticket Type': 'VIP' }];
    createTestWorkbook(data, tempUploadFile);

    const mockEventRepo: any = {
      findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Persistent Event' }),
    };
    const mockImportRepo: any = {
      create: jest.fn().mockResolvedValue({ id: 'test_imp_restart', eventId: 'evt_1' }),
      findByIdAndEventId: jest.fn().mockResolvedValue({
        id: 'test_imp_restart',
        eventId: 'evt_1',
        status: 'ANALYZING',
      }),
      update: jest.fn().mockResolvedValue({ id: 'test_imp_restart', eventId: 'evt_1' }),
    };

    const service = new GuestImportService({} as any, mockImportRepo, mockEventRepo, {} as any);

    const analysis = await service.uploadAndAnalyze('evt_1', 'user_1', tempUploadFile, 'persistent.xlsx');

    // Simulate server reboot by wiping internal in-memory map
    (service as any).activeUploads.clear();
    expect((service as any).activeUploads.size).toBe(0);

    // Validate import: should seamlessly reload from staging file on disk!
    const validation = await service.validateImport('evt_1', 'user_1', {
      importId: analysis.importId,
      columnMapping: {
        'Full Name': 'name',
        'Ticket Type': 'category',
      },
    });

    expect(validation.validRowsCount).toBe(1);
    expect(validation.sampleValidRows[0].name).toBe('Persisted Guest');
  });
});
