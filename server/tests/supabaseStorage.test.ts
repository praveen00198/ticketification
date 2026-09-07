import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { StorageError } from '../src/middlewares/error.middleware';
import fs from 'fs';
import path from 'path';

describe('Phase 5: Supabase Storage Integration', () => {
  let service: SupabaseStorageService;

  beforeEach(() => {
    service = new SupabaseStorageService();
  });

  describe('Canonical Path Hierarchy', () => {
    it('should build canonical ticket storage paths: events/{eventId}/tickets/{filename}', () => {
      const path1 = service.buildTicketStoragePath('evt_123', 'ticket-GAN-00001.png');
      expect(path1).toBe('events/evt_123/tickets/ticket-GAN-00001.png');

      const path2 = service.buildTicketStoragePath('/evt_456/', '/WRK-00042.png');
      expect(path2).toBe('events/evt_456/tickets/WRK-00042.png');
    });

    it('should parse canonical ticket storage paths correctly', () => {
      const parsed = service.parseTicketStoragePath('events/evt_789/tickets/ticket-GAN-00099.png');
      expect(parsed).toEqual({
        eventId: 'evt_789',
        filename: 'ticket-GAN-00099.png',
      });
    });

    it('should return null for malformed or non-ticket storage paths', () => {
      expect(service.parseTicketStoragePath('other/path/file.png')).toBeNull();
      expect(service.parseTicketStoragePath('events/evt_123/wrong/file.png')).toBeNull();
      expect(service.parseTicketStoragePath('')).toBeNull();
    });
  });

  describe('Zero Silent Fallback & Upload Engine', () => {
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);

    it('should throw StorageError when Supabase is not configured and NEVER write to local disk', async () => {
      // Mock supabaseAdmin as null to simulate missing credentials
      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = null;

      const unconfiguredService = new SupabaseStorageService();

      const localUploadDir = path.resolve(__dirname, '../uploads');
      const filesBefore = fs.existsSync(localUploadDir) ? fs.readdirSync(localUploadDir) : [];

      await expect(
        unconfiguredService.uploadTicketImage('events/evt_1/tickets/test.png', validPngBuffer, 'image/png')
      ).rejects.toThrow(StorageError);

      // Verify ZERO local files were written as a silent fallback
      const filesAfter = fs.existsSync(localUploadDir) ? fs.readdirSync(localUploadDir) : [];
      expect(filesAfter.length).toBe(filesBefore.length);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('should retry on transient network errors and succeed on subsequent attempt', async () => {
      let attempts = 0;
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        createBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
        upload: jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts === 1) {
            return Promise.resolve({ data: null, error: { message: 'Connection reset by peer' } });
          }
          return Promise.resolve({ data: { path: 'events/evt_1/tickets/retry.png' }, error: null });
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://cdn.supabase.co/events/evt_1/tickets/retry.png' },
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          getBucket: mockStorage.getBucket,
          createBucket: mockStorage.createBucket,
          from: () => mockStorage,
        },
      };

      const testService = new SupabaseStorageService();
      const result = await testService.uploadTicketImage(
        'events/evt_1/tickets/retry.png',
        validPngBuffer,
        'image/png'
      );

      expect(attempts).toBe(2); // First failed, second succeeded
      expect(result.publicUrl).toBe('https://cdn.supabase.co/events/evt_1/tickets/retry.png');
      expect(result.storagePath).toBe('events/evt_1/tickets/retry.png');

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('should throw StorageError when all retry attempts fail permanently', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: '503 Service Unavailable' },
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          getBucket: mockStorage.getBucket,
          createBucket: jest.fn().mockResolvedValue({ data: null, error: null }),
          from: () => mockStorage,
        },
      };

      const testService = new SupabaseStorageService();

      await expect(
        testService.uploadTicketImage('events/evt_1/tickets/fail.png', validPngBuffer, 'image/png')
      ).rejects.toThrow(StorageError);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });
  });

  describe('Asset Deletion & Management', () => {
    it('should delete single ticket asset via deleteTicketImage', async () => {
      const mockStorage = {
        remove: jest.fn().mockResolvedValue({ data: [{ name: 'test.png' }], error: null }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
        },
      };

      const testService = new SupabaseStorageService();
      const deleted = await testService.deleteTicketImage('events/evt_1/tickets/test.png');
      expect(deleted).toBe(true);
      expect(mockStorage.remove).toHaveBeenCalledWith(['events/evt_1/tickets/test.png']);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('should batch delete multiple ticket assets via deleteTicketImages', async () => {
      const mockStorage = {
        remove: jest.fn().mockResolvedValue({
          data: [{ name: 't1.png' }, { name: 't2.png' }],
          error: null,
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
        },
      };

      const testService = new SupabaseStorageService();
      const count = await testService.deleteTicketImages([
        'events/evt_1/tickets/t1.png',
        'events/evt_1/tickets/t2.png',
      ]);
      expect(count).toBe(2);
      expect(mockStorage.remove).toHaveBeenCalledWith([
        'events/evt_1/tickets/t1.png',
        'events/evt_1/tickets/t2.png',
      ]);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });
  });

  describe('Download & Path Resolution', () => {
    it('should strip public CDN URL prefixes when downloading ticket image', async () => {
      const mockData = {
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(16)),
      };
      const mockStorage = {
        download: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
        },
      };

      const testService = new SupabaseStorageService();
      const fullCdnUrl =
        'https://myproject.supabase.co/storage/v1/object/public/ticket-images/events/evt_1/tickets/ticket-001.png';

      const buf = await testService.downloadTicketImage(fullCdnUrl);
      expect(buf).toBeInstanceOf(Buffer);
      expect(mockStorage.download).toHaveBeenCalledWith('events/evt_1/tickets/ticket-001.png');

      (storageModule as any).supabaseAdmin = originalAdmin;
    });
  });
});
