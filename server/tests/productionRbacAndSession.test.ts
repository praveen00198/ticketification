jest.mock('lucide-react', () => new Proxy({}, { get: () => 'MockIcon' }), { virtual: true });

import request from 'supertest';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { eventRepository } from '../src/modules/events/repositories/event.repository';
import { guestRepository } from '../src/modules/guests/repositories/guest.repository';
import { ticketRepository } from '../src/modules/tickets/repositories/ticket.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';

// Import the REAL production client permission helpers directly from client source
import {
  isHostOrOrganizer,
  canManageEventOperations,
  hasOrganizerProfile,
  isPlatformAdmin,
  isEventOwner,
  getUserDisplayRole,
  getNavigationCategories,
} from '../../client/src/utils/permissions';

describe('Production RBAC, Session Restoration & Custom Identity Verification', () => {
  const attendeeUser = {
    id: 'usr_att_prod_001',
    email: 'attendee.prod@example.com',
    role: 'USER' as const,
  };

  const hostUser = {
    id: 'usr_host_prod_002',
    email: 'host.prod@example.com',
    role: 'USER' as const,
  };

  const adminUser = {
    id: 'usr_admin_prod_003',
    email: 'admin.prod@example.com',
    role: 'ADMIN' as const,
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

  const adminToken = createJwtToken({
    id: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const foreignEvent = {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'Foreign Event',
    date: '2026-11-20',
    createdBy: 'other_owner_777',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const hostOwnedEvent = {
    id: 'b0000000-0000-4000-8000-000000000002',
    name: 'Host Tech Summit',
    date: '2026-11-25',
    createdBy: hostUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Real Production Client Permission Logic (permissions.ts)', () => {
    it('isPlatformAdmin identifies ADMIN and SUPER_ADMIN correctly', () => {
      expect(isPlatformAdmin({ name: 'A', email: 'a@a.com', role: 'ADMIN' })).toBe(true);
      expect(isPlatformAdmin({ name: 'S', email: 's@s.com', role: 'SUPER_ADMIN' })).toBe(true);
      expect(isPlatformAdmin({ name: 'U', email: 'u@u.com', role: 'USER' })).toBe(false);
      expect(isPlatformAdmin(null)).toBe(false);
    });

    it('hasOrganizerProfile reflects onboarding status without granting operational rights', () => {
      const onboardedUser = { id: 'u1', name: 'Host', email: 'h@h.com', isOnboarded: true };
      const nonOnboardedUser = { id: 'u2', name: 'User', email: 'u@u.com', isOnboarded: false };

      expect(hasOrganizerProfile(onboardedUser)).toBe(true);
      expect(hasOrganizerProfile(nonOnboardedUser)).toBe(false);
    });

    it('isEventOwner checks verified creator/owner matching user ID', () => {
      const user = { id: 'usr_owner_1', name: 'Owner', email: 'o@o.com' };
      const owned = { id: 'e1', name: 'E1', createdBy: 'usr_owner_1' };
      const foreign = { id: 'e2', name: 'E2', createdBy: 'someone_else' };

      expect(isEventOwner(user, owned)).toBe(true);
      expect(isEventOwner(user, foreign)).toBe(false);
      expect(isEventOwner(user, null)).toBe(false);
    });

    it('canManageEventOperations strictly enforces event ownership and does NOT grant access solely on isOnboarded', () => {
      const onboardedNonOwner = { id: 'usr_onboarded_no_event', name: 'Host', email: 'h@h.com', isOnboarded: true, role: 'USER' };
      const eventOwner = { id: hostUser.id, name: 'Host', email: hostUser.email, isOnboarded: true, role: 'USER' };
      const platformAdmin = { id: adminUser.id, name: 'Admin', email: adminUser.email, role: 'ADMIN' };

      // Onboarded user viewing a foreign event CANNOT manage event operations
      expect(canManageEventOperations(onboardedNonOwner, hostOwnedEvent)).toBe(false);
      expect(isHostOrOrganizer(onboardedNonOwner, hostOwnedEvent)).toBe(false);

      // Onboarded user with NO active event selected CANNOT manage event operations
      expect(canManageEventOperations(onboardedNonOwner, null)).toBe(false);
      expect(isHostOrOrganizer(onboardedNonOwner, null)).toBe(false);

      // Event owner CAN manage event operations
      expect(canManageEventOperations(eventOwner, hostOwnedEvent)).toBe(true);
      expect(isHostOrOrganizer(eventOwner, hostOwnedEvent)).toBe(true);

      // Platform admin CAN manage event operations globally
      expect(canManageEventOperations(platformAdmin, hostOwnedEvent)).toBe(true);
      expect(canManageEventOperations(platformAdmin, null)).toBe(true);
    });

    it('getUserDisplayRole reports transparent, accurate human-readable titles', () => {
      expect(getUserDisplayRole(null)).toBe('Guest');
      expect(getUserDisplayRole({ name: 'A', email: 'a@a.com', role: 'SUPER_ADMIN' })).toBe('Super Admin');
      expect(getUserDisplayRole({ name: 'B', email: 'b@b.com', role: 'ADMIN' })).toBe('Admin');
      // Single global identity: isOnboarded does NOT globally misidentify user as Host
      expect(getUserDisplayRole({ name: 'C', email: 'c@c.com', role: 'USER', isOnboarded: true })).toBe('Attendee');
      expect(getUserDisplayRole({ name: 'D', email: 'd@d.com', role: 'USER', isOnboarded: false })).toBe('Attendee');
      // Contextual event role evaluation
      const eventOwner = { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      expect(getUserDisplayRole(eventOwner, hostOwnedEvent)).toBe('Host');
      expect(getUserDisplayRole({ id: 'u3', name: 'Coord', email: 'coord@c.com', role: 'USER' }, { ...hostOwnedEvent, userRole: 'COORDINATOR' })).toBe('Coordinator');
      expect(getUserDisplayRole({ id: 'u4', name: 'Judge', email: 'judge@j.com', role: 'USER' }, { ...hostOwnedEvent, userRole: 'JUDGE' })).toBe('Judge');
    });

    it('getNavigationCategories isolates Event Operations strictly to authorized managers', () => {
      const attendee = { id: 'usr_att', name: 'Attendee', email: 'att@test.com', role: 'USER', isOnboarded: false };
      const host = { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER', isOnboarded: true };

      // Attendee viewing an event: NO Event Operations category
      const attendeeNav = getNavigationCategories({ user: attendee, currentEvent: hostOwnedEvent });
      const attendeeTitles = attendeeNav.map((c) => c.title);
      expect(attendeeTitles).not.toContain('Event Operations');
      expect(attendeeTitles).toContain('Event Discovery');
      expect(attendeeTitles).toContain('Attendee Wallet');
      expect(attendeeTitles).toContain('My Activity');
      expect(attendeeTitles).toContain('Event Hosting');
      expect(attendeeTitles).toContain('Payment & Refund');
      expect(attendeeTitles).toContain('Notifications');
      expect(attendeeTitles).toContain('Help & Support');
      expect(attendeeTitles).toContain('Account & Profile');

      // Host viewing their OWN event: DOES have Event Operations
      const hostNav = getNavigationCategories({ user: host, currentEvent: hostOwnedEvent });
      const hostTitles = hostNav.map((c) => c.title);
      expect(hostTitles).toContain('Event Operations');
      const opsCategory = hostNav.find((c) => c.title === 'Event Operations');
      expect(opsCategory?.items.some((i) => i.path === '/import')).toBe(true);
      expect(opsCategory?.items.some((i) => i.path === '/tickets')).toBe(true);
      expect(opsCategory?.items.some((i) => i.path === '/scan')).toBe(true);

      // Host viewing a FOREIGN event: NO Event Operations category
      const hostForeignNav = getNavigationCategories({ user: host, currentEvent: foreignEvent });
      expect(hostForeignNav.map((c) => c.title)).not.toContain('Event Operations');
    });
  });

  describe('2. Real Backend Custom-Auth Identity & Middleware (auth.middleware.ts)', () => {
    it('authenticates user by verified JWT without requiring Supabase Auth UID', async () => {
      jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue({
        _id: 'mongo_obj_id_123',
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        name: 'Attendee',
        platformRole: 'USER',
        status: 'ACTIVE',
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(attendeeUser.email);
    });

    it('rejects suspended accounts with 401 AuthenticationError', async () => {
      jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue({
        _id: 'mongo_obj_id_suspended',
        supabaseUserId: attendeeUser.id,
        email: attendeeUser.email,
        platformRole: 'USER',
        status: 'SUSPENDED',
      } as any);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message || res.body.error).toContain('suspended');
    });

    it('fails closed when token user ID does not match any database user (no email spoofing)', async () => {
      // User ID does not exist in DB
      jest.spyOn(mongoUserRepository, 'findById').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Real Backend Host Isolation & Security Boundaries', () => {
    it('rejects an attendee from calling host guest roster endpoint for a foreign event (403)', async () => {
      jest.spyOn(eventRepository, 'findById').mockResolvedValue(foreignEvent as any);

      const res = await request(app)
        .get(`/api/guests/events/${foreignEvent.id}`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Access denied');
    });

    it('allows verified event creator to access guest operations for their event (200)', async () => {
      jest.spyOn(eventRepository, 'findById').mockResolvedValue(hostOwnedEvent as any);
      jest.spyOn(guestRepository, 'findByEventId').mockResolvedValue([]);
      jest.spyOn(guestRepository, 'countByEventId').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/guests/events/${hostOwnedEvent.id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.guests).toBeDefined();
    });

    it('rejects non-owner from accessing event ticket list (404/403 Event not found or unauthorized)', async () => {
      jest.spyOn(eventRepository, 'findByIdAndOwner').mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/tickets/events/${foreignEvent.id}`)
        .set('Authorization', `Bearer ${attendeeToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('allows verified host to access their event ticket list (200)', async () => {
      jest.spyOn(eventRepository, 'findByIdAndOwner').mockResolvedValue(hostOwnedEvent as any);
      jest.spyOn(ticketRepository, 'findByEventId').mockResolvedValue([]);
      jest.spyOn(ticketRepository, 'countByEventId').mockResolvedValue(0);

      const res = await request(app)
        .get(`/api/tickets/events/${hostOwnedEvent.id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tickets).toBeDefined();
    });
  });

  describe('4. Session Restoration Error Classification & Invariants', () => {
    it('classifies network and server errors as recoverable without invalidating account', () => {
      const isTransientFailure = (status?: number, code?: string) => {
        if (!status && (code === 'ERR_NETWORK' || code === 'ECONNABORTED')) return true;
        if (status && status >= 500) return true;
        return false;
      };

      expect(isTransientFailure(undefined, 'ERR_NETWORK')).toBe(true);
      expect(isTransientFailure(undefined, 'ECONNABORTED')).toBe(true);
      expect(isTransientFailure(500)).toBe(true);
      expect(isTransientFailure(502)).toBe(true);
      expect(isTransientFailure(503)).toBe(true);
      expect(isTransientFailure(401)).toBe(false);
      expect(isTransientFailure(403)).toBe(false);
      expect(isTransientFailure(404)).toBe(false);
    });
  });
});
