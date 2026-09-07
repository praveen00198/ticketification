import { TicketService } from '../src/modules/tickets/services/ticket.service';
import { NotFoundError, ValidationError } from '../src/middlewares/error.middleware';
import { isPngBuffer } from '../src/modules/tickets/services/ticket-image.service';
import { Writable } from 'stream';

describe('Phase 6: Ticket Downloads & Bulk Export Subsystem', () => {
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);

  describe('Individual Ticket Download', () => {
    it('should download a single ticket as genuine PNG with canonical filename', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'user_1',
        }),
      };

      const mockGuestRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'g_1',
          name: 'Rahul Sharma',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_1',
          eventId: 'evt_1',
          guestId: 'g_1',
          sequenceNumber: 1,
          usagePolicy: 'SINGLE_USE',
          assetPath: 'events/evt_1/tickets/ticket-TEC-00001.png',
        }),
      };

      const mockStorageServ: any = {
        downloadTicketImage: jest.fn().mockResolvedValue(validPngBuffer),
      };

      const service = new TicketService(
        mockTicketRepo,
        mockGuestRepo,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        mockStorageServ
      );

      const result = await service.downloadTicket('t_1', 'user_1');

      expect(result.contentType).toBe('image/png');
      expect(result.fileName).toBe('Rahul-Sharma-TEC-00001.png');
      expect(isPngBuffer(result.buffer)).toBe(true);
      expect(mockStorageServ.downloadTicketImage).toHaveBeenCalledWith(
        'events/evt_1/tickets/ticket-TEC-00001.png'
      );
    });

    it('should format <Ticket-ID>.png for unassigned worker tickets on download', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'user_1',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_worker',
          eventId: 'evt_1',
          guestId: null, // Unassigned
          sequenceNumber: 5,
          usagePolicy: 'REUSABLE',
          assetPath: 'events/evt_1/tickets/ticket-WRK-00005.png',
        }),
      };

      const mockStorageServ: any = {
        downloadTicketImage: jest.fn().mockResolvedValue(validPngBuffer),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        mockStorageServ
      );

      const result = await service.downloadTicket('t_worker', 'user_1');

      expect(result.contentType).toBe('image/png');
      expect(result.fileName).toBe('WRK-00005.png');
      expect(isPngBuffer(result.buffer)).toBe(true);
    });

    it('should enforce zero-trust IDOR and block unauthorized download', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue(null), // User 2 is not owner
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_1',
          eventId: 'evt_1',
          guestId: 'g_1',
        }),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      await expect(service.downloadTicket('t_1', 'unauthorized_user')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Bulk ZIP Export', () => {
    it(
      'should stream a ZIP archive of existing PNG assets with ZERO on-demand regeneration',
      async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'DevFest',
          createdBy: 'user_1',
        }),
      };

      const mockTicketRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([
          {
            ticket: {
              id: 't_1',
              sequenceNumber: 1,
              guestId: 'g_1',
              usagePolicy: 'SINGLE_USE',
              assetPath: 'events/evt_1/tickets/ticket-DEV-00001.png',
            },
            guest: { name: 'Aman Gupta' },
            ticketType: { name: 'VIP', usagePolicy: 'SINGLE_USE' },
          },
          {
            ticket: {
              id: 't_2',
              sequenceNumber: 2,
              guestId: null,
              usagePolicy: 'REUSABLE',
              assetPath: 'events/evt_1/tickets/ticket-WRK-00002.png',
            },
            guest: null,
            ticketType: { name: 'WORKER', usagePolicy: 'REUSABLE' },
          },
        ]),
      };

      const mockStorageServ: any = {
        downloadTicketImage: jest.fn().mockResolvedValue(validPngBuffer),
      };

      // Mock imageServ to guarantee it is NEVER called during ZIP streaming
      const mockImageServ: any = {
        renderBatchTickets: jest.fn(),
        launchBrowser: jest.fn(),
        svgToPng: jest.fn(),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        mockImageServ,
        mockStorageServ
      );

      const chunks: Buffer[] = [];
      const testStream = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      await service.streamTicketsZip('evt_1', 'user_1', testStream);

      const zipBuffer = Buffer.concat(chunks);

      // Verify ZIP magic bytes (PK\x03\x04)
      expect(zipBuffer[0]).toBe(0x50);
      expect(zipBuffer[1]).toBe(0x4b);
      expect(zipBuffer[2]).toBe(0x03);
      expect(zipBuffer[3]).toBe(0x04);

      // Verify ZERO on-demand regeneration occurred
      expect(mockImageServ.renderBatchTickets).not.toHaveBeenCalled();
      expect(mockImageServ.launchBrowser).not.toHaveBeenCalled();
      expect(mockImageServ.svgToPng).not.toHaveBeenCalled();

      // Verify storage downloads were invoked directly
      expect(mockStorageServ.downloadTicketImage).toHaveBeenCalledTimes(2);
    }, 25000);

    it('should throw ValidationError if no tickets exist for the event', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_empty', createdBy: 'user_1' }),
      };
      const mockTicketRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([]),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      const testStream = new Writable({
        write(_chunk, _encoding, cb) {
          cb();
        },
      });

      await expect(service.streamTicketsZip('evt_empty', 'user_1', testStream)).rejects.toThrow(
        ValidationError
      );
    });
  });
});
