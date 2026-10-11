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
import { DEFAULT_ROLE_PERMISSIONS } from '../src/db/mongo/models/event-member.model';

describe('Phase 7: Event Membership & RBAC Engine', () => {
  const hostUser = {
    id: 'mock-host-uuid-phase7',
    email: 'host.phase7@event.org',
  };
  const staffUser = {
    id: 'mock-staff-uuid-phase7',
    email: 'staff.phase7@event.org',
  };
  const volunteerUser = {
    id: 'mock-volunteer-uuid-phase7',
    email: 'volunteer.phase7@event.org',
  };
  const outsiderUser = {
    id: 'mock-outsider-uuid-phase7',
    email: 'outsider@other.org',
  };

  const hostToken = 'valid-host-token-phase7';
  const staffToken = 'valid-staff-token-phase7';
  const volunteerToken = 'valid-volunteer-token-phase7';
  const outsiderToken = 'valid-outsider-token-phase7';

  const hostMongoId = new mongoose.Types.ObjectId();
  const staffMongoId = new mongoose.Types.ObjectId();
  const volunteerMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Developer Summit 2026',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Attendee Badge',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Convention Center', city: 'Delhi', country: 'India' },
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        timezone: 'Asia/Kolkata',
      },
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) {
        return { data: { user: { id: hostUser.id, email: hostUser.email, user_metadata: { name: 'Host Admin' } } }, error: null };
      }
      if (token === staffToken) {
        return { data: { user: { id: staffUser.id, email: staffUser.email, user_metadata: { name: 'Staff Member' } } }, error: null };
      }
      if (token === volunteerToken) {
        return { data: { user: { id: volunteerUser.id, email: volunteerUser.email, user_metadata: { name: 'Volunteer' } } }, error: null };
      }
      if (token === outsiderToken) {
        return { data: { user: { id: outsiderUser.id, email: outsiderUser.email, user_metadata: { name: 'Outsider' } } }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host Admin', email: hostUser.email, role: 'USER' };
      if (id === staffUser.id) return { id: staffUser.id, name: 'Staff Member', email: staffUser.email, role: 'USER' };
      if (id === volunteerUser.id) return { id: volunteerUser.id, name: 'Volunteer', email: volunteerUser.email, role: 'USER' };
      if (id === outsiderUser.id) return { id: outsiderUser.id, name: 'Outsider', email: outsiderUser.email, role: 'USER' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) {
        return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host Admin', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === staffUser.id) {
        return { _id: staffMongoId, supabaseUserId: staffUser.id, email: staffUser.email, name: 'Staff Member', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === volunteerUser.id) {
        return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === outsiderUser.id) {
        return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider', platformRole: 'USER', status: 'ACTIVE' };
      }
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findByEmail').mockImplementation(async (email: string): Promise<any> => {
      if (email.toLowerCase() === hostUser.email.toLowerCase()) return { _id: hostMongoId, email: hostUser.email };
      if (email.toLowerCase() === staffUser.email.toLowerCase()) return { _id: staffMongoId, email: staffUser.email };
      if (email.toLowerCase() === volunteerUser.email.toLowerCase()) return { _id: volunteerMongoId, email: volunteerUser.email };
      if (email.toLowerCase() === outsiderUser.email.toLowerCase()) return { _id: outsiderMongoId, email: outsiderUser.email };
      return null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
    });

    // Mock MongoEventMemberRepository methods
    jest.spyOn(mongoEventMemberRepository, 'createMember').mockImplementation(async (doc: any): Promise<any> => {
      const memberId = new mongoose.Types.ObjectId();
      const created = {
        _id: memberId,
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMembers.set(memberId.toString(), created);
      return created;
    });

    jest.spyOn(mongoEventMemberRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockMembers.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndEmail').mockImplementation(
      async (eventId: any, email: any): Promise<any> => {
        for (const m of mockMembers.values()) {
          if (m.eventId.toString() === eventId.toString() && m.userEmail.toLowerCase() === email.toLowerCase()) {
            return m;
          }
        }
        return null;
      }
    );

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(
      async (eventId: any, userId: any): Promise<any> => {
        for (const m of mockMembers.values()) {
          if (m.eventId.toString() === eventId.toString() && m.userId && m.userId.toString() === userId.toString()) {
            return m;
          }
        }
        return null;
      }
    );

    jest.spyOn(mongoEventMemberRepository, 'findByInvitationToken').mockImplementation(
      async (token: string): Promise<any> => {
        for (const m of mockMembers.values()) {
          if (m.invitationToken === token) {
            return m;
          }
        }
        return null;
      }
    );

    jest.spyOn(mongoEventMemberRepository, 'listEventMembers').mockImplementation(
      async (eventId: any, status?: any): Promise<any> => {
        const list: any[] = [];
        for (const m of mockMembers.values()) {
          if (m.eventId.toString() === eventId.toString()) {
            if (!status || m.status === status) {
              list.push(m);
            }
          }
        }
        return list;
      }
    );

    jest.spyOn(mongoEventMemberRepository, 'updateMember').mockImplementation(
      async (id: any, updates: any): Promise<any> => {
        const member = mockMembers.get(id.toString());
        if (!member) return null;
        const updated = { ...member, ...updates, updatedAt: new Date() };
        mockMembers.set(id.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventMemberRepository, 'deleteMember').mockImplementation(
      async (id: any): Promise<any> => {
        const deleted = mockMembers.delete(id.toString());
        return deleted;
      }
    );
  });

  describe('1. Invitation Workflow', () => {
    it('allows event owner to invite a coordinator with default permissions', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: staffUser.email,
          role: 'COORDINATOR',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.member.role).toBe('COORDINATOR');
      expect(res.body.data.member.status).toBe('INVITED');
      expect(res.body.data.devToken).toBeDefined();
      expect(res.body.data.invitationLink).toContain('/invite/accept?token=');
      expect(res.body.data.member.permissions).toEqual(
        expect.arrayContaining(DEFAULT_ROLE_PERMISSIONS.COORDINATOR)
      );
    });

    it('rejects invitation attempts from unauthorized users', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          email: 'someone@event.org',
          role: 'VOLUNTEER',
        });

      expect(res.status).toBe(403);
    });

    it('rejects invitation with invalid email or unsupported role', async () => {
      const resInvalidEmail = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: 'not-an-email',
          role: 'VOLUNTEER',
        });

      expect(resInvalidEmail.status).toBe(400);

      const resInvalidRole = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: 'valid@event.org',
          role: 'SUPER_HOST',
        });

      expect(resInvalidRole.status).toBe(400);
    });

    it('rejects duplicate invitations while one is already pending', async () => {
      // First invite
      await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: volunteerUser.email,
          role: 'VOLUNTEER',
        });

      // Second invite for same email
      const res2 = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: volunteerUser.email,
          role: 'VOLUNTEER',
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error.message).toContain('already pending');
    });
  });

  describe('2. Invitation Acceptance Workflow', () => {
    let inviteToken: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: staffUser.email,
          role: 'COORDINATOR',
        });
      inviteToken = res.body.data.devToken;
    });

    it('successfully accepts invitation when authenticated as the invited email', async () => {
      const res = await request(app)
        .post('/api/events/invitations/accept')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ token: inviteToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.userId.toString()).toBe(staffMongoId.toString());
    });

    it('rejects acceptance if signed in with a mismatched email', async () => {
      const res = await request(app)
        .post('/api/events/invitations/accept')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ token: inviteToken });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Please sign in with that email');
    });

    it('rejects acceptance with invalid token', async () => {
      const res = await request(app)
        .post('/api/events/invitations/accept')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ token: 'completely-invalid-non-existent-token' });

      expect(res.status).toBe(404);
    });
  });

  describe('3. Staff Management & Granular Permission Updates', () => {
    let memberId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/members/invite`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          email: volunteerUser.email,
          role: 'VOLUNTEER',
        });
      memberId = res.body.data.member._id.toString();

      // Accept invitation
      await request(app)
        .post('/api/events/invitations/accept')
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ token: res.body.data.devToken });
    });

    it('allows host to grant SCAN_CREDENTIALS permission to a volunteer', async () => {
      const res = await request(app)
        .put(`/api/events/${testEventId.toString()}/members/${memberId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          permissions: ['VIEW_ASSIGNED_TASKS', 'SCAN_CREDENTIALS'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.permissions).toContain('SCAN_CREDENTIALS');
    });

    it('allows host to view team members roster', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/members`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].userEmail).toBe(volunteerUser.email);
    });

    it('allows active volunteer to view team members roster', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/members`)
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('denies outsider from viewing team members roster', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/members`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('allows host to revoke member access', async () => {
      const res = await request(app)
        .delete(`/api/events/${testEventId.toString()}/members/${memberId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('revoked');

      const member = mockMembers.get(memberId);
      expect(member.status).toBe('REVOKED');
    });
  });
});
