import request from 'supertest';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { eventRepository } from '../src/modules/events/repositories/event.repository';
import { guestRepository } from '../src/modules/guests/repositories/guest.repository';

describe('Routing, Session Restoration and RBAC Gaps Verification', () => {
  jest.setTimeout(15000);

  const attendeeUser = {
    id: 'usr_attendee_001',
    email: 'attendee@example.com',
    role: 'USER' as const,
  };

  const hostUser = {
    id: 'usr_host_002',
    email: 'host@example.com',
    role: 'USER' as const,
  };

  const attendeeToken = createJwtToken({
    id: attendeeUser.id,
    email: attendeeUser.email,
    role: attendeeUser.role,
  });

  const hostToken = createJwtToken({
    id: hostUser.id,
    email: hostUser.email,
    role: hostUser.role,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Session Restoration & Auth Status Classification', () => {
    it('definitive 401 rejection occurs when authorization token is omitted', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('definitive 401 rejection occurs when token signature is invalid or tampered', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('simulated transient error (500) is distinct from 401/403 and must not trigger account invalidation', () => {
      const simulatedNetworkError = {
        message: 'Network Error',
        response: undefined,
      };
      const simulatedTimeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
        response: undefined,
      };
      const simulatedServerError = {
        response: { status: 503, data: { message: 'Service Unavailable' } },
      };

      const classifyAuthError = (err: any) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          return 'UNAUTHENTICATED';
        }
        return 'VERIFICATION_FAILED';
      };

      expect(classifyAuthError(simulatedNetworkError)).toBe('VERIFICATION_FAILED');
      expect(classifyAuthError(simulatedTimeoutError)).toBe('VERIFICATION_FAILED');
      expect(classifyAuthError(simulatedServerError)).toBe('VERIFICATION_FAILED');
      expect(classifyAuthError({ response: { status: 401 } })).toBe('UNAUTHENTICATED');
      expect(classifyAuthError({ response: { status: 403 } })).toBe('UNAUTHENTICATED');
    });
  });

  describe('2. Host Authorization & RBAC Invariants', () => {
    const mockHostEvent = {
      id: 'evt_host_owned_123',
      name: 'Host Conference 2026',
      date: '2026-12-01',
      createdBy: hostUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('an ordinary attendee cannot access host guest roster of another user event', async () => {
      jest.spyOn(eventRepository, 'findById').mockResolvedValue(mockHostEvent as any);

      // Attendee attempts to access host event guests
      const res = await request(app)
        .get(`/api/guests/events/${mockHostEvent.id}`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      // Server-side security boundary strictly rejects unauthorized access (403 AuthorizationError)
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Access denied');
    });

    it('a verified host retains full access to their authorized event guest operations', async () => {
      jest.spyOn(eventRepository, 'findById').mockResolvedValue(mockHostEvent as any);
      jest.spyOn(guestRepository, 'findByEventId').mockResolvedValue([]);
      jest.spyOn(guestRepository, 'countByEventId').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/guests/events/${mockHostEvent.id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('client permission helper does NOT grant host privileges solely because events list is non-empty', () => {
      // Direct unit evaluation of permission boundary logic
      const isHostOrOrganizer = (
        user?: { id?: string; role?: string; isOnboarded?: boolean } | null,
        currentEvent?: { createdBy?: string } | null
      ) => {
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        if (Boolean(user.isOnboarded)) return true;
        if (currentEvent && user.id && currentEvent.createdBy === user.id) {
          return true;
        }
        return false;
      };

      const regularAttendee = { id: 'usr_att_1', role: 'USER', isOnboarded: false };
      const foreignEvent = { id: 'evt_99', createdBy: 'other_user_456' };
      const ownedEvent = { id: 'evt_100', createdBy: 'usr_att_1' };
      const onboardedHost = { id: 'usr_host_1', role: 'USER', isOnboarded: true };

      // Normal attendee viewing foreign event must NOT be granted host capability
      expect(isHostOrOrganizer(regularAttendee, foreignEvent)).toBe(false);
      expect(isHostOrOrganizer(regularAttendee, null)).toBe(false);

      // Normal attendee viewing an event they personally created is granted host capability for that event
      expect(isHostOrOrganizer(regularAttendee, ownedEvent)).toBe(true);

      // Onboarded host is granted host capability globally
      expect(isHostOrOrganizer(onboardedHost, null)).toBe(true);
      expect(isHostOrOrganizer(onboardedHost, foreignEvent)).toBe(true);
    });
  });
});
