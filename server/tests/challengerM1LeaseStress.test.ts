import mongoose from 'mongoose';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { EventCredentialModel, IEventCredentialDocument } from '../src/db/mongo/models/event-credential.model';

describe('Adversarial Lease Concurrency & Stress Suite (Milestone 1)', () => {
  jest.setTimeout(30000);

  const testEventId = new mongoose.Types.ObjectId().toString();
  let repo: MongoEventCredentialRepository;
  let inMemoryDocs: Map<string, any>;

  function createMockDoc(data: Partial<any>): any {
    const _id = data._id || new mongoose.Types.ObjectId();
    const doc: any = {
      _id,
      eventId: new mongoose.Types.ObjectId(testEventId),
      sequenceNumber: data.sequenceNumber || 1,
      formattedId: data.formattedId || `TIC-${data.sequenceNumber || 1}`,
      verificationToken: data.verificationToken || 'a'.repeat(64),
      credentialType: 'ATTENDEE',
      terminology: 'Ticket',
      usagePolicy: 'SINGLE_USE',
      status: 'ACTIVE',
      renderStatus: data.renderStatus || 'PENDING',
      renderAttempts: data.renderAttempts || 0,
      renderError: data.renderError || null,
      renderingLockedBy: data.renderingLockedBy || null,
      renderingLockExpiresAt: data.renderingLockExpiresAt || null,
      holder: {
        name: data.holder?.name || 'Test User',
        category: 'General',
        isAssigned: true,
      },
      asset: data.asset || null,
      metadata: data.metadata || {},
      save: jest.fn().mockImplementation(async function (this: any) {
        inMemoryDocs.set(_id.toString(), { ...this });
        return this;
      }),
    };
    inMemoryDocs.set(_id.toString(), doc);
    return doc;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MongoEventCredentialRepository();
    inMemoryDocs = new Map();

    // Wire simulated atomic MongoDB model behavior on EventCredentialModel
    jest.spyOn(EventCredentialModel, 'findOneAndUpdate').mockImplementation((query: any, update: any, options: any) => {
      // Find matching document matching query logic
      const now = new Date();
      let matchedDoc: any = null;

      // Filter docs for eventId
      const candidates = Array.from(inMemoryDocs.values()).filter((doc) => {
        if (query.eventId && doc.eventId.toString() !== query.eventId.toString()) return false;
        if (query.renderStatus?.$ne && doc.renderStatus === query.renderStatus.$ne) return false;

        if (query.$or) {
          const matchOr = query.$or.some((branch: any) => {
            if (branch.renderStatus === 'PENDING') {
              return doc.renderStatus === 'PENDING';
            }
            if (branch.renderStatus?.$exists === false) {
              if (doc.renderStatus !== undefined) return false;
              if (branch.$or) {
                return branch.$or.some((sub: any) => {
                  if (sub['asset.publicUrl']?.$exists === false) return !doc.asset || doc.asset.publicUrl === undefined;
                  if (sub['asset.publicUrl'] === null) return !doc.asset || doc.asset.publicUrl === null;
                  if (sub['asset.publicUrl'] === '') return !doc.asset || doc.asset.publicUrl === '';
                  return false;
                });
              }
              return true;
            }
            if (branch.renderStatus === 'FAILED') {
              return doc.renderStatus === 'FAILED';
            }
            if (branch.renderStatus === 'PROCESSING') {
              if (doc.renderStatus !== 'PROCESSING') return false;
              if (branch.$or) {
                return branch.$or.some((sub: any) => {
                  if (sub.renderingLockExpiresAt?.$lte) {
                    return doc.renderingLockExpiresAt && new Date(doc.renderingLockExpiresAt) <= sub.renderingLockExpiresAt.$lte;
                  }
                  if (sub.renderingLockExpiresAt === null) {
                    return doc.renderingLockExpiresAt === null;
                  }
                  if (sub.renderingLockExpiresAt?.$exists === false) {
                    return doc.renderingLockExpiresAt === undefined;
                  }
                  return false;
                });
              }
            }
            return false;
          });
          if (!matchOr) return false;
        }

        return true;
      });

      // Sort candidates according to options.sort
      if (options?.sort) {
        candidates.sort((a, b) => {
          if (a.sequenceNumber !== b.sequenceNumber) {
            return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
          }
          return a._id.toString().localeCompare(b._id.toString());
        });
      }

      matchedDoc = candidates[0] || null;

      if (!matchedDoc) {
        return {
          exec: jest.fn().mockResolvedValue(null),
        } as any;
      }

      // Apply atomic $set and $inc
      if (update.$set) {
        Object.assign(matchedDoc, update.$set);
      }
      if (update.$inc) {
        for (const [key, incVal] of Object.entries(update.$inc)) {
          matchedDoc[key] = (matchedDoc[key] || 0) + (incVal as number);
        }
      }

      inMemoryDocs.set(matchedDoc._id.toString(), matchedDoc);

      return {
        exec: jest.fn().mockResolvedValue({ ...matchedDoc }),
      } as any;
    });

    jest.spyOn(EventCredentialModel, 'updateMany').mockImplementation((filter: any, update: any) => {
      let modifiedCount = 0;
      for (const doc of inMemoryDocs.values()) {
        if (filter.eventId && doc.eventId.toString() !== filter.eventId.toString()) continue;
        if (filter.renderStatus && doc.renderStatus !== filter.renderStatus) continue;

        let matchesOr = true;
        if (filter.$or) {
          matchesOr = filter.$or.some((sub: any) => {
            if (sub.renderingLockExpiresAt?.$lte) {
              return doc.renderingLockExpiresAt && new Date(doc.renderingLockExpiresAt) <= sub.renderingLockExpiresAt.$lte;
            }
            if (sub.renderingLockExpiresAt === null) return doc.renderingLockExpiresAt === null;
            if (sub.renderingLockExpiresAt?.$exists === false) return doc.renderingLockExpiresAt === undefined;
            return false;
          });
        }

        if (matchesOr) {
          if (update.$set) Object.assign(doc, update.$set);
          modifiedCount++;
        }
      }

      return {
        exec: jest.fn().mockResolvedValue({ modifiedCount }),
      } as any;
    });

    jest.spyOn(EventCredentialModel, 'findByIdAndUpdate').mockImplementation((id: any, update: any) => {
      const doc = inMemoryDocs.get(id.toString());
      if (!doc) {
        return { exec: jest.fn().mockResolvedValue(null) } as any;
      }
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          if (key.includes('.')) {
            const parts = key.split('.');
            let curr = doc;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!curr[parts[i]]) curr[parts[i]] = {};
              curr = curr[parts[i]];
            }
            curr[parts[parts.length - 1]] = val;
          } else {
            doc[key] = val;
          }
        }
      }
      return {
        exec: jest.fn().mockResolvedValue({ ...doc }),
      } as any;
    });

    // Mock getDbReadyState to 1 (connected)
    jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(1);
  });

  // =========================================================================
  // MISSION 1: CONCURRENT DOUBLE-CLAIM PROOF
  // =========================================================================
  describe('Mission 1: Concurrency & Double-Claim Impossibility', () => {
    it('1.1 should prevent two concurrent workers from double-claiming a single unrendered ticket', async () => {
      createMockDoc({ sequenceNumber: 1, renderStatus: 'PENDING' });

      const workerA = 'worker-A';
      const workerB = 'worker-B';

      // Simultaneously execute claims
      const [claimA, claimB] = await Promise.all([
        repo.claimUnrenderedTicketLease(testEventId, workerA, 30000),
        repo.claimUnrenderedTicketLease(testEventId, workerB, 30000),
      ]);

      // Exactly one must win, the other must receive null
      const winner = claimA || claimB;
      const loser = claimA ? claimB : claimA;

      expect(winner).not.toBeNull();
      expect(loser).toBeNull();

      expect(winner?.renderStatus).toBe('PROCESSING');
      expect([workerA, workerB]).toContain(winner?.renderingLockedBy);
      expect(winner?.renderingLockExpiresAt).toBeInstanceOf(Date);
      expect(winner?.renderAttempts).toBe(1);
    });

    it('1.2 should partition a batch of unrendered tickets across 10 concurrent workers with zero collisions', async () => {
      const TOTAL_TICKETS = 25;
      for (let i = 1; i <= TOTAL_TICKETS; i++) {
        createMockDoc({ sequenceNumber: i, renderStatus: 'PENDING' });
      }

      const WORKER_COUNT = 10;
      const workers = Array.from({ length: WORKER_COUNT }, (_, idx) => `worker-${idx + 1}`);

      const claimedMap = new Map<string, string[]>();
      for (const w of workers) claimedMap.set(w, []);

      // Workers concurrently pull tickets until pool is exhausted
      let running = true;
      while (running) {
        const promises = workers.map((w) => repo.claimUnrenderedTicketLease(testEventId, w, 30000));
        const results = await Promise.all(promises);

        let anyClaimedThisRound = false;
        for (let i = 0; i < workers.length; i++) {
          const res = results[i];
          if (res) {
            anyClaimedThisRound = true;
            claimedMap.get(workers[i])!.push(res._id.toString());
          }
        }
        if (!anyClaimedThisRound) {
          running = false;
        }
      }

      // Assert total claimed count equals total tickets
      const allClaimedIds: string[] = [];
      for (const ids of claimedMap.values()) {
        allClaimedIds.push(...ids);
      }

      expect(allClaimedIds.length).toBe(TOTAL_TICKETS);

      // Verify mutual exclusivity (zero collisions)
      const uniqueIds = new Set(allClaimedIds);
      expect(uniqueIds.size).toBe(TOTAL_TICKETS);
    });

    it('1.3 should return null when all tickets in event are already COMPLETED', async () => {
      createMockDoc({ sequenceNumber: 1, renderStatus: 'COMPLETED' });
      createMockDoc({ sequenceNumber: 2, renderStatus: 'COMPLETED' });

      const claim = await repo.claimUnrenderedTicketLease(testEventId, 'worker-eager', 30000);
      expect(claim).toBeNull();
    });
  });

  // =========================================================================
  // MISSION 2: EXPIRED LEASE RECLAIMABILITY
  // =========================================================================
  describe('Mission 2: Immediate Claimability of Expired Leases', () => {
    it('2.1 should immediately re-claim an expired lease directly in claimUnrenderedTicketLease without waiting', async () => {
      const pastDate = new Date(Date.now() - 15000); // Expired 15s ago
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'crashed-worker-dead',
        renderingLockExpiresAt: pastDate,
        renderAttempts: 1,
      });

      const newWorker = 'recovery-worker-alive';
      const claim = await repo.claimUnrenderedTicketLease(testEventId, newWorker, 45000);

      expect(claim).not.toBeNull();
      expect(claim?._id.toString()).toBe(doc._id.toString());
      expect(claim?.renderStatus).toBe('PROCESSING');
      expect(claim?.renderingLockedBy).toBe(newWorker);
      expect(claim?.renderAttempts).toBe(2);
      expect(new Date(claim?.renderingLockExpiresAt!).getTime()).toBeGreaterThan(Date.now());
    });

    it('2.2 reclaimAbandonedTicketLeases should batch-reset only expired leases and respect leaseGraceMs', async () => {
      const expiredLongAgo = new Date(Date.now() - 60000); // 60s ago
      const expiredRecently = new Date(Date.now() - 5000); // 5s ago
      const activeFuture = new Date(Date.now() + 60000); // 60s in future

      createMockDoc({ sequenceNumber: 1, renderStatus: 'PROCESSING', renderingLockExpiresAt: expiredLongAgo, renderingLockedBy: 'w1' });
      createMockDoc({ sequenceNumber: 2, renderStatus: 'PROCESSING', renderingLockExpiresAt: expiredRecently, renderingLockedBy: 'w2' });
      createMockDoc({ sequenceNumber: 3, renderStatus: 'PROCESSING', renderingLockExpiresAt: activeFuture, renderingLockedBy: 'w3' });

      // Reclaim with grace period of 10 seconds: only expiredLongAgo (>10s old) should be reset
      const reclaimed = await repo.reclaimAbandonedTicketLeases(testEventId, 10000);
      expect(reclaimed).toBe(1);

      // Verify doc 1 was reset
      const doc1 = inMemoryDocs.get(Array.from(inMemoryDocs.keys())[0]);
      expect(doc1.renderStatus).toBe('PENDING');
      expect(doc1.renderingLockedBy).toBeNull();
      expect(doc1.renderingLockExpiresAt).toBeNull();

      // Verify doc 2 was NOT reset (within grace window)
      const doc2 = inMemoryDocs.get(Array.from(inMemoryDocs.keys())[1]);
      expect(doc2.renderStatus).toBe('PROCESSING');
      expect(doc2.renderingLockedBy).toBe('w2');

      // Verify doc 3 was NOT reset (active lease)
      const doc3 = inMemoryDocs.get(Array.from(inMemoryDocs.keys())[2]);
      expect(doc3.renderStatus).toBe('PROCESSING');
      expect(doc3.renderingLockedBy).toBe('w3');
    });
  });

  // =========================================================================
  // MISSION 3: ACTIVE UNEXPIRED LEASE IMMUNITY
  // =========================================================================
  describe('Mission 3: Active Unexpired Leases Are Strictly Immune from Stealing', () => {
    it('3.1 should never allow another worker to claim a ticket with an active, unexpired lease', async () => {
      const futureDate = new Date(Date.now() + 120000); // 2 minutes in future
      createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'legitimate-active-worker',
        renderingLockExpiresAt: futureDate,
        renderAttempts: 1,
      });

      const rogueWorker = 'rogue-stealer-worker';
      const claim = await repo.claimUnrenderedTicketLease(testEventId, rogueWorker, 30000);

      // Must NOT be claimed
      expect(claim).toBeNull();

      // State of original ticket must be unchanged
      const doc = inMemoryDocs.get(Array.from(inMemoryDocs.keys())[0]);
      expect(doc.renderStatus).toBe('PROCESSING');
      expect(doc.renderingLockedBy).toBe('legitimate-active-worker');
      expect(doc.renderingLockExpiresAt).toEqual(futureDate);
      expect(doc.renderAttempts).toBe(1);
    });

    it('3.2 should skip actively leased tickets and lease the next available pending ticket in sequence', async () => {
      const futureDate = new Date(Date.now() + 60000);
      // Ticket 1: Active lease
      createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'worker-1',
        renderingLockExpiresAt: futureDate,
      });

      // Ticket 2: Pending
      createMockDoc({
        sequenceNumber: 2,
        renderStatus: 'PENDING',
      });

      const worker2 = 'worker-2';
      const claim = await repo.claimUnrenderedTicketLease(testEventId, worker2, 30000);

      expect(claim).not.toBeNull();
      expect(claim?.sequenceNumber).toBe(2);
      expect(claim?.renderingLockedBy).toBe(worker2);
      expect(claim?.renderStatus).toBe('PROCESSING');
    });
  });

  // =========================================================================
  // SECTION 4: STATE TRANSITIONS & FAILURE RECOVERY
  // =========================================================================
  describe('Section 4: Atomic State Completion & Failure Handling', () => {
    it('4.1 markRenderCompleted atomically sets COMPLETED, attaches asset, and releases lock', async () => {
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'worker-finishing',
        renderingLockExpiresAt: new Date(Date.now() + 60000),
      });

      const assetData = {
        storagePath: `events/${testEventId}/credentials/${doc._id}.png`,
        publicUrl: `https://storage.ticketification.app/events/${testEventId}/credentials/${doc._id}.png`,
        renderedAt: new Date(),
        dimensions: { width: 1620, height: 2025 },
        fileSizeBytes: 456789,
      };

      const completed = await repo.markRenderCompleted(doc._id.toString(), assetData);
      expect(completed).not.toBeNull();
      expect(completed?.renderStatus).toBe('COMPLETED');
      expect(completed?.renderingLockedBy).toBeNull();
      expect(completed?.renderingLockExpiresAt).toBeNull();
      expect(completed?.asset?.storagePath).toBe(assetData.storagePath);
      expect(completed?.asset?.publicUrl).toBe(assetData.publicUrl);
    });

    it('4.2 markRenderFailed atomically sets FAILED, bounds error to 1000 chars, and allows retry claim', async () => {
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'worker-crashing',
        renderingLockExpiresAt: new Date(Date.now() + 60000),
      });

      const longError = 'E'.repeat(1500);
      const failed = await repo.markRenderFailed(doc._id.toString(), longError);

      expect(failed).not.toBeNull();
      expect(failed?.renderStatus).toBe('FAILED');
      expect(failed?.renderError?.length).toBeLessThanOrEqual(1000);
      expect(failed?.renderingLockedBy).toBeNull();
      expect(failed?.renderingLockExpiresAt).toBeNull();

      // Subsequent worker can re-claim the FAILED ticket
      const retryWorker = 'retry-worker';
      const reclaimed = await repo.claimUnrenderedTicketLease(testEventId, retryWorker, 30000);
      expect(reclaimed).not.toBeNull();
      expect(reclaimed?._id.toString()).toBe(doc._id.toString());
      expect(reclaimed?.renderStatus).toBe('PROCESSING');
      expect(reclaimed?.renderingLockedBy).toBe(retryWorker);
    });
  });

  // =========================================================================
  // SECTION 5: INPUT BOUNDARY DEFENSE & FAIL-CLOSED CHECKS
  // =========================================================================
  describe('Section 5: Input Boundary Defense & Disconnected State', () => {
    it('5.1 rejects invalid eventId or empty workerId gracefully', async () => {
      const invalidEvent = await repo.claimUnrenderedTicketLease('not-an-objectid', 'worker-1');
      expect(invalidEvent).toBeNull();

      const emptyWorker = await repo.claimUnrenderedTicketLease(testEventId, '');
      expect(emptyWorker).toBeNull();
    });

    it('5.2 throws [DatabaseDisconnected] when getDbReadyState is 0 in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(0);

        await expect(repo.claimUnrenderedTicketLease(testEventId, 'w1')).rejects.toThrow(
          /\[DatabaseDisconnected\]/
        );
        await expect(repo.reclaimAbandonedTicketLeases(testEventId)).rejects.toThrow(
          /\[DatabaseDisconnected\]/
        );
        await expect(
          repo.markRenderCompleted(new mongoose.Types.ObjectId().toString(), {
            storagePath: 'path',
            publicUrl: 'url',
          })
        ).rejects.toThrow(/\[DatabaseDisconnected\]/);
        await expect(
          repo.markRenderFailed(new mongoose.Types.ObjectId().toString(), 'err')
        ).rejects.toThrow(/\[DatabaseDisconnected\]/);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  // =========================================================================
  // SECTION 6: LEGACY MIGRATION, NULL LOCKS & FALLBACK PATHS
  // =========================================================================
  describe('Section 6: Legacy Migration, Null Locks & In-Memory Fallback', () => {
    it('6.1 should claim legacy tickets with undefined renderStatus when asset.publicUrl is missing', async () => {
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: undefined,
        asset: null,
      });
      delete doc.renderStatus;

      const claim = await repo.claimUnrenderedTicketLease(testEventId, 'legacy-worker', 30000);
      expect(claim).not.toBeNull();
      expect(claim?.renderStatus).toBe('PROCESSING');
      expect(claim?.renderingLockedBy).toBe('legacy-worker');
    });

    it('6.2 should NOT claim legacy tickets with undefined renderStatus when asset.publicUrl is already present', async () => {
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: undefined,
        asset: { publicUrl: 'https://storage/already-rendered.png' },
      });
      delete doc.renderStatus;

      const claim = await repo.claimUnrenderedTicketLease(testEventId, 'worker-check', 30000);
      expect(claim).toBeNull();
    });

    it('6.3 should immediately claim PROCESSING tickets with null renderingLockExpiresAt', async () => {
      const doc = createMockDoc({
        sequenceNumber: 1,
        renderStatus: 'PROCESSING',
        renderingLockedBy: 'stale-worker',
        renderingLockExpiresAt: null,
      });

      const claim = await repo.claimUnrenderedTicketLease(testEventId, 'new-worker', 30000);
      expect(claim).not.toBeNull();
      expect(claim?.renderingLockedBy).toBe('new-worker');
      expect(claim?.renderStatus).toBe('PROCESSING');
    });

    it('6.4 in-memory test fallback (getDbReadyState === 0 in test env) safely partitions leases', async () => {
      jest.spyOn(repo as any, 'getDbReadyState').mockReturnValue(0);
      jest.spyOn(repo, 'findByEvent').mockImplementation(async () => {
        return {
          credentials: Array.from(inMemoryDocs.values()).filter(
            (c) => c.eventId.toString() === testEventId
          ),
          total: inMemoryDocs.size,
        };
      });

      createMockDoc({ sequenceNumber: 1, renderStatus: 'PENDING' });
      createMockDoc({ sequenceNumber: 2, renderStatus: 'PENDING' });

      const claim1 = await repo.claimUnrenderedTicketLease(testEventId, 'mem-worker-1', 30000);
      const claim2 = await repo.claimUnrenderedTicketLease(testEventId, 'mem-worker-2', 30000);

      expect(claim1).not.toBeNull();
      expect(claim2).not.toBeNull();
      expect(claim1?._id.toString()).not.toBe(claim2?._id.toString());
      expect(claim1?.renderingLockedBy).toBe('mem-worker-1');
      expect(claim2?.renderingLockedBy).toBe('mem-worker-2');
    });
  });
});
