import mongoose from 'mongoose';
import { EventRegistrationService } from '../src/modules/events/services/event-registration.service';
import { MongoEventRegistrationRepository } from '../src/modules/events/repositories/mongo-event-registration.repository';
import { MongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { MongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { MongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';
import { EventCredentialService } from '../src/modules/events/services/event-credential.service';
import { ValidationError } from '../src/middlewares/error.middleware';

describe('Event Registration Concurrency, Capacity & Lifecycle Governance', () => {
  jest.setTimeout(30000);
  const eventId = new mongoose.Types.ObjectId().toString();

  let registrationRepo: MongoEventRegistrationRepository;
  let eventRepo: MongoEventRepository;
  let userRepo: MongoUserRepository;
  let credentialRepo: MongoEventCredentialRepository;
  let teamRepo: MongoEventTeamRepository;
  let credentialService: EventCredentialService;
  let service: EventRegistrationService;

  let inMemoryRegistrations: Map<string, any>;
  let inMemoryCredentials: Map<string, any>;
  let inMemoryConfirmedCount: number;
  let eventCapacity: number;

  beforeEach(() => {
    jest.clearAllMocks();
    inMemoryRegistrations = new Map();
    inMemoryCredentials = new Map();
    inMemoryConfirmedCount = 0;
    eventCapacity = 5;

    registrationRepo = new MongoEventRegistrationRepository();
    eventRepo = new MongoEventRepository();
    userRepo = new MongoUserRepository();
    credentialRepo = new MongoEventCredentialRepository();
    teamRepo = new MongoEventTeamRepository();
    credentialService = new EventCredentialService();

    // Mock Credential Repo lookup
    jest.spyOn(credentialRepo, 'findById').mockImplementation(async (id: string) => {
      return inMemoryCredentials.get(id.toString()) || null;
    });
    jest.spyOn(credentialRepo, 'findByEmail').mockImplementation(async () => []);

    // Mock Event Repo
    jest.spyOn(eventRepo, 'findById').mockImplementation(async () => {
      return {
        _id: new mongoose.Types.ObjectId(eventId),
        name: 'Quantum Hackathon 2026',
        status: 'PUBLISHED',
        credentialTerminology: 'Hacker Pass',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        registration: { capacity: eventCapacity, confirmedCount: inMemoryConfirmedCount, registrationRequired: true },
        schedule: {
          startAt: new Date(Date.now() + 3600000),
          endAt: new Date(Date.now() + 86400000),
          timezone: 'UTC',
        },
      } as any;
    });

    // Mock Atomic Slot Reservation
    jest.spyOn(eventRepo, 'reserveRegistrationSlot').mockImplementation(async (_eId: string, cap?: number) => {
      if (cap && cap > 0) {
        if (inMemoryConfirmedCount >= cap) {
          return false;
        }
        inMemoryConfirmedCount++;
        return true;
      }
      inMemoryConfirmedCount++;
      return true;
    });

    // Mock Slot Release
    jest.spyOn(eventRepo, 'releaseRegistrationSlot').mockImplementation(async () => {
      if (inMemoryConfirmedCount > 0) {
        inMemoryConfirmedCount--;
      }
    });

    // Mock Registration Repo count
    jest.spyOn(registrationRepo, 'countByEvent').mockImplementation(async () => {
      return Array.from(inMemoryRegistrations.values()).filter((r) => r.status === 'CONFIRMED').length;
    });

    // Mock Registration Repo findByEventAndUser
    jest.spyOn(registrationRepo, 'findByEventAndUser').mockImplementation(async (_eId: string, uId: any) => {
      for (const reg of inMemoryRegistrations.values()) {
        if (reg.userId.toString() === uId.toString() && reg.status !== 'CANCELLED') {
          return reg;
        }
      }
      return null;
    });

    // Mock Registration Repo create
    jest.spyOn(registrationRepo, 'create').mockImplementation(async (data: any) => {
      // Check unique constraint in memory: eventId + userId or eventId + email
      for (const reg of inMemoryRegistrations.values()) {
        if (
          reg.status === 'CONFIRMED' &&
          (reg.userId.toString() === data.userId.toString() ||
            reg.attendeeDetails.email.toLowerCase() === data.attendeeDetails.email.toLowerCase())
        ) {
          const err: any = new Error('E11000 duplicate key error collection: event_registrations');
          err.code = 11000;
          throw err;
        }
      }

      const id = new mongoose.Types.ObjectId();
      const doc = { _id: id, ...data, createdAt: new Date() };
      inMemoryRegistrations.set(id.toString(), doc);
      return doc as any;
    });

    // Mock Registration Repo updateStatus
    jest.spyOn(registrationRepo, 'updateStatus').mockImplementation(async (id: string, _eId: string, status: any) => {
      const reg = inMemoryRegistrations.get(id);
      if (reg) {
        reg.status = status;
      }
      return reg;
    });

    // Mock Credential Service
    jest.spyOn(credentialService, 'issueRegistrationCredential').mockImplementation(async () => {
      const id = new mongoose.Types.ObjectId();
      const cred = {
        _id: id,
        eventId: new mongoose.Types.ObjectId(eventId),
        formattedId: `HCK-${id.toString().slice(-5)}`,
        status: 'ACTIVE',
      };
      inMemoryCredentials.set(id.toString(), cred);
      return cred as any;
    });

    // Mock Credential Repo updateStatus
    jest.spyOn(credentialRepo, 'updateStatus').mockImplementation(async (_eId: string, cId: string, status: any) => {
      const cred = inMemoryCredentials.get(cId);
      if (cred) {
        cred.status = status;
      }
      return cred;
    });

    service = new EventRegistrationService(
      registrationRepo,
      eventRepo,
      userRepo,
      credentialRepo,
      teamRepo,
      credentialService
    );
  });

  describe('1. Normal Registration & Idempotency', () => {
    it('successfully registers an attendee and issues credential', async () => {
      const userMongoId = new mongoose.Types.ObjectId();
      jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseId: 'sub-user-1',
        name: 'Alice',
        email: 'alice@quantum.io',
      } as any);

      const result = await service.register(eventId, 'sub-user-1', {
        name: 'Alice',
        email: 'alice@quantum.io',
      });

      expect(result.registration).toBeDefined();
      expect(result.registration.status).toBe('CONFIRMED');
      expect(result.credential).toBeDefined();
      expect(inMemoryConfirmedCount).toBe(1);
    });

    it('returns existing registration idempotently when user re-registers', async () => {
      const userMongoId = new mongoose.Types.ObjectId();
      jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseId: 'sub-user-1',
        name: 'Alice',
        email: 'alice@quantum.io',
      } as any);

      const first = await service.register(eventId, 'sub-user-1', {
        name: 'Alice',
        email: 'alice@quantum.io',
      });

      const second = await service.register(eventId, 'sub-user-1', {
        name: 'Alice',
        email: 'alice@quantum.io',
      });

      expect(second.registration._id.toString()).toBe(first.registration._id.toString());
      expect(inMemoryConfirmedCount).toBe(1); // Capacity slot not doubled
    });
  });

  describe('2. Registration Capacity & Concurrency Control', () => {
    it('rejects registration once configured capacity limit is reached', async () => {
      eventCapacity = 2;

      for (let i = 1; i <= 2; i++) {
        const uId = new mongoose.Types.ObjectId();
        jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValueOnce({
          _id: uId,
          supabaseId: `user-${i}`,
          name: `User ${i}`,
          email: `user${i}@test.com`,
        } as any);

        await service.register(eventId, `user-${i}`, {
          name: `User ${i}`,
          email: `user${i}@test.com`,
        });
      }

      expect(inMemoryConfirmedCount).toBe(2);

      // Third attendee attempts to register
      const thirdUserId = new mongoose.Types.ObjectId();
      jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValueOnce({
        _id: thirdUserId,
        supabaseId: 'user-3',
        name: 'User 3',
        email: 'user3@test.com',
      } as any);

      await expect(
        service.register(eventId, 'user-3', {
          name: 'User 3',
          email: 'user3@test.com',
        })
      ).rejects.toThrow(/capacity limit/i);

      expect(inMemoryConfirmedCount).toBe(2);
    });

    it('handles concurrent requests competing for the last available slot without exceeding capacity', async () => {
      // Event capacity is 3. 2 slots already taken, exactly 1 slot left.
      eventCapacity = 3;
      inMemoryConfirmedCount = 2;

      // 5 concurrent requests race for the final 1 slot
      const concurrentUsers = [3, 4, 5, 6, 7].map((num) => ({
        _id: new mongoose.Types.ObjectId(),
        supabaseId: `sub-race-${num}`,
        name: `Racer ${num}`,
        email: `racer${num}@race.com`,
      }));

      const results = await Promise.allSettled(
        concurrentUsers.map((user) => {
          jest.spyOn(userRepo, 'findBySupabaseId').mockImplementation(async (subId: string) => {
            return concurrentUsers.find((u) => u.supabaseId === subId) as any;
          });

          return service.register(eventId, user.supabaseId, {
            name: user.name,
            email: user.email,
          });
        })
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly 1 winner should get the final slot
      expect(fulfilled.length).toBe(1);
      // The other 4 should be rejected due to capacity limit
      expect(rejected.length).toBe(4);
      // Confirmed count must NEVER exceed configured capacity of 3
      expect(inMemoryConfirmedCount).toBe(3);
    });

    it('rolls back slot reservation and credential when registration persistence fails', async () => {
      eventCapacity = 5;
      inMemoryConfirmedCount = 1;

      const userMongoId = new mongoose.Types.ObjectId();
      jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseId: 'user-fail',
        name: 'Fail User',
        email: 'fail@test.com',
      } as any);

      // Simulate unexpected persistence failure after slot reservation and credential creation
      jest.spyOn(registrationRepo, 'create').mockRejectedValueOnce(new Error('Disk write I/O error'));

      await expect(
        service.register(eventId, 'user-fail', {
          name: 'Fail User',
          email: 'fail@test.com',
        })
      ).rejects.toThrow(/Disk write I\/O error/);

      // Slot reservation rolled back to 1
      expect(inMemoryConfirmedCount).toBe(1);
    });

    it('releases capacity slot when a confirmed registration is cancelled', async () => {
      const userMongoId = new mongoose.Types.ObjectId();
      jest.spyOn(userRepo, 'findBySupabaseId').mockResolvedValue({
        _id: userMongoId,
        supabaseId: 'user-cancel',
        name: 'Cancel User',
        email: 'cancel@test.com',
      } as any);

      await service.register(eventId, 'user-cancel', {
        name: 'Cancel User',
        email: 'cancel@test.com',
      });
      expect(inMemoryConfirmedCount).toBe(1);

      // Attendee cancels registration
      await service.cancelRegistration(eventId, 'user-cancel', 'Cannot attend');
      expect(inMemoryConfirmedCount).toBe(0);
    });
  });

  describe('3. Event Lifecycle Registration Eligibility', () => {
    it('allows registration when event is PUBLISHED or REGISTRATION_OPEN', () => {
      expect(() =>
        service.validateRegistrationEligibility({
          status: 'PUBLISHED',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          registration: { registrationRequired: true },
        })
      ).not.toThrow();

      expect(() =>
        service.validateRegistrationEligibility({
          status: 'REGISTRATION_OPEN',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          registration: { registrationRequired: true },
        })
      ).not.toThrow();
    });

    it('rejects registration when event status is REGISTRATION_CLOSED', () => {
      expect(() =>
        service.validateRegistrationEligibility({
          status: 'REGISTRATION_CLOSED',
        })
      ).toThrow(/Registration is closed for this event/);
    });

    it('rejects registration when event is DRAFT, CANCELLED, SUSPENDED, or COMPLETED', () => {
      expect(() => service.validateRegistrationEligibility({ status: 'DRAFT' })).toThrow(
        /not published/
      );
      expect(() => service.validateRegistrationEligibility({ status: 'CANCELLED' })).toThrow(
        /cancelled/
      );
      expect(() => service.validateRegistrationEligibility({ status: 'SUSPENDED' })).toThrow(
        /suspended/
      );
      expect(() => service.validateRegistrationEligibility({ status: 'COMPLETED' })).toThrow(
        /completed/
      );
    });

    it('rejects registration when event attendanceMode is EXISTING_ATTENDEE_DATA', () => {
      expect(() =>
        service.validateRegistrationEligibility({
          status: 'PUBLISHED',
          attendanceMode: 'EXISTING_ATTENDEE_DATA',
        })
      ).toThrow(/Self-registration is not permitted for events using existing attendee data/);
    });

    it('rejects registration when event registrationRequired is false', () => {
      expect(() =>
        service.validateRegistrationEligibility({
          status: 'PUBLISHED',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          registration: { registrationRequired: false },
        })
      ).toThrow(/Registration is not enabled for this event/);
    });

    it('rejects registration when event schedule endAt has already passed', () => {
      expect(() =>
        service.validateRegistrationEligibility({
          status: 'PUBLISHED',
          attendanceMode: 'TICKETIFICATION_REGISTRATION',
          registration: { registrationRequired: true },
          schedule: {
            startAt: new Date(Date.now() - 7200000),
            endAt: new Date(Date.now() - 3600000), // Ended 1 hour ago
          },
        })
      ).toThrow(/event has already ended/);
    });
  });
});
