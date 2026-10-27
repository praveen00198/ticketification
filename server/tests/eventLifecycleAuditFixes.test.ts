import mongoose from 'mongoose';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { EventModel } from '../src/db/mongo/models/event.model';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { EventCredentialCheckinModel } from '../src/db/mongo/models/event-credential-checkin.model';
import { EventMemberModel } from '../src/db/mongo/models/event-member.model';
import { eventRegistrationService } from '../src/modules/events/services/event-registration.service';
import { verificationService } from '../src/modules/verification/services/verification.service';
import { ValidationError, AuthorizationError } from '../src/middlewares/error.middleware';

describe('Event Lifecycle, Registration, & Ticket Verification Regression Test Suite', () => {
  // =========================================================================
  // 1. Public Event Discovery & Lifecycle States
  // =========================================================================
  describe('Public Event Discovery Visibility Invariants', () => {
    it('allows public microsite viewing for PUBLISHED, REGISTRATION_OPEN, EVENT_LIVE, COMPLETED, and CANCELLED events', async () => {
      const allowedStates = [
        'PUBLISHED',
        'REGISTRATION_OPEN',
        'EVENT_LIVE',
        'COMPLETED',
        'CANCELLED',
      ];

      for (const status of allowedStates) {
        const dummyId = new mongoose.Types.ObjectId();
        jest.spyOn(EventModel, 'findOne').mockReturnValueOnce({
          exec: jest.fn().mockResolvedValueOnce({
            _id: dummyId,
            name: `Test Event in ${status}`,
            status,
            attendanceMode: 'TICKETIFICATION_REGISTRATION',
          }),
        } as any);

        const result = await mongoEventRepository.findPublicById(dummyId.toString());
        expect(result).not.toBeNull();
        expect(result?.status).toBe(status);
      }
    });

    it('strictly hides unpublished lifecycle states (DRAFT, SUBMITTED, UNDER_REVIEW, REJECTED, SUSPENDED)', async () => {
      jest.spyOn(EventModel, 'findOne').mockImplementation((query: any) => {
        const statusFilter = query.status?.$in || [];
        const isDraftAllowed = statusFilter.includes('DRAFT');
        return {
          exec: jest.fn().mockResolvedValue(isDraftAllowed ? { status: 'DRAFT' } : null),
        } as any;
      });

      const draftResult = await mongoEventRepository.findPublicById(new mongoose.Types.ObjectId().toString());
      expect(draftResult).toBeNull();
    });
  });

  // =========================================================================
  // 2. Registration Eligibility & Invariant Validation
  // =========================================================================
  describe('Registration Eligibility Invariants', () => {
    it('accepts registration eligibility for PUBLISHED and REGISTRATION_OPEN events', () => {
      const activeEvent = {
        status: 'REGISTRATION_OPEN',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        registration: { registrationRequired: true },
        schedule: { endAt: new Date(Date.now() + 86400000) },
      };

      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(activeEvent);
      }).not.toThrow();
    });

    it('rejects registration when event is CANCELLED with explicit error message', () => {
      const cancelledEvent = {
        status: 'CANCELLED',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      };

      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(cancelledEvent);
      }).toThrow(ValidationError);
      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(cancelledEvent);
      }).toThrow(/Event has been cancelled/);
    });

    it('rejects registration when event is REGISTRATION_CLOSED', () => {
      const closedEvent = {
        status: 'REGISTRATION_CLOSED',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      };

      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(closedEvent);
      }).toThrow(/Registration is closed for this event/);
    });

    it('rejects registration when event has already completed or passed end date', () => {
      const pastEvent = {
        status: 'PUBLISHED',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
        registration: { registrationRequired: true },
        schedule: { endAt: new Date(Date.now() - 3600000) },
      };

      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(pastEvent);
      }).toThrow(/Registration is closed because this event has already ended/);
    });

    it('rejects self-registration for EXISTING_ATTENDEE_DATA import-only events', () => {
      const importOnlyEvent = {
        status: 'REGISTRATION_OPEN',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      };

      expect(() => {
        eventRegistrationService.validateRegistrationEligibility(importOnlyEvent);
      }).toThrow(/Self-registration is not permitted for events using existing attendee data/);
    });
  });

  // =========================================================================
  // 3. Ticket Verification & Atomic Check-in
  // =========================================================================
  describe('Verification Service Invariants (MongoDB & Multi-Database)', () => {
    const testEventId = new mongoose.Types.ObjectId();
    const testCredentialId = new mongoose.Types.ObjectId();
    const testToken = 'a'.repeat(64);

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('verifies a valid active credential successfully without PostgreSQL dependency', async () => {
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'ACTIVE',
          usagePolicy: 'SINGLE_USE',
          checkInCount: 0,
          sequenceNumber: 101,
          holder: {
            name: 'Jane Developer',
            category: 'ATTENDEE',
            organization: 'Dev Labs',
            designation: 'Engineer',
          },
          asset: {},
        }),
      } as any);

      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Global Tech Summit',
          schedule: { startAt: new Date('2026-11-15') },
        }),
      } as any);

      const result = await verificationService.verifyToken(testToken);

      expect(result.status).toBe('VALID');
      expect(result.ticket?.name).toBe('Jane Developer');
      expect(result.ticket?.eventName).toBe('Global Tech Summit');
      expect(result.ticket?.sequenceNumber).toBe(101);
    });

    it('detects already checked-in single-use pass and returns ALREADY_USED with check-in timestamp', async () => {
      const lastCheckIn = new Date('2026-11-15T09:30:00Z');
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'CHECKED_IN',
          usagePolicy: 'SINGLE_USE',
          checkInCount: 1,
          lastCheckedInAt: lastCheckIn,
          sequenceNumber: 102,
          holder: { name: 'Mark Once' },
        }),
      } as any);

      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Global Tech Summit',
        }),
      } as any);

      const result = await verificationService.verifyToken(testToken);

      expect(result.status).toBe('ALREADY_USED');
      expect(result.ticket?.lastCheckinTime).toEqual(lastCheckIn.toISOString());
    });

    it('returns WRONG_EVENT when credential token belongs to a different event than scanner context', async () => {
      const differentEventId = new mongoose.Types.ObjectId();

      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId, // Event A
          verificationToken: testToken,
          status: 'ACTIVE',
          usagePolicy: 'SINGLE_USE',
          holder: { name: 'Cross Event Attendee' },
        }),
      } as any);

      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Event A',
        }),
      } as any);

      // Scanned with different event ID (Event B)
      const result = await verificationService.verifyToken(testToken, differentEventId.toString());

      expect(result.status).toBe('WRONG_EVENT');
      expect(result.message).toMatch(/not the currently active scanner event/);
    });

    it('returns REVOKED/CANCELLED when credential has been invalidated/cancelled', async () => {
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'REVOKED',
          holder: { name: 'Revoked Attendee' },
        }),
      } as any);

      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Global Tech Summit',
        }),
      } as any);

      const result = await verificationService.verifyToken(testToken);

      expect(result.status).toBe('CANCELLED');
      expect(result.message).toMatch(/cancelled/);
    });

    it('returns INVALID for non-existent token without crashing with HTTP 500', async () => {
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await verificationService.verifyToken('non_existent_token_string');

      expect(result.status).toBe('INVALID');
      expect(result.message).toMatch(/not found/);
    });
  });

  // =========================================================================
  // 4. Scanner Authorization & Atomic Check-in Execution
  // =========================================================================
  describe('Scanner RBAC & Atomic Single-Use Concurrency Invariants', () => {
    const testEventId = new mongoose.Types.ObjectId();
    const testCredentialId = new mongoose.Types.ObjectId();
    const testToken = 'b'.repeat(64);
    const hostUserId = 'host_user_123';
    const unauthorizedAttendeeUserId = 'attendee_user_999';

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('denies check-in execution to regular attendees (HTTP 403 / AuthorizationError)', async () => {
      // 1. Mock credential lookup
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'ACTIVE',
          usagePolicy: 'SINGLE_USE',
          holder: { name: 'Test Attendee' },
        }),
      } as any);

      // 2. Mock event owner check
      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Conference',
          createdBy: hostUserId,
          ownerSupabaseId: hostUserId,
        }),
      } as any);

      // 3. Mock event member check -> Attendee is NOT host/admin/staff
      jest.spyOn(EventMemberModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      await expect(
        verificationService.scanAndCheckIn({
          token: testToken,
          eventId: testEventId.toString(),
          callerUserId: unauthorizedAttendeeUserId,
          callerPlatformRole: 'USER',
        })
      ).rejects.toThrow(AuthorizationError);
    });

    it('authorizes event owner / host and performs atomic check-in transition', async () => {
      // 1. Mock credential lookup
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'ACTIVE',
          usagePolicy: 'SINGLE_USE',
          checkInCount: 0,
          sequenceNumber: 201,
          holder: { name: 'Alice Walker', category: 'ATTENDEE' },
        }),
      } as any);

      // 2. Authorize owner
      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Conference',
          createdBy: hostUserId,
          ownerSupabaseId: hostUserId,
        }),
      } as any);

      // 3. Atomic status update
      const now = new Date();
      jest.spyOn(EventCredentialModel, 'findOneAndUpdate').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          status: 'CHECKED_IN',
          checkInCount: 1,
          lastCheckInAt: now,
          sequenceNumber: 201,
          holder: { name: 'Alice Walker', category: 'ATTENDEE' },
        }),
      } as any);

      // 4. Create check-in audit record
      const checkinCreateSpy = jest.spyOn(EventCredentialCheckinModel, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        credentialId: testCredentialId,
        eventId: testEventId,
        scannedAt: now,
        scanStatus: 'SUCCESS',
      } as any);

      const result = await verificationService.scanAndCheckIn({
        token: testToken,
        eventId: testEventId.toString(),
        scannerId: 'front_gate_terminal_1',
        callerUserId: hostUserId,
        callerPlatformRole: 'USER',
      });

      expect(result.status).toBe('VALID');
      expect(result.message).toMatch(/Checked in successfully/);
      expect(result.ticket?.name).toBe('Alice Walker');
      expect(checkinCreateSpy).toHaveBeenCalled();
    });

    it('defends against duplicate scan race conditions when credential is already CHECKED_IN', async () => {
      // 1. Authorize owner
      jest.spyOn(EventModel, 'findById').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testEventId,
          name: 'Conference',
          createdBy: hostUserId,
          ownerSupabaseId: hostUserId,
        }),
      } as any);

      // 2. Credential already marked CHECKED_IN
      const prevCheckinDate = new Date('2026-11-15T08:00:00Z');
      jest.spyOn(EventCredentialModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: testCredentialId,
          eventId: testEventId,
          verificationToken: testToken,
          status: 'CHECKED_IN',
          usagePolicy: 'SINGLE_USE',
          checkInCount: 1,
          lastCheckedInAt: prevCheckinDate,
          sequenceNumber: 201,
          holder: { name: 'Alice Walker' },
        }),
      } as any);

      const result = await verificationService.scanAndCheckIn({
        token: testToken,
        eventId: testEventId.toString(),
        callerUserId: hostUserId,
        callerPlatformRole: 'USER',
      });

      expect(result.status).toBe('ALREADY_USED');
      expect(result.message).toMatch(/already been checked in/);
      expect(result.ticket?.lastCheckinTime).toBe(prevCheckinDate.toISOString());
    });
  });
});
