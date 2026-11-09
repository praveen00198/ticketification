import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { StorageError } from '../src/middlewares/error.middleware';

describe('CHALLENGER M3: Supabase Storage Pre-Check & Asset Reuse Stress Suite', () => {
  let service: SupabaseStorageService;

  beforeEach(() => {
    service = new SupabaseStorageService();
  });

  describe('Adversarial Challenge 1: Path Standardization & Normalization Robustness', () => {
    it('CH-1.1: normalizeStoragePath handles various adversarial URL prefixes and malformed strings', () => {
      // 1. Raw relative path with leading/trailing spaces and slashes
      expect(service.normalizeStoragePath('  /events/evt_1/credentials/cred_1.png/  ')).toBe(
        'events/evt_1/credentials/cred_1.png'
      );

      // 2. Full public CDN URL
      const cdnUrl =
        'https://myproject.supabase.co/storage/v1/object/public/ticket-images/events/evt_2/credentials/cred_2.png';
      expect(service.normalizeStoragePath(cdnUrl)).toBe('events/evt_2/credentials/cred_2.png');

      // 3. Full signed URL with query parameters
      const signedUrl =
        'https://myproject.supabase.co/storage/v1/object/sign/ticket-images/events/evt_3/credentials/cred_3.png?token=secret123&exp=999';
      expect(service.normalizeStoragePath(signedUrl)).toBe('events/evt_3/credentials/cred_3.png');

      // 4. Redundant bucket prefix
      expect(service.normalizeStoragePath('ticket-images/events/evt_4/credentials/cred_4.png')).toBe(
        'events/evt_4/credentials/cred_4.png'
      );

      // 5. Empty or null-ish string
      expect(service.normalizeStoragePath('')).toBe('');
      expect(service.normalizeStoragePath(null as any)).toBe('');
    });

    it('CH-1.2: buildCredentialStoragePath and parseCredentialStoragePath maintain strict round-trip fidelity', () => {
      const eventId = '6af1e4ba6f5cac74a959431b';
      const credentialId = '5bf2e4ba6f5cac74a959432c';

      const path1 = service.buildCredentialStoragePath(eventId, credentialId);
      expect(path1).toBe(`events/${eventId}/credentials/${credentialId}.png`);

      // Handles input where credentialId already contains .png
      const path2 = service.buildCredentialStoragePath(eventId, `${credentialId}.png`);
      expect(path2).toBe(`events/${eventId}/credentials/${credentialId}.png`);

      // Parses back to original IDs
      const parsed = service.parseCredentialStoragePath(path1);
      expect(parsed).toEqual({
        eventId,
        credentialId,
      });

      // Case-insensitivity on extension
      const parsedUpper = service.parseCredentialStoragePath(`events/${eventId}/credentials/${credentialId}.PNG`);
      expect(parsedUpper).toEqual({
        eventId,
        credentialId,
      });

      // Malformed path returns null
      expect(service.parseCredentialStoragePath('invalid/path/to/cred.png')).toBeNull();
      expect(service.parseCredentialStoragePath('events/e1/wrong_sub/c1.png')).toBeNull();
    });
  });

  describe('Adversarial Challenge 2: Non-Downloading Pre-Check (checkObjectExists)', () => {
    it('CH-2.1: checkObjectExists uses native SDK exists() without downloading body', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({ data: true, error: null }),
        download: jest.fn(), // MUST NOT BE CALLED
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();
      const exists = await testService.checkObjectExists('events/evt_1/credentials/cred_1.png');

      expect(exists).toBe(true);
      expect(mockStorage.exists).toHaveBeenCalledWith('events/evt_1/credentials/cred_1.png');
      expect(mockStorage.download).not.toHaveBeenCalled();

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('CH-2.2: checkObjectExists returns false cleanly on 404/not found errors', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({
          data: false,
          error: { message: 'Object not found', status: 404 },
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();
      const exists = await testService.checkObjectExists('events/evt_1/credentials/nonexistent.png');

      expect(exists).toBe(false);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('CH-2.3: checkObjectExists throws StorageError on HTTP 500 server error to prevent silent corruption', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        exists: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Internal Server Error', status: 500 },
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();

      await expect(
        testService.checkObjectExists('events/evt_1/credentials/error.png')
      ).rejects.toThrow(StorageError);

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('CH-2.4: checkObjectExists falls back to listFolder when SDK exists() and info() are unavailable', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        list: jest.fn().mockResolvedValue({
          data: [
            { name: 'other.png', id: '1', metadata: { size: 100 } },
            { name: 'target.png', id: '2', metadata: { size: 500 } },
          ],
          error: null,
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();
      const exists = await testService.checkObjectExists('events/evt_1/credentials/target.png');

      expect(exists).toBe(true);
      expect(mockStorage.list).toHaveBeenCalledWith('events/evt_1/credentials', expect.anything());

      (storageModule as any).supabaseAdmin = originalAdmin;
    });
  });

  describe('Adversarial Challenge 3: Metadata Retrieval Without Body Download (getObjectMetadata)', () => {
    it('CH-3.1: getObjectMetadata returns clean metadata object and publicUrl via info() without downloading', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        info: jest.fn().mockResolvedValue({
          data: {
            name: 'cred_100.png',
            id: 'asset-id-123',
            size: 45000,
            mimetype: 'image/png',
            createdAt: '2026-11-09T12:00:00Z',
            etag: 'etag-xyz',
          },
          error: null,
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://cdn.supabase.co/events/evt_1/credentials/cred_100.png' },
        }),
        download: jest.fn(),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();
      const meta = await testService.getObjectMetadata('events/evt_1/credentials/cred_100.png');

      expect(meta).not.toBeNull();
      expect(meta?.name).toBe('cred_100.png');
      expect(meta?.sizeBytes).toBe(45000);
      expect(meta?.publicUrl).toBe('https://cdn.supabase.co/events/evt_1/credentials/cred_100.png');
      expect(mockStorage.download).not.toHaveBeenCalled();

      (storageModule as any).supabaseAdmin = originalAdmin;
    });

    it('CH-3.2: getObjectMetadata returns null when object does not exist (404)', async () => {
      const mockStorage = {
        getBucket: jest.fn().mockResolvedValue({ data: { name: 'ticket-images' }, error: null }),
        info: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'The resource was not found', status: 404 },
        }),
      };

      const storageModule = require('../src/config/supabase');
      const originalAdmin = storageModule.supabaseAdmin;
      (storageModule as any).supabaseAdmin = {
        storage: {
          from: () => mockStorage,
          getBucket: mockStorage.getBucket,
        },
      };

      const testService = new SupabaseStorageService();
      const meta = await testService.getObjectMetadata('events/evt_1/credentials/missing.png');

      expect(meta).toBeNull();

      (storageModule as any).supabaseAdmin = originalAdmin;
    });
  });
});
