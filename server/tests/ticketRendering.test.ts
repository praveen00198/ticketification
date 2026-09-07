import {
  isPngBuffer,
  formatTicketFileName,
  ticketImageService,
  TicketImageData,
} from '../src/modules/tickets/services/ticket-image.service';
import { qrService } from '../src/modules/tickets/services/qr.service';
import { TicketService } from '../src/modules/tickets/services/ticket.service';
import { NotFoundError } from '../src/middlewares/error.middleware';

describe('Phase 4: Ticket Generation & PNG Rendering Pipeline', () => {
  jest.setTimeout(15000);
  describe('PNG Binary Header Verification (isPngBuffer)', () => {
    it('should return true for a valid PNG buffer with magic bytes 0x89504E47', () => {
      // 8-byte standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
      const validPngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      expect(isPngBuffer(validPngHeader)).toBe(true);
    });

    it('should return false for SVG markup, plain text, or invalid buffers', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf-8');
      const textBuffer = Buffer.from('Hello World', 'utf-8');
      const shortBuffer = Buffer.from([0x89, 0x50]); // too short
      const emptyBuffer = Buffer.alloc(0);

      expect(isPngBuffer(svgBuffer)).toBe(false);
      expect(isPngBuffer(textBuffer)).toBe(false);
      expect(isPngBuffer(shortBuffer)).toBe(false);
      expect(isPngBuffer(emptyBuffer)).toBe(false);
      expect(isPngBuffer(null)).toBe(false);
      expect(isPngBuffer(undefined)).toBe(false);
    });
  });

  describe('Canonical Filename Formatting (formatTicketFileName)', () => {
    it('should format clean <Guest-Name>-<Ticket-ID>.png for named guests', () => {
      expect(formatTicketFileName('Rahul Sharma', 'GAN-00001')).toBe('Rahul-Sharma-GAN-00001.png');
      expect(formatTicketFileName('Priya Verma', 'EVT-00042')).toBe('Priya-Verma-EVT-00042.png');
    });

    it('should format <Ticket-ID>.png for unassigned workers or missing names', () => {
      expect(formatTicketFileName(null, 'WRK-00001')).toBe('WRK-00001.png');
      expect(formatTicketFileName('', 'WRK-00002')).toBe('WRK-00002.png');
      expect(formatTicketFileName('   ', 'WRK-00003')).toBe('WRK-00003.png');
      expect(formatTicketFileName('undefined', 'WRK-00004')).toBe('WRK-00004.png');
      expect(formatTicketFileName('null', 'WRK-00005')).toBe('WRK-00005.png');
    });

    it('should sanitize path traversal characters and illegal symbols in guest names', () => {
      const dirtyName = '../../etc/passwd/John..*Doe??';
      const result = formatTicketFileName(dirtyName, 'EVT-00001');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
      expect(result).not.toContain('?');
      expect(result).not.toContain('*');
      expect(result).toBe('etc-passwd-John-Doe-EVT-00001.png');
    });
  });

  describe('Cryptographic Opaque QR Tokens (qrService)', () => {
    it('should generate an opaque 64-character hex verification token', () => {
      const token = qrService.generateVerificationToken();
      expect(token).toBeDefined();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should generate unique tokens across invocations', () => {
      const token1 = qrService.generateVerificationToken();
      const token2 = qrService.generateVerificationToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate QR data URL containing verification token URL with zero raw PII', async () => {
      const token = qrService.generateVerificationToken();
      const qrDataUrl = await qrService.generateQrDataUrl(token);

      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
      // Ensure no raw PII leaks into token generator
      expect(token).not.toContain('@');
    });
  });

  describe('Visual Overlay Rules & FR-TCK-3 Enforcement', () => {
    it('should overlay Guest Name and QR Code, but NEVER visibly print Ticket ID', () => {
      const ticketData: TicketImageData = {
        ticketId: 'GAN-99999',
        guestName: 'Aman Gupta',
        eventName: 'DeepMind Gala',
        eventDate: '2026-10-15',
        ticketType: 'VIP Guest',
        qrCodeDataUrl: 'data:image/png;base64,mockqr',
      };

      const svg = ticketImageService.buildSvg(ticketData);

      // Must contain Guest Name
      expect(svg).toContain('Aman Gupta');

      // Must contain QR Code data URL
      expect(svg).toContain('data:image/png;base64,mockqr');

      // CRITICAL INVARIANT (FR-TCK-3): Ticket ID MUST NOT be visibly printed on the image
      expect(svg).not.toContain('GAN-99999');
    });
  });

  describe('Ticket Service Pipeline & Zero SVG Storage', () => {
    const mockValidPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    it('should generate genuine PNG tickets and upload ONLY image/png to Supabase Storage', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Tech Summit',
          date: '2026-11-01',
          createdBy: 'user_1',
        }),
      };

      const mockGuestRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([
          { id: 'g_1', name: 'Alice Cooper', category: 'VIP' },
          { id: 'g_2', name: 'Bob Dylan', category: 'GENERAL' },
        ]),
      };

      const mockTicketRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([]), // No existing tickets
        getNextSequenceNumber: jest.fn().mockResolvedValue(1),
        createMany: jest.fn().mockImplementation((records) => Promise.resolve(records)),
      };

      const mockTicketTypeRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([
          { id: 'tt_vip', name: 'VIP', label: 'VIP Guest', usagePolicy: 'SINGLE_USE' },
          { id: 'tt_gen', name: 'GENERAL', label: 'General Guest', usagePolicy: 'SINGLE_USE' },
        ]),
      };

      const uploadedFiles: Array<{ path: string; contentType: string; buffer: Buffer }> = [];
      const mockStorageServ: any = {
        isConfigured: jest.fn().mockReturnValue(true),
        uploadTicketImage: jest.fn().mockImplementation((storagePath, buffer, contentType) => {
          uploadedFiles.push({ path: storagePath, contentType, buffer });
          return Promise.resolve({
            publicUrl: `https://cdn.supabase.co/${storagePath}`,
            storagePath,
          });
        }),
      };

      const mockImageServ: any = {
        renderBatchTickets: jest.fn().mockImplementation((items) => {
          return Promise.resolve(
            items.map((item: any) => ({
              ticketId: item.ticketId,
              pngBuffer: mockValidPngBuffer,
              fileName: `ticket-${item.ticketId}.png`,
            }))
          );
        }),
      };

      const mockQrServ: any = {
        generateVerificationToken: jest.fn().mockReturnValue('a'.repeat(64)),
        generateQrDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,mockqrdataurl'),
      };

      const service = new TicketService(
        mockTicketRepo,
        mockGuestRepo,
        mockEventRepo,
        mockTicketTypeRepo,
        mockQrServ,
        mockImageServ,
        mockStorageServ
      );

      const result = await service.generateTicketsForEvent('evt_1', 'user_1');

      expect(result.generatedCount).toBe(2);
      expect(uploadedFiles).toHaveLength(2);

      // ZERO SVG INVARIANT: verify all uploads are genuine PNGs
      for (const upload of uploadedFiles) {
        expect(upload.path).toMatch(/\.png$/);
        expect(upload.path).not.toMatch(/\.svg$/);
        expect(upload.contentType).toBe('image/png');
        expect(isPngBuffer(upload.buffer)).toBe(true);
      }
    });

    it('should generate unassigned worker passes as genuine PNGs with REUSABLE policy', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({
          id: 'evt_1',
          name: 'Festival',
          date: '2026-12-01',
          createdBy: 'user_1',
        }),
      };

      const mockTicketRepo: any = {
        getNextSequenceNumber: jest.fn().mockResolvedValue(1),
        createMany: jest.fn().mockImplementation((records) => Promise.resolve(records)),
      };

      const mockTicketTypeRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([
          { id: 'tt_wrk', name: 'WORKER', label: 'Event Staff', usagePolicy: 'REUSABLE' },
        ]),
      };

      const uploadedFiles: Array<{ path: string; contentType: string }> = [];
      const mockStorageServ: any = {
        isConfigured: jest.fn().mockReturnValue(true),
        uploadTicketImage: jest.fn().mockImplementation((storagePath, _buf, contentType) => {
          uploadedFiles.push({ path: storagePath, contentType });
          return Promise.resolve({
            publicUrl: `https://cdn.supabase.co/${storagePath}`,
            storagePath,
          });
        }),
      };

      const mockImageServ: any = {
        renderBatchTickets: jest.fn().mockImplementation((items) => {
          return Promise.resolve(
            items.map((item: any) => ({
              ticketId: item.ticketId,
              pngBuffer: mockValidPngBuffer,
              fileName: `ticket-${item.ticketId}.png`,
            }))
          );
        }),
      };

      const mockQrServ: any = {
        generateVerificationToken: jest.fn().mockReturnValue('b'.repeat(64)),
        generateQrDataUrl: jest.fn().mockResolvedValue('data:image/png;base64,mockqrdataurl'),
      };

      const service = new TicketService(
        mockTicketRepo,
        {} as any,
        mockEventRepo,
        mockTicketTypeRepo,
        mockQrServ,
        mockImageServ,
        mockStorageServ
      );

      const result = await service.generateUnassignedWorkerTickets('evt_1', 'user_1', 3, 'WORKER');

      expect(result.tickets).toHaveLength(3);
      for (const t of result.tickets) {
        expect(t.guestId).toBeNull();
        expect(t.usagePolicy).toBe('REUSABLE');
      }

      expect(uploadedFiles).toHaveLength(3);
      for (const upload of uploadedFiles) {
        expect(upload.path).toMatch(/^events\/evt_1\/tickets\/ticket-WRK-\d{5}\.png$/);
        expect(upload.contentType).toBe('image/png');
      }
    });

    it('should enforce zero-trust event ownership and block unauthorized generation', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue(null), // User 2 is not owner
      };

      const service = new TicketService(
        {} as any,
        {} as any,
        mockEventRepo,
        {} as any,
        qrService,
        {} as any,
        {} as any
      );

      await expect(service.generateTicketsForEvent('evt_1', 'unauthorized_user')).rejects.toThrow(
        NotFoundError
      );
      await expect(
        service.generateUnassignedWorkerTickets('evt_1', 'unauthorized_user', 5)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Container-Safe Native Sharp Rasterization & Regression Prevention', () => {
    it('should successfully rasterize SVG to genuine PNG buffer using sharp without launching Chromium', async () => {
      const ticketData: TicketImageData = {
        ticketId: 'REG-00001',
        guestName: 'Kavita Singh',
        eventName: 'National Conclave',
        eventDate: '2026-11-20',
        ticketType: 'VIP Guest',
        qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      };

      const svg = ticketImageService.buildSvg(ticketData);
      const pngBuffer = await ticketImageService.svgToPng(svg);

      expect(pngBuffer).toBeDefined();
      expect(pngBuffer.length).toBeGreaterThan(1000);
      expect(isPngBuffer(pngBuffer)).toBe(true);
    });

    it('should batch render tickets natively without requiring browser processes', async () => {
      const items: TicketImageData[] = [
        {
          ticketId: 'BATCH-001',
          guestName: 'Guest One',
          eventName: 'Summit',
          eventDate: '2026-10-10',
          ticketType: 'General',
          qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        },
        {
          ticketId: 'BATCH-002',
          guestName: 'Guest Two',
          eventName: 'Summit',
          eventDate: '2026-10-10',
          ticketType: 'VIP',
          qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        },
      ];

      const results = await ticketImageService.renderBatchTickets(items, 2);

      expect(results).toHaveLength(2);
      for (const res of results) {
        expect(res.fileName).toMatch(/^ticket-BATCH-\d{3}\.png$/);
        expect(isPngBuffer(res.pngBuffer)).toBe(true);
      }
    });

    it('should correctly embed bundled Noto Sans Devanagari font and render complex Hindi text and conjuncts', async () => {
      const devanagariPhrases = [
        '|| श्री गणेशाय नमः ||',
        'राहुल शर्मा',
        'आपका हार्दिक स्वागत है',
        'गणेश चतुर्थी',
        'शुभारंभ',
        'प्रवेश पत्र',
        'क्षत्रिय एवं ज्ञान',
      ];

      for (const phrase of devanagariPhrases) {
        const ticketData: TicketImageData = {
          ticketId: 'HINDI-001',
          guestName: phrase,
          eventName: 'महा उत्सव',
          eventDate: '2026-11-25',
          ticketType: 'विशेष अतिथि',
          qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        };

        const svg = ticketImageService.buildSvg(ticketData);

        // Verify that Noto Sans Devanagari is embedded via @font-face
        expect(svg).toContain('Noto Sans Devanagari');
        expect(svg).toContain('data:font/truetype;charset=utf-8;base64,');
        expect(svg).toContain(phrase.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

        // Render to genuine PNG and verify binary signature
        const pngBuf = await ticketImageService.svgToPng(svg);
        expect(pngBuf).toBeDefined();
        expect(pngBuf.length).toBeGreaterThan(5000);
        expect(isPngBuffer(pngBuf)).toBe(true);
      }
    });
  });
});


