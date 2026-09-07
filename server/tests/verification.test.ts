import { qrService } from '../src/modules/tickets/services/qr.service';
import { VerificationService } from '../src/modules/verification/services/verification.service';

describe('VerificationService & QrService Engine', () => {
  it('should generate cryptographically strong 64-character hex tokens', () => {
    const token1 = qrService.generateVerificationToken();
    const token2 = qrService.generateVerificationToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('should return INVALID for unrecognized token lookup', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
    };
    const mockCheckinRepo: any = {};
    const mockGuestRepo: any = {};

    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, mockGuestRepo);
    const result = await service.verifyToken('non_existent_token_123456');

    expect(result.status).toBe('INVALID');
    expect(result.ticket).toBeUndefined();
  });

  it('should return WRONG_EVENT when token belongs to another event', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { id: 't1', eventId: 'event_A', sequenceNumber: 1, status: 'ACTIVE', usagePolicy: 'SINGLE_USE' },
        guest: { name: 'Alice' },
        ticketType: { name: 'VIP', label: 'VIP Pass' },
        event: { name: 'Tech Conf 2026', date: '2026-10-10' },
      }),
    };
    const service = new VerificationService(mockTicketRepo, {} as any, {} as any);
    const result = await service.verifyToken('token_123', 'event_B');

    expect(result.status).toBe('WRONG_EVENT');
    expect(result.ticket?.eventName).toBe('Tech Conf 2026');
  });

  it('should return UNASSIGNED_WORKER for worker ticket without assigned guest', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { id: 't2', eventId: 'event_A', guestId: null, sequenceNumber: 10, status: 'ACTIVE', usagePolicy: 'REUSABLE' },
        guest: null,
        ticketType: { name: 'WORKER', label: 'Event Staff' },
        event: { name: 'Tech Conf 2026', date: '2026-10-10' },
      }),
    };
    const service = new VerificationService(mockTicketRepo, {} as any, {} as any);
    const result = await service.verifyToken('token_worker_123', 'event_A');

    expect(result.status).toBe('UNASSIGNED_WORKER');
    expect(result.ticket?.name).toBe('UNASSIGNED STAFF');
  });

  it('should return ALREADY_USED for checked-in single-use ticket', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { id: 't3', eventId: 'event_A', guestId: 'g1', sequenceNumber: 5, status: 'USED', usagePolicy: 'SINGLE_USE' },
        guest: { name: 'Bob' },
        ticketType: { name: 'GENERAL', label: 'General Admission' },
        event: { name: 'Tech Conf 2026', date: '2026-10-10' },
      }),
    };
    const mockCheckinRepo: any = {
      getLastCheckinForTicket: jest.fn().mockResolvedValue({
        checkedInAt: new Date('2026-10-10T10:00:00Z'),
      }),
    };
    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);
    const result = await service.verifyToken('token_bob_123', 'event_A');

    expect(result.status).toBe('ALREADY_USED');
    expect(result.ticket?.name).toBe('Bob');
  });

  describe('scanAndCheckIn (Atomic Automatic Flow)', () => {
    it('should return INVALID when token is missing or unknown', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue(null),
        findById: jest.fn().mockResolvedValue(null),
      };
      const service = new VerificationService(mockTicketRepo, {} as any, {} as any);
      const result = await service.scanAndCheckIn({ token: 'unknown_token' });

      expect(result.status).toBe('INVALID');
      expect(result.ticket).toBeUndefined();
    });

    it('should return WRONG_EVENT without checking in if eventId does not match', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue({
          ticket: { id: 't1', eventId: 'event_A', sequenceNumber: 1, status: 'ACTIVE', usagePolicy: 'SINGLE_USE' },
          guest: { name: 'Alice' },
          ticketType: { name: 'VIP', label: 'VIP Pass' },
          event: { name: 'Event A', date: '2026-10-10' },
        }),
      };
      const mockCheckinRepo: any = {
        create: jest.fn(),
      };
      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);
      const result = await service.scanAndCheckIn({ token: 'token_123', eventId: 'event_B' });

      expect(result.status).toBe('WRONG_EVENT');
      expect(mockCheckinRepo.create).not.toHaveBeenCalled();
    });

    it('should return UNASSIGNED_WORKER if worker ticket has no name provided and no guest assigned', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue({
          ticket: { id: 't2', eventId: 'event_A', guestId: null, sequenceNumber: 10, status: 'ACTIVE', usagePolicy: 'REUSABLE' },
          guest: null,
          ticketType: { name: 'WORKER', label: 'Event Staff' },
          event: { name: 'Event A', date: '2026-10-10' },
        }),
      };
      const mockCheckinRepo: any = {
        create: jest.fn(),
      };
      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);
      const result = await service.scanAndCheckIn({ token: 'worker_token', eventId: 'event_A' });

      expect(result.status).toBe('UNASSIGNED_WORKER');
      expect(mockCheckinRepo.create).not.toHaveBeenCalled();
    });

    it('should return ALREADY_USED when single-use ticket status is USED', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue({
          ticket: { id: 't3', eventId: 'event_A', guestId: 'g1', sequenceNumber: 5, status: 'USED', usagePolicy: 'SINGLE_USE' },
          guest: { name: 'Bob' },
          ticketType: { name: 'GENERAL', label: 'General Admission' },
          event: { name: 'Event A', date: '2026-10-10' },
        }),
      };
      const mockCheckinRepo: any = {
        getLastCheckinForTicket: jest.fn().mockResolvedValue({
          checkedInAt: new Date('2026-10-10T10:00:00Z'),
        }),
        create: jest.fn(),
      };
      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);
      const result = await service.scanAndCheckIn({ token: 'token_bob', eventId: 'event_A' });

      expect(result.status).toBe('ALREADY_USED');
      expect(mockCheckinRepo.create).not.toHaveBeenCalled();
      expect(result.message).toContain('already been checked in');
    });
  });
});

