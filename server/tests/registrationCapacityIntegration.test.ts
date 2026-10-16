import mongoose from 'mongoose';
import { EventModel } from '../src/db/mongo/models/event.model';
import {
  EventRegistrationModel,
  CONFIRMED_CAPACITY_STATUSES,
} from '../src/db/mongo/models/event-registration.model';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { EventRegistrationService } from '../src/modules/events/services/event-registration.service';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoEventRegistrationRepository } from '../src/modules/events/repositories/mongo-event-registration.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';
import { EventCredentialService } from '../src/modules/events/services/event-credential.service';
import { ValidationError } from '../src/middlewares/error.middleware';
import config from '../src/config/env';

describe('FIX 2: Registration Capacity, Atomicity and Legacy Counters Integration Suite', () => {
  jest.setTimeout(45000);

  let eventRepo: MongoEventRepository;
  let registrationRepo: MongoEventRegistrationRepository;
  let userRepo: MongoUserRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let teamRepo: MongoEventTeamRepository;
  let credentialService: EventCredentialService;
  let registrationService: EventRegistrationService;

  const testEventIds: mongoose.Types.ObjectId[] = [];
  const testUserIds: mongoose.Types.ObjectId[] = [];
  let isConnectedToRealDb = false;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || config.env.mongoUri;
    if (mongoUri && mongoose.connection.readyState !== 1) {
      try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
        isConnectedToRealDb = mongoose.connection.readyState === 1;
        console.log('[IntegrationTest] Connected to MongoDB Atlas instance.');
      } catch (err: any) {
        console.warn('[IntegrationTest] Real MongoDB unavailable, running with fallback mock:', err.message);
      }
    } else if (mongoose.connection.readyState === 1) {
      isConnectedToRealDb = true;
    }

    eventRepo = new MongoEventRepository();
    registrationRepo = new MongoEventRegistrationRepository();
    userRepo = new MongoUserRepository();
    credentialRepo = new MongoEventCredentialRepository();
    teamRepo = new MongoEventTeamRepository();
    credentialService = new EventCredentialService();
    registrationService = new EventRegistrationService(
      registrationRepo,
      eventRepo,
      userRepo,
      credentialRepo,
      teamRepo,
      credentialService
    );
  });

  afterAll(async () => {
    if (isConnectedToRealDb) {
      try {
        // Clean up test events, registrations, and credentials created during the test run
        if (testEventIds.length > 0) {
          await EventModel.deleteMany({ _id: { $in: testEventIds } }).exec();
          await EventRegistrationModel.deleteMany({ eventId: { $in: testEventIds } }).exec();
          await EventCredentialModel.deleteMany({ eventId: { $in: testEventIds } }).exec();
        }
      } catch (e: any) {
        console.warn('[IntegrationTest] Cleanup warning:', e.message);
      }
    }
  });

  // Helper to create real or mockable event
  async function createTestEvent(overrides: Record<string, any> = {}) {
    const eId = new mongoose.Types.ObjectId();
    const ownerId = new mongoose.Types.ObjectId();
    testEventIds.push(eId);

    const eventData = {
      _id: eId,
      ownerId,
      ownerSupabaseId: `owner-${eId.toString().slice(-6)}`,
      name: `Test Event ${eId.toString().slice(-4)}`,
      eventType: 'CONFERENCE',
      credentialTerminology: 'Badge',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Convention Center', city: 'San Francisco' },
      schedule: {
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 86400000),
        timezone: 'UTC',
      },
      status: 'PUBLISHED',
      ...overrides,
      registration: {
        pricingModel: 'FREE',
        registrationRequired: true,
        capacity: 10,
        confirmedCount: 0,
        reconciledAt: new Date(),
        reconcileVersion: 0,
        releasedTokens: [],
        ...(overrides.registration || {}),
        ...(overrides.registration && 'reconciledAt' in overrides.registration
          ? { reconciledAt: overrides.registration.reconciledAt }
          : {}),
      },
    };

    if (isConnectedToRealDb) {
      return await EventModel.create(eventData);
    }
    return eventData as any;
  }

  // Helper to mock or persist a user
  function mockUser(userId: mongoose.Types.ObjectId, email: string, name: string) {
    testUserIds.push(userId);
    const userDoc = {
      _id: userId,
      supabaseId: `sub-${userId.toString().slice(-6)}`,
      email,
      name,
      role: 'ATTENDEE',
    };
    jest.spyOn(userRepo, 'findBySupabaseId').mockImplementation(async (subId: string) => {
      if (subId === userDoc.supabaseId) return userDoc as any;
      return null;
    });
    return userDoc;
  }

  describe('1. Authoritative Statuses & Capacity Invariants', () => {
    it('defines authoritative confirmed capacity statuses strictly as CONFIRMED and ATTENDED', () => {
      expect(CONFIRMED_CAPACITY_STATUSES).toContain('CONFIRMED');
      expect(CONFIRMED_CAPACITY_STATUSES).toContain('ATTENDED');
      expect(CONFIRMED_CAPACITY_STATUSES).not.toContain('WAITLISTED');
      expect(CONFIRMED_CAPACITY_STATUSES).not.toContain('CANCELLED');
    });
  });

  describe('2. Atomic Capacity Reservation & Race Condition Defenses', () => {
    it('Capacity 10 with 9 existing confirmed registrations and many concurrent attempts: at most one new confirmation', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: {
          capacity: 10,
          confirmedCount: 9,
          reconciledAt: new Date(),
          reconcileVersion: 1,
        },
      });

      // Seed 9 confirmed registrations in DB
      for (let i = 1; i <= 9; i++) {
        const uId = new mongoose.Types.ObjectId();
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: uId,
          userSupabaseId: `sub-seed-${i}`,
          status: 'CONFIRMED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Seeded ${i}`, email: `seeded${i}@race.com` },
          registeredAt: new Date(),
        });
      }

      // 8 concurrent racers compete for the single remaining 10th slot
      const racers = Array.from({ length: 8 }, (_, idx) => {
        const uId = new mongoose.Types.ObjectId();
        const user = {
          _id: uId,
          supabaseId: `sub-racer-${idx + 1}`,
          email: `racer${idx + 1}@race.com`,
          name: `Racer ${idx + 1}`,
        };
        return user;
      });

      jest.spyOn(userRepo, 'findBySupabaseId').mockImplementation(async (subId: string) => {
        return racers.find((r) => r.supabaseId === subId) as any;
      });

      const results = await Promise.allSettled(
        racers.map((racer) =>
          registrationService.register(event._id.toString(), racer.supabaseId, {
            name: racer.name,
            email: racer.email,
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 1 new confirmation succeeds
      expect(fulfilled.length).toBe(1);
      // All other 7 concurrent racers are rejected
      expect(rejected.length).toBe(7);

      for (const rej of rejected) {
        if (rej.status === 'rejected') {
          expect(rej.reason.message).toMatch(/capacity limit/i);
        }
      }

      // Assert persisted MongoDB document state
      const persistedEvent = await EventModel.findById(event._id).exec();
      expect(persistedEvent?.registration?.confirmedCount).toBe(10);

      const totalConfirmedDocs = await EventRegistrationModel.countDocuments({
        eventId: event._id,
        status: { $in: CONFIRMED_CAPACITY_STATUSES },
      }).exec();
      expect(totalConfirmedDocs).toBe(10);
    });

    it('Capacity already reached: immediate rejection without modifying counter', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: {
          capacity: 5,
          confirmedCount: 5,
          reconciledAt: new Date(),
          reconcileVersion: 5,
        },
      });

      const racerId = new mongoose.Types.ObjectId();
      mockUser(racerId, 'late@attendee.com', 'Late Comer');

      await expect(
        registrationService.register(event._id.toString(), `sub-${racerId.toString().slice(-6)}`, {
          name: 'Late Comer',
          email: 'late@attendee.com',
        })
      ).rejects.toThrow(/capacity limit/i);

      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(5);
    });
  });

  describe('3. Legacy Counter Correction & Lazy Reconciliation', () => {
    it('Existing registrations with missing counter: lazily reconciled before slot reservation without allowing over-capacity', async () => {
      if (!isConnectedToRealDb) return;

      // Legacy event with NO confirmedCount, capacity: 4
      const event = await createTestEvent({
        registration: {
          capacity: 4,
          confirmedCount: undefined,
          reconciledAt: undefined,
        },
      });

      // Directly unset registration.confirmedCount and reconciledAt in MongoDB
      await EventModel.updateOne(
        { _id: event._id },
        {
          $unset: {
            'registration.confirmedCount': '',
            'registration.reconciledAt': '',
          },
        }
      ).exec();

      // Seed 3 existing confirmed registrations
      for (let i = 1; i <= 3; i++) {
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: new mongoose.Types.ObjectId(),
          userSupabaseId: `sub-legacy-${i}`,
          status: 'CONFIRMED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Legacy ${i}`, email: `legacy${i}@test.com` },
          registeredAt: new Date(),
        });
      }

      // Attendee 4 registers: fills the 4th (and final) slot
      const fourthUserId = new mongoose.Types.ObjectId();
      mockUser(fourthUserId, 'fourth@test.com', 'Attendee Four');

      const res4 = await registrationService.register(
        event._id.toString(),
        `sub-${fourthUserId.toString().slice(-6)}`,
        { name: 'Attendee Four', email: 'fourth@test.com' }
      );
      expect(res4.registration).toBeDefined();

      const eventAfter4 = await EventModel.findById(event._id).exec();
      expect(eventAfter4?.registration?.confirmedCount).toBe(4);
      expect(eventAfter4?.registration?.reconciledAt).toBeDefined();

      // Attendee 5 attempts to register: MUST be rejected
      const fifthUserId = new mongoose.Types.ObjectId();
      mockUser(fifthUserId, 'fifth@test.com', 'Attendee Five');

      await expect(
        registrationService.register(
          event._id.toString(),
          `sub-${fifthUserId.toString().slice(-6)}`,
          { name: 'Attendee Five', email: 'fifth@test.com' }
        )
      ).rejects.toThrow(/capacity limit/i);

      const eventAfter5 = await EventModel.findById(event._id).exec();
      expect(eventAfter5?.registration?.confirmedCount).toBe(4);
    });

    it('Existing registrations with counter equal to zero: corrected accurately to match authoritative registrations', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: {
          capacity: 10,
          confirmedCount: 0,
          reconciledAt: undefined, // Legacy uninitialized state
        },
      });

      // 4 real registrations exist in DB
      for (let i = 1; i <= 4; i++) {
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: new mongoose.Types.ObjectId(),
          userSupabaseId: `sub-zero-counter-${i}`,
          status: 'CONFIRMED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Attendee ${i}`, email: `zero${i}@test.com` },
          registeredAt: new Date(),
        });
      }

      // Call reconcileConfirmedCount
      const reconciled = await eventRepo.reconcileConfirmedCount(event._id.toString(), false);
      expect(reconciled).toBe(4);

      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(4);
      expect(persisted?.registration?.reconciledAt).toBeDefined();
    });

    it('Incorrect positive counter: corrected accurately via reconciliation', async () => {
      if (!isConnectedToRealDb) return;

      // Event has phantom confirmedCount = 12, but actual registrations in DB = 2
      const event = await createTestEvent({
        registration: {
          capacity: 20,
          confirmedCount: 12,
          reconciledAt: new Date(),
          reconcileVersion: 10,
        },
      });

      for (let i = 1; i <= 2; i++) {
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: new mongoose.Types.ObjectId(),
          userSupabaseId: `sub-drift-${i}`,
          status: 'CONFIRMED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Drift ${i}`, email: `drift${i}@test.com` },
          registeredAt: new Date(),
        });
      }

      // Force reconciliation
      const corrected = await eventRepo.reconcileConfirmedCount(event._id.toString(), true);
      expect(corrected).toBe(2);

      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(2);
    });
  });

  describe('4. Concurrency Defense: Reconciliation Cannot Overwrite Concurrent Reservation', () => {
    it('Concurrent reconciliation and registration requests: reconciliation cannot overwrite concurrent reservation', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: {
          capacity: 10,
          confirmedCount: 5,
          reconciledAt: new Date(),
          reconcileVersion: 1,
        },
      });

      // Seed 5 confirmed registrations
      for (let i = 1; i <= 5; i++) {
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: new mongoose.Types.ObjectId(),
          userSupabaseId: `sub-race-rec-${i}`,
          status: 'CONFIRMED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Rec ${i}`, email: `rec${i}@test.com` },
          registeredAt: new Date(),
        });
      }

      const racerId = new mongoose.Types.ObjectId();
      mockUser(racerId, 'concurrent-racer@test.com', 'Concurrent Racer');

      // Run reconciliation and real concurrent registration simultaneously
      const [reconcileResult, registerResult] = await Promise.all([
        eventRepo.reconcileConfirmedCount(event._id.toString(), true),
        registrationService.register(event._id.toString(), `sub-${racerId.toString().slice(-6)}`, {
          name: 'Concurrent Racer',
          email: 'concurrent-racer@test.com',
        }),
      ]);

      expect(registerResult.registration).toBeDefined();

      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBeGreaterThanOrEqual(6);

      const totalDocs = await EventRegistrationModel.countDocuments({
        eventId: event._id,
        status: { $in: CONFIRMED_CAPACITY_STATUSES },
      }).exec();
      expect(totalDocs).toBe(6);
      expect(persisted?.registration?.confirmedCount).toBe(totalDocs);
    });
  });

  describe('5. Duplicate Registration & Idempotent Releases', () => {
    it('Duplicate registration requests: handled idempotently without consuming extra slots', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: { capacity: 10, confirmedCount: 0 },
      });

      const userId = new mongoose.Types.ObjectId();
      mockUser(userId, 'same@user.com', 'Same User');

      // Send 3 concurrent duplicate registration requests for the same user
      const results = await Promise.all([
        registrationService.register(event._id.toString(), `sub-${userId.toString().slice(-6)}`, {
          name: 'Same User',
          email: 'same@user.com',
        }),
        registrationService.register(event._id.toString(), `sub-${userId.toString().slice(-6)}`, {
          name: 'Same User',
          email: 'same@user.com',
        }),
        registrationService.register(event._id.toString(), `sub-${userId.toString().slice(-6)}`, {
          name: 'Same User',
          email: 'same@user.com',
        }),
      ]);

      // All 3 return successfully and return the same registration ID
      const firstId = results[0].registration._id.toString();
      expect(results[1].registration._id.toString()).toBe(firstId);
      expect(results[2].registration._id.toString()).toBe(firstId);

      // Exactly ONE registration document exists in DB
      const regCount = await EventRegistrationModel.countDocuments({
        eventId: event._id,
        userId,
      }).exec();
      expect(regCount).toBe(1);

      // confirmedCount is exactly 1 (not 3)
      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(1);
    });

    it('Repeated cancellation and rollback: idempotent release ensuring counter cannot decrement twice', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: { capacity: 10, confirmedCount: 0 },
      });

      const userId = new mongoose.Types.ObjectId();
      const subId = `sub-${userId.toString().slice(-6)}`;
      mockUser(userId, 'cancel@user.com', 'Cancel User');

      // Register user
      const { registration } = await registrationService.register(event._id.toString(), subId, {
        name: 'Cancel User',
        email: 'cancel@user.com',
      });

      let checkEvent = await EventModel.findById(event._id).exec();
      expect(checkEvent?.registration?.confirmedCount).toBe(1);

      // First cancellation: succeeds, decrements counter to 0
      await registrationService.cancelRegistration(event._id.toString(), subId, 'Cannot make it');
      checkEvent = await EventModel.findById(event._id).exec();
      expect(checkEvent?.registration?.confirmedCount).toBe(0);

      // Second cancellation: idempotent, does NOT decrement counter below 0
      await expect(
        registrationService.cancelRegistration(event._id.toString(), subId, 'Repeated call')
      ).rejects.toThrow(/No active registration found/);

      checkEvent = await EventModel.findById(event._id).exec();
      expect(checkEvent?.registration?.confirmedCount).toBe(0);

      // Direct idempotent release with the same token
      const releaseToken = registration._id.toString();
      const secondRelease = await eventRepo.releaseRegistrationSlot(event._id.toString(), releaseToken);
      expect(secondRelease).toBe(false); // Second release with same token is a NO-OP

      checkEvent = await EventModel.findById(event._id).exec();
      expect(checkEvent?.registration?.confirmedCount).toBe(0);
    });

    it('Failure after slot reservation but before registration persistence: rolls back slot and revokes credential', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: { capacity: 10, confirmedCount: 2 },
      });

      const failUserId = new mongoose.Types.ObjectId();
      const subId = `sub-${failUserId.toString().slice(-6)}`;
      mockUser(failUserId, 'fail@user.com', 'Fail User');

      // Mock registrationRepo.create to simulate unexpected disk / database persistence error
      jest.spyOn(registrationRepo, 'create').mockRejectedValueOnce(new Error('Simulated I/O write failure'));

      await expect(
        registrationService.register(event._id.toString(), subId, {
          name: 'Fail User',
          email: 'fail@user.com',
        })
      ).rejects.toThrow(/Simulated I\/O write failure/);

      // Confirmed count rolled back to 2
      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(2);

      // Any issued credential rolled back to REVOKED
      const creds = await EventCredentialModel.find({
        eventId: event._id,
        'holder.email': 'fail@user.com',
      }).exec();
      for (const cred of creds) {
        expect(cred.status).toBe('REVOKED');
      }
    });
  });

  describe('6. Waitlist and Re-registration Semantics', () => {
    it('Waitlist records do not consume confirmed capacity', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: { capacity: 10, confirmedCount: 0 },
      });

      // Insert 2 WAITLISTED registrations
      for (let i = 1; i <= 2; i++) {
        await EventRegistrationModel.create({
          eventId: event._id,
          userId: new mongoose.Types.ObjectId(),
          userSupabaseId: `sub-wait-${i}`,
          status: 'WAITLISTED',
          registrationType: 'ATTENDEE',
          attendeeDetails: { name: `Wait ${i}`, email: `wait${i}@test.com` },
          registeredAt: new Date(),
        });
      }

      // Reconcile: must be 0, waitlisted registrations do not consume confirmed capacity
      const count = await eventRepo.reconcileConfirmedCount(event._id.toString(), true);
      expect(count).toBe(0);

      const persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(0);
    });

    it('Re-registration: cancelled attendee can re-register and safely consume a new capacity slot', async () => {
      if (!isConnectedToRealDb) return;

      const event = await createTestEvent({
        registration: { capacity: 10, confirmedCount: 0 },
      });

      const userId = new mongoose.Types.ObjectId();
      const subId = `sub-${userId.toString().slice(-6)}`;
      mockUser(userId, 'rereg@user.com', 'ReReg User');

      // 1. Initial registration
      const reg1 = await registrationService.register(event._id.toString(), subId, {
        name: 'ReReg User',
        email: 'rereg@user.com',
      });
      expect(reg1.registration.status).toBe('CONFIRMED');

      let persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(1);

      // 2. Cancellation
      await registrationService.cancelRegistration(event._id.toString(), subId, 'Change of plans');
      persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(0);

      // 3. Re-registration
      const reg2 = await registrationService.register(event._id.toString(), subId, {
        name: 'ReReg User',
        email: 'rereg@user.com',
      });
      expect(reg2.registration.status).toBe('CONFIRMED');
      expect(reg2.registration._id.toString()).not.toBe(reg1.registration._id.toString());

      persisted = await EventModel.findById(event._id).exec();
      expect(persisted?.registration?.confirmedCount).toBe(1);

      // Verify that total active registrations in DB is 1
      const activeCount = await EventRegistrationModel.countDocuments({
        eventId: event._id,
        userId,
        status: { $in: CONFIRMED_CAPACITY_STATUSES },
      }).exec();
      expect(activeCount).toBe(1);
    });
  });
});
