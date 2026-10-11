import request from 'supertest';
import mongoose from 'mongoose';
import sharp from 'sharp';
import app from '../src/app';
import {
  EventCredentialRenderingService,
  eventCredentialRenderingService,
} from '../src/modules/events/services/event-credential-rendering.service';
import {
  MemoryBudgetGovernor,
  memoryBudgetGovernor,
} from '../src/utils/memory-budget-governor';
import {
  EventStorageGovernanceService,
  eventStorageGovernanceService,
} from '../src/modules/events/services/event-storage-governance.service';
import { SupabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { EventJobModel } from '../src/db/mongo/models/event-job.model';

// Mock auth middleware for RBAC testing
jest.mock('../src/middlewares/auth.middleware', () => {
  const handler = (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.includes('host-token')) {
      req.user = { id: 'host-user-id', role: 'USER' };
    } else if (authHeader.includes('volunteer-token')) {
      req.user = { id: 'volunteer-user-id', role: 'USER' };
    } else if (authHeader.includes('unauthorized-token')) {
      req.user = { id: 'unauthorized-user-id', role: 'USER' };
    } else {
      req.user = { id: 'host-user-id', role: 'USER' };
    }
    next();
  };
  return {
    authMiddleware: handler,
    authenticateUser: handler,
    default: handler,
  };
});

