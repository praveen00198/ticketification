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
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';

describe('Phase 12: Credential Architecture & Abstraction Engine', () => {
  const hostUser = { id: 'mock-host-uuid-phase12', email: 'host.phase12@conference.org' };
  const coordinatorUser = { id: 'mock-coord-uuid-phase12', email: 'coord.phase12@conference.org' };
  const outsiderUser = { id: 'mock-out-uuid-phase12', email: 'outsider.phase12@random.org' };

  const hostToken = 'valid-host-token-phase12';
  const coordinatorToken = 'valid-coord-token-phase12';
  const outsiderToken = 'valid-out-token-phase12';

  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const coordinatorMemberId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockCredentials: Map<string, any>;
  let sequenceCounters: Map<string, number>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockCredentials = new Map();
    sequenceCounters = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Global Tech Summit 2026',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Delegate Badge',
      venue: { type: 'PHYSICAL', name: 'Convention Hall A' },
      schedule: { startAt: new Date('2026-11-15T09:00:00Z'), endAt: new Date('2026-11-16T18:00:00Z'), timezone: 'UTC' },
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockMembers.set(coordinatorMemberId.toString(), {
      _id: coordinatorMemberId,
      eventId: testEventId,
      userId: coordinatorMongoId,
      userEmail: coordinatorUser.email,
      role: 'COORDINATOR',
      permissions: ['MANAGE_ATTENDEES'],
      status: 'ACTIVE',
    });

    // Mock Supabase Auth
    mockGetUser.mockImplementation(async (token: string) => {
      if (token === hostToken) return { data: { user: hostUser }, error: null };
      if (token === coordinatorToken) return { data: { user: coordinatorUser }, error: null };
      if (token === outsiderToken) return { data: { user: outsiderUser }, error: null };
      return { data: { user: null }, error: { message: 'Invalid token' } };
    });

    // Mock User Repositories
    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, name: 'Coordinator', email: coordinatorUser.email, role: 'USER' };
      if (id === outsiderUser.id) return { id: outsiderUser.id, name: 'Outsider', email: outsiderUser.email, role: 'USER' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (supaId: string): Promise<any> => {
      if (supaId === hostUser.id) return { _id: hostMongoId, supabaseId: supaId, email: hostUser.email, platformRole: 'USER' };
      if (supaId === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseId: supaId, email: coordinatorUser.email, platformRole: 'USER' };
      if (supaId === outsiderUser.id) return { _id: outsiderMongoId, supabaseId: supaId, email: outsiderUser.email, platformRole: 'USER' };
      return null;
    });

    // Mock Event Repository
    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (evId: string): Promise<any> => {
      return mockEvents.get(evId.toString()) || null;
    });

    // Mock Member Repository
    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(async (evId: any, uId: any): Promise<any> => {
      for (const m of mockMembers.values()) {
        if (m.eventId.toString() === evId.toString() && m.userId.toString() === uId.toString()) {
          return m;
        }
      }
      return null;
    });

    // Mock Credential Repository
    jest.spyOn(mongoEventCredentialRepository, 'getNextSequenceNumber').mockImplementation(async (evId: string) => {
      const current = sequenceCounters.get(evId) || 0;
      const next = current + 1;
      sequenceCounters.set(evId, next);
      return next;
    });

    jest.spyOn(mongoEventCredentialRepository, 'allocateSequenceBlock').mockImplementation(async (evId: string, count: number) => {
      const current = sequenceCounters.get(evId) || 0;
      const next = current + count;
      sequenceCounters.set(evId, next);
      return current + 1;
    });

    jest.spyOn(mongoEventCredentialRepository, 'create').mockImplementation(async (data: any) => {
      const id = new mongoose.Types.ObjectId();
      const doc = {
        _id: id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        checkInCount: 0,
      };
      mockCredentials.set(id.toString(), doc);
      return doc as any;
    });

    jest.spyOn(mongoEventCredentialRepository, 'createMany').mockImplementation(async (items: any[]) => {
      const docs = items.map((data) => {
        const id = new mongoose.Types.ObjectId();
        const doc = {
          _id: id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          checkInCount: 0,
        };
        mockCredentials.set(id.toString(), doc);
        return doc;
      });
      return docs as any;
    });

    jest.spyOn(mongoEventCredentialRepository, 'findById').mockImplementation(async (evId: string, credId: string) => {
      const cred = mockCredentials.get(credId.toString());
      if (cred && cred.eventId.toString() === evId.toString()) return cred;
      return null;
    });

    jest.spyOn(mongoEventCredentialRepository, 'findByVerificationToken').mockImplementation(async (token: string) => {
      for (const cred of mockCredentials.values()) {
        if (cred.verificationToken === token) {
          const event = mockEvents.get(cred.eventId.toString());
          return {
            ...cred,
            eventId: event,
          } as any;
        }
      }
      return null;
    });

    jest.spyOn(mongoEventCredentialRepository, 'findByEvent').mockImplementation(async (evId: string, filters: any = {}) => {
      let list = Array.from(mockCredentials.values()).filter(
        (c) => c.eventId.toString() === evId.toString()
      );
      if (filters.status && filters.status !== 'ALL') {
        list = list.filter((c) => c.status === filters.status);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (c) =>
            c.holder?.name?.toLowerCase().includes(q) ||
            c.formattedId?.toLowerCase().includes(q)
        );
      }
      return { credentials: list, total: list.length };
    });

    jest.spyOn(mongoEventCredentialRepository, 'getMetrics').mockImplementation(async (evId: string) => {
      const list = Array.from(mockCredentials.values()).filter(
        (c) => c.eventId.toString() === evId.toString()
      );
      return {
        total: list.length,
        active: list.filter((c) => c.status === 'ACTIVE').length,
        checkedIn: list.filter((c) => c.status === 'CHECKED_IN').length,
        revoked: list.filter((c) => c.status === 'REVOKED').length,
      };
    });

    jest.spyOn(mongoEventCredentialRepository, 'updateStatus').mockImplementation(async (evId: string, credId: string, status: any, reason?: string) => {
      const cred = mockCredentials.get(credId.toString());
      if (!cred || cred.eventId.toString() !== evId.toString()) return null;
      cred.status = status;
      if (status === 'REVOKED') {
        cred.revokedAt = new Date();
        cred.revokedReason = reason || 'Revoked by organizer';
      }
      return cred;
    });

    jest.spyOn(mongoEventCredentialRepository, 'assignHolder').mockImplementation(async (evId: string, credId: string, holderData: any) => {
      const cred = mockCredentials.get(credId.toString());
      if (!cred || cred.eventId.toString() !== evId.toString()) return null;
      cred.holder = {
        ...cred.holder,
        ...holderData,
        isAssigned: true,
      };
      return cred;
    });
  });

  describe('1. Single Credential Issuance & Monotonic Sequence Allocation', () => {
    it('issues a credential with sequence #1 and formattedId matching terminology prefix', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          holder: {
            name: 'Dr. Aris Thorne',
            email: 'aris.thorne@summit.org',
            organization: 'Quantum AI Labs',
            designation: 'Keynote Speaker',
            category: 'VIP',
          },
          credentialType: 'VIP',
          usagePolicy: 'SINGLE_USE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sequenceNumber).toBe(1);
      expect(res.body.data.formattedId).toBe('BDG-00001'); // Delegate Badge prefix
      expect(res.body.data.terminology).toBe('Delegate Badge');
      expect(res.body.data.verificationToken).toHaveLength(64);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.holder.name).toBe('Dr. Aris Thorne');
      expect(res.body.data.holder.organization).toBe('Quantum AI Labs');
    });

    it('allocates sequence #2 monotonically for second credential without collision', async () => {
      // First issuance
      await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          holder: { name: 'Attendee One', email: 'attendee1@summit.org' },
        });

      // Second issuance
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          holder: { name: 'Attendee Two', email: 'attendee2@summit.org' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.sequenceNumber).toBe(2);
      expect(res.body.data.formattedId).toBe('BDG-00002');
    });
  });

  describe('2. Batch Unassigned Worker Credentials', () => {
    it('issues a batch of unassigned worker credentials with reusable worker policy', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/worker-batch`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          count: 5,
          category: 'Catering & Logistics Staff',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.issuedCount).toBe(5);
      expect(res.body.data).toHaveLength(5);

      const firstWorker = res.body.data[0];
      expect(firstWorker.usagePolicy).toBe('REUSABLE_WORKER');
      expect(firstWorker.holder.isAssigned).toBe(false);
      expect(firstWorker.formattedId).toMatch(/^WRK-\d{5}$/);
      expect(firstWorker.verificationToken).toHaveLength(64);
    });
  });

  describe('3. Credential Querying, Filtering & Metrics', () => {
    beforeEach(async () => {
      // Seed credentials
      await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ holder: { name: 'Alice Walker', category: 'General' }, status: 'ACTIVE' });

      await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ holder: { name: 'Bob Dylan', category: 'VIP' }, status: 'ACTIVE' });
    });

    it('lists credentials with live aggregated metrics', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBe(2);
      expect(res.body.metrics.total).toBe(2);
      expect(res.body.metrics.active).toBe(2);
      expect(res.body.metrics.revoked).toBe(0);
    });

    it('filters credentials by search text query', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/credentials?search=Alice`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].holder.name).toBe('Alice Walker');
    });
  });

  describe('4. Holder Assignment & Revocation Workflows', () => {
    let credentialId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/worker-batch`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ count: 1 });

      credentialId = res.body.data[0]._id;
    });

    it('assigns an unassigned worker pass to a named crew member', async () => {
      const res = await request(app)
        .patch(`/api/events/${testEventId}/credentials/${credentialId}/assign`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: 'Priya Sharma',
          email: 'priya.crew@summit.org',
          phone: '+91 98765 43210',
          category: 'Stage Production',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.holder.name).toBe('Priya Sharma');
      expect(res.body.data.holder.email).toBe('priya.crew@summit.org');
      expect(res.body.data.holder.isAssigned).toBe(true);
    });

    it('revokes a credential with an audit reason', async () => {
      const res = await request(app)
        .patch(`/api/events/${testEventId}/credentials/${credentialId}/revoke`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ reason: 'Lost badge reported by attendee' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REVOKED');
      expect(res.body.data.revokedReason).toBe('Lost badge reported by attendee');
    });
  });

  describe('5. Public 64-Character Token Verification (Zero PII Leakage)', () => {
    let verificationToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          holder: {
            name: 'Vikram Malhotra',
            email: 'confidential.vikram@corp.com',
            phone: '+91 99999 88888',
            organization: 'Enterprise Apex Corp',
          },
        });

      verificationToken = res.body.data.verificationToken;
    });

    it('returns sanitized event and holder details without leaking email or phone PII', async () => {
      const res = await request(app)
        .get(`/api/credentials/verify-token/${verificationToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.holderName).toBe('Vikram Malhotra');
      expect(res.body.data.eventName).toBe('Global Tech Summit 2026');
      expect(res.body.data.venue).toBe('Convention Hall A');

      // Zero PII Leakage Invariant
      expect(res.body.data.email).toBeUndefined();
      expect(res.body.data.phone).toBeUndefined();
      expect(res.body.data.holderEmail).toBeUndefined();
      expect(res.body.data.holderPhone).toBeUndefined();
    });

    it('rejects invalid or malformed tokens with validation error', async () => {
      const res = await request(app)
        .get('/api/credentials/verify-token/short-invalid-token');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('6. Zero-Trust Access Control (RBAC Protection)', () => {
    it('rejects unauthenticated requests to issue credentials with 401', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .send({ holder: { name: 'Unauthorized Person' } });

      expect(res.status).toBe(401);
    });

    it('rejects unauthorized users (non-host, non-coordinator) with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ holder: { name: 'Attempted Issuance' } });

      expect(res.status).toBe(403);
    });
  });
});
