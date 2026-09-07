import { VerificationService } from '../src/modules/verification/services/verification.service';
import { AppError } from '../src/middlewares/error.middleware';

describe('Phase 8: Worker Reusable Workflow Subsystem', () => {
  const mockWorkerTicket: {
    id: string;
    eventId: string;
    guestId: string | null;
    sequenceNumber: number;
    status: string;
    usagePolicy: string;
    verificationToken: string;
  } = {
    id: 't_worker_1',
    eventId: 'evt_tech_gala',
    guestId: null, // Initially unassigned
    sequenceNumber: 50,
    status: 'ACTIVE',
    usagePolicy: 'REUSABLE',
    verificationToken: 'worker_crypto_token_50',
  };

  const mockTicketType = {
    id: 'tt_worker',
    name: 'WORKER',
    label: 'Event Staff',
    usagePolicy: 'REUSABLE',
  };

  const mockEvent = {
    id: 'evt_tech_gala',
    name: 'Tech Gala 2026',
    date: '2026-11-20',
  };

  it('should return UNASSIGNED_WORKER status on first scan when pass is unassigned and no name provided', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { ...mockWorkerTicket },
        guest: null,
        ticketType: mockTicketType,
        event: mockEvent,
      }),
      findById: jest.fn().mockResolvedValue({
        ticket: { ...mockWorkerTicket },
        guest: null,
        ticketType: mockTicketType,
        event: mockEvent,
      }),
    };

    const mockCheckinRepo: any = {
      create: jest.fn(),
    };

    const mockGuestRepo: any = {
      create: jest.fn(),
    };

    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, mockGuestRepo);

    const result = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala',
    });

    expect(result.status).toBe('UNASSIGNED_WORKER');
    expect(result.message).toContain('Please assign staff member name');
    expect(result.ticket?.name).toBe('UNASSIGNED STAFF');
    expect(result.ticket?.usagePolicy).toBe('REUSABLE');
    expect(mockGuestRepo.create).not.toHaveBeenCalled();
    expect(mockCheckinRepo.create).not.toHaveBeenCalled();
  });

  it('should assign worker name and atomically check in on first entry when name is provided', async () => {
    let ticketState = { ...mockWorkerTicket };
    let assignedGuestRecord: any = null;

    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockImplementation(async () => ({
        ticket: ticketState,
        guest: assignedGuestRecord,
        ticketType: mockTicketType,
        event: mockEvent,
      })),
      findById: jest.fn().mockImplementation(async () => ({
        ticket: ticketState,
        guest: assignedGuestRecord,
        ticketType: mockTicketType,
        event: mockEvent,
      })),
      assignGuest: jest.fn().mockImplementation(async (ticketId: string, guestId: string) => {
        ticketState = { ...ticketState, guestId };
        return ticketState;
      }),
    };

    const mockGuestRepo: any = {
      create: jest.fn().mockImplementation(async (data: any) => {
        assignedGuestRecord = {
          id: 'g_assigned_1',
          name: data.name,
          category: data.category,
          eventId: data.eventId,
        };
        return assignedGuestRecord;
      }),
    };

    const mockCheckinRepo: any = {
      create: jest.fn().mockResolvedValue({
        id: 'chk_worker_1',
        ticketId: 't_worker_1',
        eventId: 'evt_tech_gala',
        checkedInAt: new Date('2026-11-20T08:30:00Z'),
        workerNameAssigned: 'Kavita Joshi',
      }),
    };

    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, mockGuestRepo);

    const result = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala',
      workerName: 'Kavita Joshi',
      verifiedBy: 'head_organizer@example.com',
    });

    expect(result.status).toBe('VALID_WORKER');
    expect(result.message).toContain('Worker check-in recorded for Kavita Joshi');
    expect(result.workerName).toBe('Kavita Joshi');
    expect(result.guestName).toBe('Kavita Joshi');
    expect(mockGuestRepo.create).toHaveBeenCalledWith({
      eventId: 'evt_tech_gala',
      name: 'Kavita Joshi',
      category: 'WORKER',
    });
    expect(mockTicketRepo.assignGuest).toHaveBeenCalledWith('t_worker_1', 'g_assigned_1');
    expect(mockCheckinRepo.create).toHaveBeenCalledWith({
      ticketId: 't_worker_1',
      eventId: 'evt_tech_gala',
      verifiedBy: 'head_organizer@example.com',
      workerNameAssigned: 'Kavita Joshi',
    });
  });

  it('should allow multiple subsequent re-entries for assigned worker pass with VALID_WORKER', async () => {
    const assignedGuest = {
      id: 'g_assigned_1',
      name: 'Kavita Joshi',
      organization: 'Catering Crew',
      designation: 'Chef Lead',
    };

    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { ...mockWorkerTicket, guestId: 'g_assigned_1' },
        guest: assignedGuest,
        ticketType: mockTicketType,
        event: mockEvent,
      }),
      findById: jest.fn().mockResolvedValue({
        ticket: { ...mockWorkerTicket, guestId: 'g_assigned_1' },
        guest: assignedGuest,
        ticketType: mockTicketType,
        event: mockEvent,
      }),
      // Worker passes must NEVER call markAsUsedAtomic
      markAsUsedAtomic: jest.fn(),
    };

    let checkinCount = 0;
    const mockCheckinRepo: any = {
      create: jest.fn().mockImplementation(async () => {
        checkinCount++;
        return {
          id: `chk_worker_${checkinCount}`,
          checkedInAt: new Date(),
        };
      }),
    };

    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

    // Entry 1 (e.g. morning gate entry)
    const scan1 = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala',
    });

    // Entry 2 (e.g. returning from lunch)
    const scan2 = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala',
    });

    // Entry 3 (e.g. evening shift)
    const scan3 = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala',
    });

    expect(scan1.status).toBe('VALID_WORKER');
    expect(scan2.status).toBe('VALID_WORKER');
    expect(scan3.status).toBe('VALID_WORKER');

    expect(scan1.ticket?.name).toBe('Kavita Joshi');
    expect(scan2.ticket?.name).toBe('Kavita Joshi');
    expect(scan3.ticket?.name).toBe('Kavita Joshi');

    // Ensure 3 independent audit records were logged
    expect(mockCheckinRepo.create).toHaveBeenCalledTimes(3);
    // Ensure worker ticket was never marked used
    expect(mockTicketRepo.markAsUsedAtomic).not.toHaveBeenCalled();
  });

  it('should enforce event scoping and reject worker pass scanned at a different event', async () => {
    const mockTicketRepo: any = {
      findByVerificationToken: jest.fn().mockResolvedValue({
        ticket: { ...mockWorkerTicket, eventId: 'evt_conference_2026' },
        guest: { id: 'g_worker', name: 'Security Staff' },
        ticketType: mockTicketType,
        event: { id: 'evt_conference_2026', name: 'Conference 2026' },
      }),
    };

    const mockCheckinRepo: any = { create: jest.fn() };
    const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

    const result = await service.scanAndCheckIn({
      token: 'worker_crypto_token_50',
      eventId: 'evt_tech_gala', // Scanner active on Tech Gala
    });

    expect(result.status).toBe('WRONG_EVENT');
    expect(result.message).toContain('Conference 2026');
    expect(mockCheckinRepo.create).not.toHaveBeenCalled();
  });
});
