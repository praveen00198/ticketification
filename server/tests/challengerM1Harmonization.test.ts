import mongoose from 'mongoose';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';

describe('Milestone 1 Challenger: Harmonization & Backwards Compatibility Adversarial Suite', () => {
  const testEventId = new mongoose.Types.ObjectId().toString();
  let repo: MongoEventCredentialRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MongoEventCredentialRepository();
  });

  /**
   * Helper to evaluate MongoDB query semantics in JS for query comparison
   */
  function matchesMongoUnrenderedQuery(doc: any, query: any): boolean {
    if (query.eventId && doc.eventId.toString() !== query.eventId.toString()) {
      return false;
    }
    if (query.renderStatus && query.renderStatus.$ne) {
      if (doc.renderStatus === query.renderStatus.$ne) return false;
    }
    if (query.$or) {
      const orMatched = query.$or.some((branch: any) => {
        if ('asset.publicUrl' in branch) {
          const spec = branch['asset.publicUrl'];
          if (spec && typeof spec === 'object' && '$exists' in spec) {
            const exists = doc.asset && 'publicUrl' in doc.asset && doc.asset.publicUrl !== undefined;
            return spec.$exists ? exists : !exists;
          }
          if (spec === null) return !doc.asset || doc.asset.publicUrl === null || doc.asset.publicUrl === undefined;
          if (spec === '') return doc.asset && doc.asset.publicUrl === '';
        }
        if ('asset.renderedAt' in branch) {
          const spec = branch['asset.renderedAt'];
          if (spec && typeof spec === 'object' && '$exists' in spec) {
            const exists = doc.asset && 'renderedAt' in doc.asset && doc.asset.renderedAt !== undefined;
            return spec.$exists ? exists : !exists;
          }
          if (spec === null) return !doc.asset || doc.asset.renderedAt === null || doc.asset.renderedAt === undefined;
        }
        return false;
      });
      if (!orMatched) return false;
    }
    return true;
  }

  describe('1. Adversarial Edge Case Classification Matrix', () => {
    const edgeCases = [
      {
        name: 'Legacy ticket (pre-M1): renderStatus undefined, asset null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 1,
          renderStatus: undefined,
          asset: null,
        },
        expectedUnrendered: true,
      },
      {
        name: 'Legacy ticket (pre-M1): renderStatus undefined, asset with storagePath set but publicUrl null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 2,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-2.png`,
            publicUrl: null,
            renderedAt: null,
          },
        },
        expectedUnrendered: true,
      },
      {
        name: 'Legacy ticket (pre-M1): renderStatus undefined, asset with publicUrl empty string',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 3,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-3.png`,
            publicUrl: '',
            renderedAt: new Date(),
          },
        },
        expectedUnrendered: true,
      },
      {
        name: 'Legacy ticket (pre-M1): renderStatus undefined, asset with publicUrl set but renderedAt null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 4,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-4.png`,
            publicUrl: 'https://storage.ticketification.app/events/1/credentials/cred-4.png',
            renderedAt: null,
          },
        },
        expectedUnrendered: true,
      },
      {
        name: 'Legacy completed ticket: renderStatus undefined, publicUrl AND renderedAt both valid',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 5,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-5.png`,
            publicUrl: 'https://storage.ticketification.app/events/1/credentials/cred-5.png',
            renderedAt: new Date('2026-10-01T12:00:00Z'),
          },
        },
        expectedUnrendered: false, // Must be treated as already completed!
      },
      {
        name: 'Modern ticket: renderStatus PENDING, asset null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 6,
          renderStatus: 'PENDING',
          asset: null,
        },
        expectedUnrendered: true,
      },
      {
        name: 'Modern ticket: renderStatus FAILED, asset null, renderError present',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 7,
          renderStatus: 'FAILED',
          renderError: 'Sharp rasterization timeout',
          asset: null,
        },
        expectedUnrendered: true,
      },
      {
        name: 'Modern ticket: renderStatus FAILED, asset has storagePath but publicUrl null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 8,
          renderStatus: 'FAILED',
          renderError: 'Supabase upload failed',
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-8.png`,
            publicUrl: null,
            renderedAt: null,
          },
        },
        expectedUnrendered: true,
      },
      {
        name: 'Modern ticket: renderStatus COMPLETED with valid publicUrl and renderedAt',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 9,
          renderStatus: 'COMPLETED',
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-9.png`,
            publicUrl: 'https://storage.ticketification.app/events/1/credentials/cred-9.png',
            renderedAt: new Date('2026-11-01T12:00:00Z'),
          },
        },
        expectedUnrendered: false,
      },
      {
        name: 'Modern ticket: renderStatus PROCESSING with expired worker lock',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 10,
          renderStatus: 'PROCESSING',
          renderingLockedBy: 'crashed-worker-99',
          renderingLockExpiresAt: new Date(Date.now() - 120000), // expired 2 mins ago
          asset: null,
        },
        expectedUnrendered: true,
      },
      {
        name: 'Inconsistent edge case: renderStatus COMPLETED, but asset.publicUrl is null',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 11,
          renderStatus: 'COMPLETED',
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-11.png`,
            publicUrl: null,
            renderedAt: null,
          },
        },
        expectedUnrendered: false, // renderStatus COMPLETED must never be returned
      },
      {
        name: 'Inconsistent edge case: renderStatus PENDING, but publicUrl and renderedAt both present',
        doc: {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 12,
          renderStatus: 'PENDING',
          asset: {
            storagePath: `events/${testEventId}/credentials/cred-12.png`,
            publicUrl: 'https://storage.ticketification.app/events/1/credentials/cred-12.png',
            renderedAt: new Date(),
          },
        },
        expectedUnrendered: false, // Asset exists so it should not be re-rendered
      },
    ];

    it('1.1 isCredentialUnrendered returns expected boolean for every edge case in matrix', () => {
      for (const tc of edgeCases) {
        const actual = (repo as any).isCredentialUnrendered(tc.doc);
        expect({ tc: tc.name, result: actual }).toEqual({
          tc: tc.name,
          result: tc.expectedUnrendered,
        });
      }
    });

    it('1.2 buildUnrenderedQuery MongoDB filter evaluates identically to isCredentialUnrendered across all edge cases', () => {
      const query = (repo as any).buildUnrenderedQuery(testEventId);

      for (const tc of edgeCases) {
        const inMemoryResult = (repo as any).isCredentialUnrendered(tc.doc);
        const mongoQueryResult = matchesMongoUnrenderedQuery(tc.doc, query);

        expect({ tc: tc.name, mongoQueryResult }).toEqual({
          tc: tc.name,
          mongoQueryResult: inMemoryResult,
        });
      }
    });
  });

  describe('2. Strict Parity: countUnrenderedByEvent vs findUnrenderedBatch', () => {
    let mockDataset: any[];

    beforeEach(() => {
      // Build a realistic mixed event dataset of 25 credentials:
      // - 7 completed modern credentials
      // - 3 completed legacy credentials
      // - 5 pending modern credentials
      // - 3 failed modern credentials (must be retried)
      // - 2 legacy tickets with undefined renderStatus and null asset
      // - 2 legacy tickets with storagePath but null publicUrl
      // - 1 processing with expired lock
      // - 2 tickets belonging to a completely different event (must be filtered out)
      mockDataset = [];

      let seq = 1;

      // 7 completed modern
      for (let i = 0; i < 7; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: 'COMPLETED',
          asset: {
            storagePath: `events/${testEventId}/credentials/c-${seq}.png`,
            publicUrl: `https://storage.ticketification.app/c-${seq}.png`,
            renderedAt: new Date(),
          },
        });
      }

      // 3 completed legacy (no renderStatus)
      for (let i = 0; i < 3; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/c-${seq}.png`,
            publicUrl: `https://storage.ticketification.app/c-${seq}.png`,
            renderedAt: new Date(),
          },
        });
      }

      // 5 pending modern
      for (let i = 0; i < 5; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: 'PENDING',
          asset: null,
        });
      }

      // 3 failed modern
      for (let i = 0; i < 3; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: 'FAILED',
          renderError: 'Test raster failure',
          asset: null,
        });
      }

      // 2 legacy with null asset
      for (let i = 0; i < 2; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: undefined,
          asset: null,
        });
      }

      // 2 legacy with storagePath but null publicUrl
      for (let i = 0; i < 2; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: seq++,
          renderStatus: undefined,
          asset: {
            storagePath: `events/${testEventId}/credentials/c-${seq}.png`,
            publicUrl: null,
            renderedAt: null,
          },
        });
      }

      // 1 processing with expired lock
      mockDataset.push({
        _id: new mongoose.Types.ObjectId(),
        eventId: new mongoose.Types.ObjectId(testEventId),
        sequenceNumber: seq++,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'dead-worker',
        renderingLockExpiresAt: new Date(Date.now() - 60000),
        asset: null,
      });

      // 2 different event credentials
      const otherEventId = new mongoose.Types.ObjectId();
      for (let i = 0; i < 2; i++) {
        mockDataset.push({
          _id: new mongoose.Types.ObjectId(),
          eventId: otherEventId,
          sequenceNumber: 100 + i,
          renderStatus: 'PENDING',
          asset: null,
        });
      }

      // Total credentials for testEventId: 7 + 3 + 5 + 3 + 2 + 2 + 1 = 23
      // Expected UNRENDERED count:
      // 5 (pending) + 3 (failed) + 2 (legacy null) + 2 (legacy storagePath only) + 1 (expired processing) = 13
      // Expected COMPLETED / EXCLUDED count:
      // 7 (modern completed) + 3 (legacy completed) = 10
      // Excluded other event: 2
    });

    it('2.1 in test mode (in-memory path), countUnrenderedByEvent returns exactly 13', async () => {
      jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(0);
      jest.spyOn(repo, 'findByEvent').mockImplementation(async (eId: string) => {
        const credentials = mockDataset.filter((c) => c.eventId.toString() === eId);
        return { credentials, total: credentials.length } as any;
      });

      const count = await repo.countUnrenderedByEvent(testEventId);
      expect(count).toBe(13);
    });

    it('2.2 in test mode (in-memory path), findUnrenderedBatch paginates and sums to exactly countUnrenderedByEvent across different limits', async () => {
      jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(0);
      jest.spyOn(repo, 'findByEvent').mockImplementation(async (eId: string) => {
        const credentials = mockDataset.filter((c) => c.eventId.toString() === eId);
        return { credentials, total: credentials.length } as any;
      });

      const expectedTotal = await repo.countUnrenderedByEvent(testEventId);
      expect(expectedTotal).toBe(13);

      for (const batchSize of [1, 2, 3, 5, 10, 50]) {
        let paginatedResults: any[] = [];
        let lastId: any = undefined;

        while (true) {
          const batch = await repo.findUnrenderedBatch(testEventId, lastId, batchSize);
          if (batch.length === 0) break;
          paginatedResults.push(...batch);
          lastId = batch[batch.length - 1]._id;
        }

        expect(paginatedResults.length).toBe(expectedTotal);

        // Verify none of the paginated results are completed
        for (const item of paginatedResults) {
          expect(item.renderStatus).not.toBe('COMPLETED');
          const isCompletedLegacy = !item.renderStatus && item.asset?.publicUrl && item.asset?.renderedAt;
          expect(isCompletedLegacy).toBeFalsy();
        }

        // Verify all 13 returned are unique by _id
        const uniqueIds = new Set(paginatedResults.map((c) => c._id.toString()));
        expect(uniqueIds.size).toBe(expectedTotal);
      }
    });

    it('2.3 in connected DB mode (Mongoose path), countDocuments and find queries use identical query object', async () => {
      jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(1);

      let capturedCountQuery: any = null;
      let capturedFindQuery: any = null;

      jest.spyOn(EventCredentialModel, 'countDocuments').mockImplementation((query: any) => {
        capturedCountQuery = query;
        return {
          exec: jest.fn().mockResolvedValue(13),
        } as any;
      });

      jest.spyOn(EventCredentialModel, 'find').mockImplementation((query: any) => {
        capturedFindQuery = query;
        return {
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(
                mockDataset.filter(
                  (c) =>
                    c.eventId.toString() === testEventId &&
                    c.renderStatus !== 'COMPLETED' &&
                    (!c.asset?.publicUrl || !c.asset?.renderedAt)
                ).slice(0, 50)
              ),
            }),
          }),
        } as any;
      });

      const count = await repo.countUnrenderedByEvent(testEventId);
      const batch = await repo.findUnrenderedBatch(testEventId, undefined, 50);

      expect(count).toBe(13);
      expect(batch.length).toBe(13);

      // Verify exact query equivalence
      expect(capturedCountQuery).toEqual(capturedFindQuery);
      expect(capturedCountQuery).toEqual({
        eventId: new mongoose.Types.ObjectId(testEventId),
        renderStatus: { $ne: 'COMPLETED' },
        $or: [
          { 'asset.publicUrl': { $exists: false } },
          { 'asset.publicUrl': null },
          { 'asset.publicUrl': '' },
          { 'asset.renderedAt': { $exists: false } },
          { 'asset.renderedAt': null },
        ],
      });
    });

    it('2.4 never returns completed tickets in findUnrenderedBatch or countUnrenderedByEvent', async () => {
      // Create a dataset containing ONLY completed tickets (modern & legacy)
      const allCompletedDataset = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 1,
          renderStatus: 'COMPLETED',
          asset: {
            publicUrl: 'https://storage.ticketification.app/ticket-1.png',
            renderedAt: new Date(),
          },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: new mongoose.Types.ObjectId(testEventId),
          sequenceNumber: 2,
          renderStatus: undefined, // legacy completed
          asset: {
            publicUrl: 'https://storage.ticketification.app/ticket-2.png',
            renderedAt: new Date(),
          },
        },
      ];

      jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(0);
      jest.spyOn(repo, 'findByEvent').mockResolvedValue({
        credentials: allCompletedDataset,
        total: allCompletedDataset.length,
      } as any);

      const count = await repo.countUnrenderedByEvent(testEventId);
      expect(count).toBe(0);

      const batch = await repo.findUnrenderedBatch(testEventId);
      expect(batch).toEqual([]);
    });

    it('2.5 validates that invalid eventIds fail safely without crashing', async () => {
      const invalidEventId = 'not-a-valid-object-id';

      const count = await repo.countUnrenderedByEvent(invalidEventId);
      expect(count).toBe(0);

      const batch = await repo.findUnrenderedBatch(invalidEventId);
      expect(batch).toEqual([]);
    });
  });
});
