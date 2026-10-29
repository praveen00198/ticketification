import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app';
import { createJwtToken } from '../../src/utils/local-auth';
import { eventRepository } from '../../src/modules/events/repositories/event.repository';
import { mongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { EventModel } from '../../src/db/mongo/models/event.model';
import { EventMemberModel } from '../../src/db/mongo/models/event-member.model';
import { guestRepository } from '../../src/modules/guests/repositories/guest.repository';
import { mongoEventCredentialRepository } from '../../src/modules/events/repositories/mongo-event-credential.repository';

describe('Tier 1: Requirement R5 — Guest Import RBAC & IDOR Enforcement E2E Suite', () => {
  const hostUser = {
    id: 'usr_host_owner_001',
    email: 'host_owner@example.com',
    role: 'USER' as const,
    name: 'Host Organizer',
  };

  const attendeeUser = {
    id: 'usr_attendee_intruder_002',
    email: 'attendee_intruder@example.com',
    role: 'USER' as const,
    name: 'Attendee Intruder',
  };

  const hostToken = createJwtToken({
    id: hostUser.id,
    email: hostUser.email,
    role: hostUser.role,
  });

  const attendeeToken = createJwtToken({
    id: attendeeUser.id,
    email: attendeeUser.email,
    role: attendeeUser.role,
  });

  const mockEventId = new mongoose.Types.ObjectId().toString();

  const mockHostEvent = {
    _id: new mongoose.Types.ObjectId(mockEventId),
    id: mockEventId,
    name: 'Restricted Executive Summit',
    createdBy: hostUser.id,
    ownerSupabaseId: hostUser.id,
    ownerId: new mongoose.Types.ObjectId(),
    status: 'PUBLISHED',
  };

  beforeEach(() => {
    // Mock user repo lookups
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation((id: string) => {
      if (id === hostUser.id) {
        return Promise.resolve({
          _id: hostUser.id,
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: attendeeUser.id,
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation((id: string) => {
      if (id === hostUser.id) {
        return Promise.resolve({
          _id: hostUser.id,
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: attendeeUser.id,
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });

    jest.spyOn(mongoUserRepository, 'findByEmail').mockImplementation((email: string) => {
      if (email === hostUser.email) {
        return Promise.resolve({
          _id: hostUser.id,
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          platformRole: 'USER',
          status: 'ACTIVE',
        } as any);
      }
      return Promise.resolve({
        _id: attendeeUser.id,
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);
    });

    jest.spyOn(eventRepository, 'findById').mockResolvedValue(mockHostEvent as any);
    jest.spyOn(eventRepository, 'findByIdAndOwner').mockImplementation((eventId: string, userId: string) => {
      if (eventId === mockEventId && userId === hostUser.id) {
        return Promise.resolve(mockHostEvent as any);
      }
      return Promise.resolve(null);
    });

    jest.spyOn(EventModel, 'findById').mockResolvedValue(mockHostEvent as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('R5.1: Non-Host Guest Management Rejection (IDOR Defense)', () => {
    it('R5-TC1: attendee is rejected with 403 / 404 when attempting to list guests of an event they do not own', async () => {
      const res = await request(app)
        .get(`/api/guests/events/${mockEventId}`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('R5-TC2: attendee is rejected with 403 / 404 when attempting to create a guest record', async () => {
      const res = await request(app)
        .post(`/api/guests/events/${mockEventId}`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({
          name: 'Unauthorized Guest',
          category: 'VIP',
        });

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('R5-TC3: attendee is rejected with 403 / 404 when attempting to upload spreadsheet roster', async () => {
      jest.spyOn(EventMemberModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/guests/events/${mockEventId}/upload`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .attach('file', Buffer.from('Name,Category\nTest,VIP'), 'roster.csv');

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('R5.2: Non-Host Ticket & Turnstile Rejection', () => {
    it('R5-TC4: attendee is rejected with 403 / 404 when attempting to query event ticket list', async () => {
      jest.spyOn(EventMemberModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/tickets/events/${mockEventId}`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect([403, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('R5-TC5: attendee is rejected with 403 / 404 when attempting to trigger bulk ZIP ticket export', async () => {
      jest.spyOn(EventMemberModel, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/tickets/events/${mockEventId}/export-zip`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect([403, 404]).toContain(res.status);
      const parsed = res.body?.success !== undefined ? res.body : JSON.parse(res.text || '{}');
      expect(parsed.success).toBe(false);
    });

    it('R5-TC6: attendee is rejected with 401 / 403 when attempting to check in attendees via scanner endpoint', async () => {
      const res = await request(app)
        .post(`/api/events/${mockEventId}/checkin`)
        .set('Authorization', `Bearer ${attendeeToken}`)
        .send({ token: 'a'.repeat(64) });

      // Non-staff caller cannot perform turnstile check-in
      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('R5.3: Authorized Host Capabilities Preserved', () => {
    it('R5-TC7: authorized host is permitted to query event guest list and tickets', async () => {
      jest.spyOn(guestRepository, 'findByEventId').mockResolvedValueOnce([]);
      jest.spyOn(guestRepository, 'countByEventId').mockResolvedValueOnce(0);

      const res = await request(app)
        .get(`/api/guests/events/${mockEventId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.guests)).toBe(true);
    });

    it('R5-TC8: authorized host is permitted to query event ticket list', async () => {
      jest.spyOn(mongoEventCredentialRepository, 'findByEvent').mockResolvedValueOnce({
        credentials: [],
        total: 0,
      });

      const res = await request(app)
        .get(`/api/tickets/events/${mockEventId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.tickets)).toBe(true);
    });
  });
});
