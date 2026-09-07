import { VerificationService } from '../src/modules/verification/services/verification.service';
import { AppError } from '../src/middlewares/error.middleware';

describe('Phase 7: QR Verification & Atomic Check-In Subsystem', () => {
  describe('Single-Use Atomic Check-In & Race-Condition Prevention', () => {
    it('should atomically check in an ACTIVE single-use ticket and record audit log', async () => {
      const mockTicket = {
        id: 't_active_1',
        eventId: 'evt_1',
        guestId: 'g_1',
        sequenceNumber: 101,
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        verificationToken: 'valid_token_101',
      };

      const mockRecord = {
        ticket: mockTicket,
        guest: { id: 'g_1', name: 'Siddharth Rao', organization: 'TechCorp' },
        ticketType: { name: 'VIP', label: 'VIP Pass' },
        event: { id: 'evt_1', name: 'Tech Gala 2026', date: '2026-11-20' },
      };

      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue(mockRecord),
        findById: jest.fn().mockResolvedValue(mockRecord),
        // Returns the updated row on successful atomic transition
        markAsUsedAtomic: jest.fn().mockResolvedValue({
          ...mockTicket,
          status: 'USED',
          updatedAt: new Date(),
        }),
      };

      const mockCheckinRepo: any = {
        create: jest.fn().mockResolvedValue({
          id: 'chk_1',
          ticketId: 't_active_1',
          eventId: 'evt_1',
          checkedInAt: new Date('2026-11-20T10:00:00Z'),
        }),
      };

      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

      const result = await service.scanAndCheckIn({
        token: 'valid_token_101',
        eventId: 'evt_1',
        verifiedBy: 'gate_scanner@example.com',
      });

      expect(result.status).toBe('VALID');
      expect(result.message).toContain('Checked in successfully: Siddharth Rao');
      expect(mockTicketRepo.markAsUsedAtomic).toHaveBeenCalledWith('t_active_1');
      expect(mockCheckinRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 't_active_1',
          eventId: 'evt_1',
          verifiedBy: 'gate_scanner@example.com',
        })
      );
    });

    it('should prevent race condition on concurrent scans: exactly ONE succeeds, subsequent scan returns ALREADY_USED', async () => {
      const mockTicket = {
        id: 't_active_concurrent',
        eventId: 'evt_1',
        guestId: 'g_concurrent',
        sequenceNumber: 102,
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        verificationToken: 'token_concurrent_102',
      };

      const mockRecord = {
        ticket: mockTicket,
        guest: { id: 'g_concurrent', name: 'Ananya Sharma' },
        ticketType: { name: 'GENERAL', label: 'General Pass' },
        event: { id: 'evt_1', name: 'Tech Gala 2026', date: '2026-11-20' },
      };

      let statusUpdated = false;
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue(mockRecord),
        findById: jest.fn().mockResolvedValue(mockRecord),
        // Simulates atomic database row-lock: only the first call transitions status
        markAsUsedAtomic: jest.fn().mockImplementation(async () => {
          if (!statusUpdated) {
            statusUpdated = true;
            return { ...mockTicket, status: 'USED' };
          }
          return null; // Database rejected update because status was no longer ACTIVE
        }),
      };

      const mockCheckinRepo: any = {
        create: jest.fn().mockResolvedValue({
          id: 'chk_first',
          checkedInAt: new Date(),
        }),
        getLastCheckinForTicket: jest.fn().mockResolvedValue({
          checkedInAt: new Date('2026-11-20T10:05:00Z'),
        }),
      };

      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

      // Run 2 simultaneous scan requests
      const [res1, res2] = await Promise.all([
        service.scanAndCheckIn({ token: 'token_concurrent_102', eventId: 'evt_1' }),
        service.scanAndCheckIn({ token: 'token_concurrent_102', eventId: 'evt_1' }),
      ]);

      const validCount = [res1, res2].filter((r) => r.status === 'VALID').length;
      const alreadyUsedCount = [res1, res2].filter((r) => r.status === 'ALREADY_USED').length;

      expect(validCount).toBe(1);
      expect(alreadyUsedCount).toBe(1);
      // Ensure only 1 audit row was created
      expect(mockCheckinRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictError (409) in checkInTicket when double check-in occurs', async () => {
      const mockTicket = {
        id: 't_double',
        eventId: 'evt_1',
        guestId: 'g_1',
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        verificationToken: 'token_double',
      };

      const mockRecord = {
        ticket: mockTicket,
        guest: { id: 'g_1', name: 'Karan Mehra' },
        ticketType: { name: 'VIP', label: 'VIP' },
        event: { id: 'evt_1', name: 'Tech Gala 2026' },
      };

      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue(mockRecord),
        findById: jest.fn().mockResolvedValue(mockRecord),
        // DB returns null because ticket is already used
        markAsUsedAtomic: jest.fn().mockResolvedValue(null),
      };

      const mockCheckinRepo: any = {
        getLastCheckinForTicket: jest.fn().mockResolvedValue({
          checkedInAt: new Date('2026-11-20T09:30:00Z'),
        }),
      };

      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

      await expect(
        service.checkInTicket({ token: 'token_double', eventId: 'evt_1' })
      ).rejects.toThrow(AppError);

      await expect(
        service.checkInTicket({ token: 'token_double', eventId: 'evt_1' })
      ).rejects.toThrow(/DOUBLE CHECK-IN PREVENTED/);
    });
  });

  describe('Event Scoping & Security Enforcement', () => {
    it('should reject ticket with WRONG_EVENT when scanned at a different event', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue({
          ticket: {
            id: 't_eventA',
            eventId: 'event_AAA',
            status: 'ACTIVE',
            usagePolicy: 'SINGLE_USE',
          },
          guest: { name: 'Vikram Singh' },
          ticketType: { name: 'VIP', label: 'VIP Pass' },
          event: { id: 'event_AAA', name: 'Annual Conference', date: '2026-12-01' },
        }),
      };

      const mockCheckinRepo: any = {
        create: jest.fn(),
      };

      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

      const result = await service.scanAndCheckIn({
        token: 'token_eventA',
        eventId: 'event_BBB', // Scanner is active for event BBB
      });

      expect(result.status).toBe('WRONG_EVENT');
      expect(result.message).toContain('Annual Conference');
      expect(mockCheckinRepo.create).not.toHaveBeenCalled();
    });

    it('should reject CANCELLED tickets without creating a check-in record', async () => {
      const mockTicketRepo: any = {
        findByVerificationToken: jest.fn().mockResolvedValue({
          ticket: {
            id: 't_cancelled',
            eventId: 'evt_1',
            status: 'CANCELLED',
            usagePolicy: 'SINGLE_USE',
          },
          guest: { name: 'Cancelled Guest' },
          ticketType: { name: 'GENERAL', label: 'General Pass' },
          event: { id: 'evt_1', name: 'Tech Gala 2026' },
        }),
      };

      const mockCheckinRepo: any = {
        create: jest.fn(),
      };

      const service = new VerificationService(mockTicketRepo, mockCheckinRepo, {} as any);

      const result = await service.scanAndCheckIn({
        token: 'token_cancelled',
        eventId: 'evt_1',
      });

      expect(result.status).toBe('CANCELLED');
      expect(mockCheckinRepo.create).not.toHaveBeenCalled();
    });
  });
});