describe('Phase 17: Storage & Performance Optimization Engine', () => {
  const eventId = new mongoose.Types.ObjectId().toString();
  const hostUserId = 'host-user-id';
  const volunteerUserId = 'volunteer-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Native Sharp Bounding & Render 512MB RAM Configuration', () => {
    it('should enforce disabled libvips caching and thread concurrency of 1', () => {
      const cacheConfig = sharp.cache();
      expect(cacheConfig.memory.max).toBe(0);
      expect(sharp.concurrency()).toBe(1);
    });

    it('should correctly evaluate memory status via MemoryBudgetGovernor', () => {
      const governor = new MemoryBudgetGovernor(400);
      const status = governor.getStatus();

      expect(status.rssMb).toBeGreaterThan(0);
      expect(status.thresholdMb).toBe(400);
      expect(status.headroomMb).toBeGreaterThanOrEqual(0);
      expect(['OPTIMAL', 'ELEVATED', 'CRITICAL']).toContain(status.status);
    });

    it('should handle garbage collection triggers and yield safely', async () => {
      const gcResult = memoryBudgetGovernor.triggerGarbageCollection();
      expect(typeof gcResult).toBe('boolean');

      // Verify non-blocking yield execution
      await expect(memoryBudgetGovernor.yieldIfConstrained(10)).resolves.toBeUndefined();
    });
  });

  describe('2. Deterministic Devanagari Font Embedding & Text Shaping', () => {
    it('should locate and load bundled NotoSansDevanagari-Bold.ttf as base64', () => {
      const fontBase64 = eventCredentialRenderingService.getFontBase64();
      expect(fontBase64).toBeDefined();
      expect(typeof fontBase64).toBe('string');
      expect(fontBase64!.length).toBeGreaterThan(1000);
    });

    it('should embed @font-face and render genuine PNG passes with complex Hindi text and conjuncts', async () => {
      const mockTemplate: any = {
        dimensions: { width: 1620, height: 2025 },
        fields: [
          {
            key: 'name',
            x: 810,
            y: 800,
            fontSize: 60,
            fontFamily: 'Noto Sans Devanagari',
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'center',
            visible: true,
          },
          {
            key: 'role',
            x: 810,
            y: 920,
            fontSize: 32,
            fontFamily: 'Noto Sans Devanagari',
            fontWeight: 'bold',
            color: '#10B981',
            textAlign: 'center',
            visible: true,
          },
          {
            key: 'qr',
            x: 620,
            y: 1100,
            width: 380,
            visible: true,
          },
        ],
      };

      const devanagariPayload = {
        name: '|| श्री गणेशाय नमः || - डॉ. राजेश शर्मा',
        role: 'विशिष्ट अतिथि',
        eventName: 'राष्ट्रीय प्रौद्योगिकी सम्मेलन २०२६',
        sequence: 'PASS-DEV-001',
        verificationToken: 'c7a31f9b4e820d65a192837465abcdeffedcba5674839201a5b6c7d8e9f01234',
      };

      const pngBuffer = await eventCredentialRenderingService.renderCredentialBuffer(
        mockTemplate,
        devanagariPayload
      );

      expect(pngBuffer).toBeDefined();
      expect(eventCredentialRenderingService.isPngBuffer(pngBuffer)).toBe(true);

      // Verify PNG dimensions using Sharp metadata
      const metadata = await sharp(pngBuffer).metadata();
      expect(metadata.width).toBe(1620);
      expect(metadata.height).toBe(2025);
      expect(metadata.format).toBe('png');
    }, 20000);
  });

  describe('3. Storage Quota Governance & Telemetry Engine', () => {
    let mockStorageService: jest.Mocked<SupabaseStorageService>;
    let governanceService: EventStorageGovernanceService;

    beforeEach(() => {
      mockStorageService = {
        isConfigured: jest.fn().mockReturnValue(true),
        listFolder: jest.fn(),
        deleteFiles: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      } as any;

      governanceService = new EventStorageGovernanceService(mockStorageService);
    });

    it('should aggregate storage usage across credentials, exports, and templates', async () => {
      // Mock folders
      mockStorageService.listFolder.mockImplementation(async (folder: string) => {
        if (folder.includes('tickets')) {
          return [{ name: 'pass1.png', sizeBytes: 500 * 1024, createdAt: '2026-10-10T10:00:00Z', storagePath: 'events/123/tickets/pass1.png' }];
        }
        if (folder.includes('credentials')) {
          return [{ name: 'pass2.png', sizeBytes: 500 * 1024, createdAt: '2026-10-10T10:00:00Z', storagePath: 'events/123/credentials/pass2.png' }];
        }
        if (folder.includes('exports')) {
          return [
            { name: 'passes.zip', sizeBytes: 10 * 1024 * 1024, createdAt: '2026-10-10T09:00:00Z', storagePath: 'events/123/exports/passes.zip' },
            { name: 'roster.xlsx', sizeBytes: 2 * 1024 * 1024, createdAt: '2026-10-08T09:00:00Z', storagePath: 'events/123/exports/roster.xlsx' },
          ];
        }
        if (folder.includes('templates')) {
          return [{ name: 'bg.png', sizeBytes: 1 * 1024 * 1024, createdAt: '2026-10-09T09:00:00Z', storagePath: 'events/123/templates/bg.png' }];
        }
        return [];
      });

      const metrics = await governanceService.getEventStorageMetrics(eventId);

      expect(metrics.eventId).toBe(eventId);
      expect(metrics.breakdown.credentials.count).toBe(2);
      expect(metrics.breakdown.credentials.bytes).toBe(1000 * 1024);
      expect(metrics.breakdown.exports.count).toBe(2);
      expect(metrics.breakdown.exports.bytes).toBe(12 * 1024 * 1024);
      expect(metrics.breakdown.templates.count).toBe(1);
      expect(metrics.totalBytes).toBe(1000 * 1024 + 12 * 1024 * 1024 + 1024 * 1024);
      expect(metrics.usedPercentage).toBeGreaterThan(0);
      expect(metrics.isQuotaExceeded).toBe(false);
      expect(metrics.recentExports.length).toBe(2);
    });

    it('should delete stale export files older than 24 hours to reclaim quota', async () => {
      const now = Date.now();
      const freshDate = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours old
      const staleDate = new Date(now - 48 * 60 * 60 * 1000).toISOString(); // 48 hours old

      mockStorageService.listFolder.mockResolvedValue([
        { name: 'fresh-export.zip', sizeBytes: 5 * 1024 * 1024, createdAt: freshDate, storagePath: 'events/123/exports/fresh-export.zip' },
        { name: 'stale-export.zip', sizeBytes: 15 * 1024 * 1024, createdAt: staleDate, storagePath: 'events/123/exports/stale-export.zip' },
      ]);

      jest.spyOn(EventJobModel, 'updateMany').mockResolvedValue({ modifiedCount: 1 } as any);

      const cleanup = await governanceService.cleanupStaleExports(eventId, 24);

      expect(mockStorageService.deleteFiles).toHaveBeenCalledWith([
        'events/123/exports/stale-export.zip',
      ]);
      expect(cleanup.deletedCount).toBe(2); // Mocked deleteCount
      expect(cleanup.reclaimedBytes).toBe(15 * 1024 * 1024);
    });

    it('should enforce storage allowance and reject operations exceeding quota', async () => {
      jest.spyOn(governanceService, 'getEventStorageMetrics').mockResolvedValue({
        eventId,
        totalBytes: 1020 * 1024 * 1024, // 1020 MB used
        totalBytesFormatted: '1020 MB',
        quotaBytes: 1024 * 1024 * 1024, // 1024 MB limit
        quotaBytesFormatted: '1.00 GB',
        usedPercentage: 99.6,
        isNearQuota: true,
        isQuotaExceeded: false,
        breakdown: {} as any,
        recentExports: [],
      });

      // Trying to allocate 10MB when only 4MB is left should reject with AppError(400)
      await expect(
        governanceService.assertStorageAllowance(eventId, 10 * 1024 * 1024)
      ).rejects.toThrow(/Event storage quota limit exceeded/);
    });
  });

  describe('4. Zero-Trust RBAC Storage Endpoints', () => {
    beforeEach(() => {
      jest.spyOn(MongoEventRepository.prototype, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(eventId),
        name: 'Tech Conference 2026',
        ownerId: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'),
        ownerSupabaseId: hostUserId,
      } as any);

      jest.spyOn(MongoUserRepository.prototype, 'findBySupabaseId').mockImplementation(async (id: string) => {
        if (id === hostUserId) {
          return { _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'), email: 'host@test.com' } as any;
        }
        if (id === volunteerUserId) {
          return { _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000002'), email: 'volunteer@test.com' } as any;
        }
        return null;
      });

      jest.spyOn(MongoEventMemberRepository.prototype, 'findByEventAndUser').mockImplementation(async (_eid: any, uid: any) => {
        if (uid.toString() === '60c72b2f9b1d8b2bad000002') {
          return { role: 'VOLUNTEER', status: 'ACTIVE' } as any;
        }
        return null;
      });
    });

    it('GET /api/events/:eventId/storage should return 200 OK for authorized host', async () => {
      jest.spyOn(eventStorageGovernanceService, 'getEventStorageMetrics').mockResolvedValue({
        eventId,
        totalBytes: 2500000,
        totalBytesFormatted: '2.38 MB',
        quotaBytes: 1073741824,
        quotaBytesFormatted: '1.00 GB',
        usedPercentage: 0.23,
        isNearQuota: false,
        isQuotaExceeded: false,
        breakdown: {
          credentials: { count: 5, bytes: 2000000, formatted: '1.91 MB' },
          exports: { count: 1, bytes: 500000, formatted: '488.28 KB' },
          templates: { count: 0, bytes: 0, formatted: '0 B' },
        },
        recentExports: [],
      });

      const res = await request(app)
        .get(`/api/events/${eventId}/storage`)
        .set('Authorization', 'Bearer host-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalBytesFormatted).toBe('2.38 MB');
    });

    it('GET /api/events/:eventId/storage should return 403 Forbidden for unauthorized volunteer', async () => {
      const res = await request(app)
        .get(`/api/events/${eventId}/storage`)
        .set('Authorization', 'Bearer volunteer-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message || res.body.message).toMatch(/permission|host|coordinator/i);
    });

    it('POST /api/events/:eventId/storage/cleanup should purge stale exports for host', async () => {
      jest.spyOn(eventStorageGovernanceService, 'cleanupStaleExports').mockResolvedValue({
        deletedCount: 3,
        reclaimedBytes: 12582912,
        reclaimedFormatted: '12.00 MB',
      });

      const res = await request(app)
        .post(`/api/events/${eventId}/storage/cleanup`)
        .set('Authorization', 'Bearer host-token')
        .send({ retentionHours: 24 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deletedCount).toBe(3);
      expect(res.body.data.reclaimedFormatted).toBe('12.00 MB');
    });

    it('POST /api/events/:eventId/storage/cleanup should return 403 Forbidden for volunteer', async () => {
      const res = await request(app)
        .post(`/api/events/${eventId}/storage/cleanup`)
        .set('Authorization', 'Bearer volunteer-token')
        .send({ retentionHours: 24 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
