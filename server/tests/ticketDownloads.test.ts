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

    it('authorized attendee can download their own ticket using email match', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'host_1',
        }),
      };

      const mockGuestRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'g_attendee',
          name: 'Alice Attendee',
          email: 'alice@example.com',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_alice',
          eventId: 'evt_1',
          guestId: 'g_attendee',
          sequenceNumber: 10,
          usagePolicy: 'SINGLE_USE',
          assetPath: 'events/evt_1/tickets/ticket-TEC-00010.png',
        }),
      };

      const mockStorageServ: any = {
        downloadTicketImage: jest.fn().mockResolvedValue(validPngBuffer),
        createPresignedDownloadUrl: jest
          .fn()
          .mockResolvedValue('https://storage.supabase.co/signed/alice-ticket?token=secret123'),
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

      const presigned = await service.getPresignedTicketDownloadUrl('t_alice', {
        userId: 'alice_user_id',
        userEmail: 'alice@example.com',
        scopedEventId: 'evt_1',
      });

      expect(presigned).not.toBeNull();
      expect(presigned?.url).toBe('https://storage.supabase.co/signed/alice-ticket?token=secret123');
      expect(presigned?.fileName).toBe('Alice-Attendee-TEC-00010.png');
      expect(mockStorageServ.createPresignedDownloadUrl).toHaveBeenCalledWith(
        'events/evt_1/tickets/ticket-TEC-00010.png',
        900,
        { download: 'Alice-Attendee-TEC-00010.png' }
      );
    });

    it('rejects cross-event ticket download when scopedEventId does not match ticket eventId', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'host_1',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_cross',
          eventId: 'evt_1',
          guestId: 'g_1',
          sequenceNumber: 1,
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

      // Attempting to download via event2 route for a ticket belonging to event1
      await expect(
        service.getPresignedTicketDownloadUrl('t_cross', {
          userId: 'host_1',
          scopedEventId: 'evt_2_other',
        })
      ).rejects.toThrow('Ticket not found in this event');
    });

    it('createPresignedDownloadUrl failure throws StorageError and NEVER returns public URL', async () => {
      const { SupabaseStorageService } = await import(
        '../src/modules/tickets/services/supabase-storage.service'
      );
      const storageService = new SupabaseStorageService();

      const mockStorage = {
        createSignedUrl: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Supabase storage gateway timeout' },
        }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://leak.storage.supabase.co/public/private-ticket.png' },
        }),
      };

      const mockClient = {
        storage: {
          from: jest.fn().mockReturnValue(mockStorage),
        },
      };

      jest.spyOn(storageService as any, 'client', 'get').mockReturnValue(mockClient);

      await expect(
        storageService.createPresignedDownloadUrl('events/evt_1/tickets/ticket-001.png', 900)
      ).rejects.toThrow(/Failed to generate signed download URL for private asset/);

      // Verify that public URL was NEVER fetched or returned
      expect(mockStorage.getPublicUrl).not.toHaveBeenCalled();
    });

    it('missing stored file throws controlled NotFoundError', async () => {
      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'host_1',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_missing_file',
          eventId: 'evt_1',
          guestId: null,
          sequenceNumber: 1,
          assetPath: 'events/evt_1/tickets/missing.png',
        }),
      };

      const mockStorageServ: any = {
        downloadTicketImage: jest.fn().mockRejectedValue(new Error('Object not found in storage')),
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

      await expect(service.downloadTicket('t_missing_file', 'host_1')).rejects.toThrow(
        'Stored ticket PNG asset could not be located in storage'
      );
    });

    it('invalid or non-existent ticket ID throws controlled NotFoundError', async () => {
      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue(null),
        findByVerificationToken: jest.fn().mockResolvedValue(null),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );

      await expect(service.downloadTicket('non_existent_id', 'user_1')).rejects.toThrow(
        'Ticket not found'
      );
    });

    it('no secret or signed URL appears in logs during download flow', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const mockEventRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Gala',
          createdBy: 'host_1',
        }),
      };

      const mockTicketRepo: any = {
        findById: jest.fn().mockResolvedValue({
          id: 't_log_test',
          eventId: 'evt_1',
          guestId: null,
          sequenceNumber: 1,
          assetPath: 'events/evt_1/tickets/ticket-001.png',
        }),
      };

      const signedUrlSecret = 'https://storage.supabase.co/signed/t-001.png?token=SECRET_JWT_KEY_999';
      const mockStorageServ: any = {
        createPresignedDownloadUrl: jest.fn().mockResolvedValue(signedUrlSecret),
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

      await service.getPresignedTicketDownloadUrl('t_log_test', 'host_1');

      const allLoggedMessages = [
        ...logSpy.mock.calls,
        ...infoSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...errorSpy.mock.calls,
      ].flat().join(' ');

      expect(allLoggedMessages).not.toContain('SECRET_JWT_KEY_999');
      expect(allLoggedMessages).not.toContain(signedUrlSecret);

      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
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
