const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
  supabasePublic: null,
}));

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { eventLifecycleService } from '../src/modules/events/services/event-lifecycle.service';
import { createJwtToken } from '../src/utils/local-auth';

describe('Phase 6: Event Lifecycle Engine', () => {
  const hostUser = {
    id: 'mock-host-uuid-phase6',
    email: 'host.phase6@university.edu',
    role: 'USER' as const,
  };
  const intruderUser = {
    id: 'mock-intruder-uuid-phase6',
    email: 'intruder@other.edu',
    role: 'USER' as const,
  };
  const adminUser = {
    id: 'mock-admin-uuid-phase6',
    email: 'platform.admin@ticketification.com',
    role: 'ADMIN' as const,
  };

  const hostToken = createJwtToken(hostUser);
  const intruderToken = createJwtToken(intruderUser);
  const adminToken = createJwtToken(adminUser);

  const hostMongoId = new mongoose.Types.ObjectId();
  const intruderMongoId = new mongoose.Types.ObjectId();
  const adminMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();

    // Default Approved & Verified event ready for publishing
    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Hackathon Summit 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Campus Auditorium', city: 'Bengaluru', country: 'India' },
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        timezone: 'Asia/Kolkata',
      },
      registration: { pricingModel: 'FREE', registrationRequired: true, capacity: 500 },
      status: 'APPROVED',
      verificationStatus: 'VERIFIED',
      verificationLevel: 'LOW',
      statusHistory: [],
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) {
        return { data: { user: { id: hostUser.id, email: hostUser.email, user_metadata: { name: 'Lead Host' } } }, error: null };
      }
      if (token === intruderToken) {
        return { data: { user: { id: intruderUser.id, email: intruderUser.email, user_metadata: { name: 'Intruder' } } }, error: null };
      }
      if (token === adminToken) {
        return { data: { user: { id: adminUser.id, email: adminUser.email, user_metadata: { name: 'Platform Admin' } } }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    const userMap: Record<string, any> = {
      [hostUser.id]: {
        _id: hostMongoId,
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Lead Host',
        platformRole: 'USER',
        status: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
      },
      [intruderUser.id]: {
        _id: intruderMongoId,
        supabaseUserId: intruderUser.id,
        email: intruderUser.email,
        name: 'Intruder',
        platformRole: 'USER',
        status: 'ACTIVE',
        workspaceStatus: 'ACTIVE',
      },
      [adminUser.id]: {
        _id: adminMongoId,
        supabaseUserId: adminUser.id,
        email: adminUser.email,
        name: 'Platform Admin',
        platformRole: 'ADMIN',
        status: 'ACTIVE',
      },
    };

    // Mock PostgreSQL user repository
    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Lead Host', email: hostUser.email, role: 'USER' };
      if (id === intruderUser.id) return { id: intruderUser.id, name: 'Intruder', email: intruderUser.email, role: 'USER' };
      if (id === adminUser.id) return { id: adminUser.id, name: 'Platform Admin', email: adminUser.email, role: 'ADMIN' };
      return null;
    });

    // Mock Mongo user repository
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    // Mock Mongo Event repository
    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventRepository, 'findByIdAndOwner').mockImplementation(
      async (id: any, ownerSupabaseId: string): Promise<any> => {
        const found = mockEvents.get(id.toString());
        if (found && found.ownerSupabaseId === ownerSupabaseId) return found;
        return null;
      }
    );

    jest.spyOn(mongoEventRepository, 'transitionStatus').mockImplementation(
      async (id: any, newStatus: any, historyEntry: any, extraUpdates: any = {}): Promise<any> => {
        const existing = mockEvents.get(id.toString());
        if (!existing) return null;
        existing.status = newStatus;
        if (!existing.statusHistory) existing.statusHistory = [];
        existing.statusHistory.push(historyEntry);
        Object.assign(existing, extraUpdates);
        mockEvents.set(id.toString(), existing);
        return existing;
      }
    );
  });

  describe('1. Legal Lifecycle Progression Flow', () => {
    it('should successfully publish an approved and verified event', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/publish`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');

      const saved = mockEvents.get(testEventId.toString());
      expect(saved.status).toBe('PUBLISHED');
      expect(saved.statusHistory.length).toBe(1);
      expect(saved.statusHistory[0].toStatus).toBe('PUBLISHED');
    });

    it('should open registrations from PUBLISHED status', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'PUBLISHED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/registrations/open`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REGISTRATION_OPEN');
    });

    it('should close registrations from REGISTRATION_OPEN status', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'REGISTRATION_OPEN';

      const res = await request(app)
        .post(`/api/events/${testEventId}/registrations/close`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REGISTRATION_CLOSED');
    });

    it('should mark event live from REGISTRATION_CLOSED status', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'REGISTRATION_CLOSED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/live`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('EVENT_LIVE');
    });

    it('should reject host attempting to complete event (HTTP 403) and allow platform admin', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'EVENT_LIVE';

      // 1. Host attempt must be rejected with 403 Forbidden
      const hostRes = await request(app)
        .post(`/api/events/${testEventId}/complete`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(hostRes.status).toBe(403);

      // 2. Platform Admin attempt must succeed
      const adminRes = await request(app)
        .post(`/api/events/${testEventId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.data.status).toBe('COMPLETED');
    });

    it('should reject host attempting to archive event (HTTP 403) and allow platform admin', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'COMPLETED';

      // 1. Host attempt must be rejected with 403 Forbidden
      const hostRes = await request(app)
        .post(`/api/events/${testEventId}/archive`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(hostRes.status).toBe(403);

      // 2. Platform Admin attempt must succeed
      const adminRes = await request(app)
        .post(`/api/events/${testEventId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
      expect(adminRes.body.data.status).toBe('ARCHIVED');
    });
  });

  describe('2. Illegal Transition & Gate Enforcement', () => {
    it('should reject direct publishing from DRAFT status with HTTP 400', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'DRAFT';

      const res = await request(app)
        .post(`/api/events/${testEventId}/publish`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain("Invalid status transition from 'DRAFT' to 'PUBLISHED'");
    });

    it('should reject publishing an APPROVED event if verificationStatus is not VERIFIED', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'APPROVED';
      event.verificationStatus = 'UNVERIFIED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/publish`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain('officially verified and approved before it can be published');
    });

    it('should reject mutating an ARCHIVED event (terminal state)', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'ARCHIVED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/registrations/open`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(400);
      const errMsg = res.body.message || res.body.error?.message || res.body.error;
      expect(errMsg).toContain("Invalid status transition from 'ARCHIVED'");
    });
  });

  describe('3. Host Cancellation Workflow', () => {
    it('should allow host to cancel event with a valid cancellation reason', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'PUBLISHED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/cancel`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ reason: 'Severe weather alert in the region.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');

      const saved = mockEvents.get(testEventId.toString());
      expect(saved.status).toBe('CANCELLED');
      expect(saved.cancellationReason).toBe('Severe weather alert in the region.');
      expect(saved.cancelledAt).toBeDefined();
    });

    it('should reject cancellation without a reason with HTTP 400', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'PUBLISHED';

      const res = await request(app)
        .post(`/api/events/${testEventId}/cancel`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('4. Zero-Trust IDOR Protection', () => {
    it('should reject non-owner attempting to transition lifecycle (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/publish`)
        .set('Authorization', `Bearer ${intruderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('5. Platform Administrator Circuit Breaker (Suspension & Reinstatement)', () => {
    it('should reject non-admin attempting to suspend event (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/admin/events/${testEventId}/suspend`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ reason: 'Security check' });

      expect(res.status).toBe(403);
    });

    it('should allow platform admin to suspend an active event with reason', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'PUBLISHED';

      const res = await request(app)
        .post(`/api/admin/events/${testEventId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Reported payment gateway anomalies' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUSPENDED');

      const saved = mockEvents.get(testEventId.toString());
      expect(saved.status).toBe('SUSPENDED');
      expect(saved.suspensionReason).toBe('Reported payment gateway anomalies');
      expect(saved.suspendedAt).toBeDefined();
    });

    it('should allow platform admin to reinstate a suspended event', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.status = 'SUSPENDED';
      event.suspensionReason = 'Reported payment gateway anomalies';

      const res = await request(app)
        .post(`/api/admin/events/${testEventId}/reinstate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetStatus: 'PUBLISHED', reason: 'Audit completed and verified' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('PUBLISHED');

      const saved = mockEvents.get(testEventId.toString());
      expect(saved.status).toBe('PUBLISHED');
      expect(saved.suspensionReason).toBeNull();
    });
  });

  describe('6. Immutable Status History Audit Trail', () => {
    it('should retrieve status history for event owner', async () => {
      const event = mockEvents.get(testEventId.toString());
      event.statusHistory = [
        {
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          changedBy: hostMongoId,
          changedBySupabaseId: hostUser.id,
          reason: 'Verification submitted',
          timestamp: new Date(),
        },
        {
          fromStatus: 'SUBMITTED',
          toStatus: 'APPROVED',
          changedBy: adminMongoId,
          changedBySupabaseId: adminUser.id,
          reason: 'Verification approved',
          timestamp: new Date(),
        },
      ];

      const res = await request(app)
        .get(`/api/events/${testEventId}/lifecycle/history`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.statusHistory.length).toBe(2);
      expect(res.body.data.currentStatus).toBe('APPROVED');
    });
  });
});
