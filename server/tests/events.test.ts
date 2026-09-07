import request from 'supertest';
import app from '../src/app';
import {
  validateCreateEventInput,
  validateUpdateEventInput,
  validateCreateTicketTypeInput,
} from '../src/modules/events/event.validation';
import {
  validateCreateGuestInput,
  validateUpdateGuestInput,
  validateGuestQueryOptions,
} from '../src/modules/guests/guest.validation';
import { EventService } from '../src/modules/events/services/event.service';
import { GuestService } from '../src/modules/guests/services/guest.service';
import {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../src/middlewares/error.middleware';

describe('Phase 2: Events & Guest Management Subsystem', () => {
  describe('Event Input Validation', () => {
    it('should reject event creation with missing name', () => {
      expect(() =>
        validateCreateEventInput({ name: '', date: '2026-11-15' })
      ).toThrow(ValidationError);
    });

    it('should reject event creation with invalid date', () => {
      expect(() =>
        validateCreateEventInput({ name: 'Tech Gala', date: 'invalid-date' })
      ).toThrow(ValidationError);
    });

    it('should accept valid event creation payload', () => {
      const result = validateCreateEventInput({
        name: '  Tech Gala 2026  ',
        date: '2026-11-15',
        venue: 'Grand Arena',
      });
      expect(result.name).toBe('Tech Gala 2026');
      expect(result.date).toBe('2026-11-15');
      expect(result.venue).toBe('Grand Arena');
      expect(result.status).toBe('UPCOMING');
    });

    it('should reject update event with empty name', () => {
      expect(() =>
        validateUpdateEventInput({ name: '' })
      ).toThrow(ValidationError);
    });

    it('should reject ticket type with invalid usage policy', () => {
      expect(() =>
        validateCreateTicketTypeInput({ name: 'VIP', usagePolicy: 'INVALID_POLICY' })
      ).toThrow(ValidationError);
    });

    it('should accept ticket type with valid usage policy', () => {
      const result = validateCreateTicketTypeInput({ name: 'worker', usagePolicy: 'reusable' });
      expect(result.name).toBe('WORKER');
      expect(result.usagePolicy).toBe('REUSABLE');
    });
  });

  describe('Guest Input Validation', () => {
    it('should reject guest creation with missing name', () => {
      expect(() =>
        validateCreateGuestInput({ name: '', category: 'VIP' })
      ).toThrow(ValidationError);
    });

    it('should reject guest creation with malformed email', () => {
      expect(() =>
        validateCreateGuestInput({ name: 'Rahul Sharma', email: 'not-an-email', category: 'VIP' })
      ).toThrow(ValidationError);
    });

    it('should accept valid guest input with uppercase category', () => {
      const result = validateCreateGuestInput({
        name: '  Rahul Sharma  ',
        email: '  rahul@example.com  ',
        category: 'vip',
        phone: '+919876543210',
      });
      expect(result.name).toBe('Rahul Sharma');
      expect(result.email).toBe('rahul@example.com');
      expect(result.category).toBe('VIP');
      expect(result.phone).toBe('+919876543210');
    });

    it('should parse and bound query options', () => {
      const options = validateGuestQueryOptions({ limit: '100000', offset: '-5', search: ' Sharma ' });
      expect(options.limit).toBe(50000);
      expect(options.offset).toBe(0);
      expect(options.search).toBe('Sharma');
    });
  });

  describe('Event Service & Zero-Trust IDOR Prevention', () => {
    it('should auto-seed default ticket types when creating an event', async () => {
      const mockEventRepo: any = {
        create: jest.fn().mockResolvedValue({ id: 'evt-1', name: 'Annual Meet', date: '2026-10-10', createdBy: 'user-1' }),
      };
      const mockTicketTypeRepo: any = {
        createMany: jest.fn().mockResolvedValue([
          { id: 'tt-1', name: 'GENERAL', usagePolicy: 'SINGLE_USE' },
          { id: 'tt-2', name: 'VIP', usagePolicy: 'SINGLE_USE' },
          { id: 'tt-3', name: 'WORKER', usagePolicy: 'REUSABLE' },
        ]),
      };
      const mockUserRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'user-1' }),
      };

      const service = new EventService(mockEventRepo, mockTicketTypeRepo, mockUserRepo);
      const result = await service.createEvent('user-1', { name: 'Annual Meet', date: '2026-10-10' });

      expect(result.id).toBe('evt-1');
      expect(mockTicketTypeRepo.createMany).toHaveBeenCalled();
      expect(result.ticketTypes).toHaveLength(3);
    });

    it('should throw AuthorizationError when User B attempts to access User A event', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'evt-1', createdBy: 'user-A' }),
      };
      const service = new EventService(mockEventRepo, {} as any, {} as any);

      await expect(service.getEventById('evt-1', 'user-B')).rejects.toThrow(AuthorizationError);
      await expect(service.updateEvent('evt-1', 'user-B', { name: 'Hacked' })).rejects.toThrow(AuthorizationError);
      await expect(service.deleteEvent('evt-1', 'user-B')).rejects.toThrow(AuthorizationError);
      await expect(service.addTicketType('evt-1', 'user-B', { name: 'CUSTOM' })).rejects.toThrow(AuthorizationError);
    });

    it('should throw NotFoundError when accessing a non-existent event', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue(null),
      };
      const service = new EventService(mockEventRepo, {} as any, {} as any);

      await expect(service.getEventById('missing-evt', 'user-A')).rejects.toThrow(NotFoundError);
    });

    it('should prevent creating duplicate ticket type for an event', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'evt-1', createdBy: 'user-A' }),
      };
      const mockTicketTypeRepo: any = {
        findByEventAndName: jest.fn().mockResolvedValue({ id: 'tt-vip', name: 'VIP' }),
      };
      const service = new EventService(mockEventRepo, mockTicketTypeRepo, {} as any);

      await expect(
        service.addTicketType('evt-1', 'user-A', { name: 'VIP' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Guest Service & Event Scoping', () => {
    it('should throw AuthorizationError when User B manages guests for User A event', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'evt-1', createdBy: 'user-A' }),
      };
      const guestService = new GuestService({} as any, mockEventRepo, {} as any);

      await expect(
        guestService.createGuest('evt-1', 'user-B', { name: 'Guest 1', category: 'VIP' })
      ).rejects.toThrow(AuthorizationError);

      await expect(
        guestService.getGuestsByEvent('evt-1', 'user-B')
      ).rejects.toThrow(AuthorizationError);
    });

    it('should successfully create guest and auto-provision ticket type if absent', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'evt-1', createdBy: 'user-A' }),
      };
      const mockTicketTypeRepo: any = {
        findByEventAndName: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tt-spk', name: 'SPEAKER', usagePolicy: 'SINGLE_USE' }),
      };
      const mockGuestRepo: any = {
        create: jest.fn().mockResolvedValue({ id: 'g-1', eventId: 'evt-1', name: 'Dr. John', category: 'SPEAKER' }),
      };

      const guestService = new GuestService(mockGuestRepo, mockEventRepo, mockTicketTypeRepo);
      const result = await guestService.createGuest('evt-1', 'user-A', { name: 'Dr. John', category: 'SPEAKER' });

      expect(result.id).toBe('g-1');
      expect(result.name).toBe('Dr. John');
      expect(mockTicketTypeRepo.create).toHaveBeenCalledWith({
        eventId: 'evt-1',
        name: 'SPEAKER',
        label: 'SPEAKER',
        usagePolicy: 'SINGLE_USE',
      });
    });

    it('should reject accessing a guest that belongs to another event', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'evt-1', createdBy: 'user-A' }),
      };
      const mockGuestRepo: any = {
        findById: jest.fn().mockResolvedValue({ id: 'g-1', eventId: 'evt-OTHER', name: 'Alice' }),
      };

      const guestService = new GuestService(mockGuestRepo, mockEventRepo, {} as any);
      await expect(guestService.getGuestById('evt-1', 'g-1', 'user-A')).rejects.toThrow(NotFoundError);
      await expect(guestService.deleteGuest('evt-1', 'g-1', 'user-A')).rejects.toThrow(NotFoundError);
    });
  });

  describe('HTTP Route Security Enforcement (Supertest)', () => {
    it('GET /api/events should require authentication (401)', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/events should require authentication (401)', async () => {
      const res = await request(app).post('/api/events').send({ name: 'Test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/guests/events/:eventId should require authentication (401)', async () => {
      const res = await request(app).get('/api/guests/events/some-uuid');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/guests/events/:eventId should require authentication (401)', async () => {
      const res = await request(app).post('/api/guests/events/some-uuid').send({ name: 'Test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
