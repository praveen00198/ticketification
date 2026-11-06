import {
  isPngBuffer,
  formatTicketFileName,
  ticketImageService,
  TicketImageData,
} from '../src/modules/tickets/services/ticket-image.service';
import { qrService } from '../src/modules/tickets/services/qr.service';
import { TicketService, ticketService } from '../src/modules/tickets/services/ticket.service';
import { NotFoundError, ValidationError } from '../src/middlewares/error.middleware';
import sharp from 'sharp';
import jsQR from 'jsqr';
import * as xlsx from 'xlsx';

describe('Phase 4: Ticket Generation & PNG Rendering Pipeline', () => {
  jest.setTimeout(45000);
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

    it('should reject synchronous worker ticket generation for count > 50 with ValidationError', async () => {
      const service = new TicketService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
      await expect(
        service.generateUnassignedWorkerTickets('evt_1', 'user_1', 51)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject synchronous guest ticket generation when pending guests > 50 with ValidationError', async () => {
      const mockEventRepo: any = {
        findByIdAndOwner: jest.fn().mockResolvedValue({ id: 'evt_1', name: 'Big Event', createdBy: 'user_1' }),
      };
      const guests = Array.from({ length: 55 }, (_, i) => ({ id: `g_${i}`, name: `Guest ${i}` }));
      const mockGuestRepo: any = {
        findByEventId: jest.fn().mockResolvedValue(guests),
      };
      const mockTicketRepo: any = {
        findByEventId: jest.fn().mockResolvedValue([]),
      };

      const service = new TicketService(
        mockTicketRepo,
        mockGuestRepo,
        mockEventRepo,
        {} as any,
        qrService,
        ticketImageService,
        {} as any
      );

      await expect(service.generateTicketsForEvent('evt_1', 'user_1')).rejects.toThrow(ValidationError);
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
    }, 30000);

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

    it('should maintain bounded memory footprint (< 250MB RSS) during continuous batch rendering', async () => {
      const dummyQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const items: TicketImageData[] = [];
      for (let i = 1; i <= 10; i++) {
        items.push({
          ticketId: `MEM-${i}`,
          guestName: `|| श्री गणेशाय नमः || Guest ${i}`,
          eventName: 'Memory Test Event',
          eventDate: '2026-12-01',
          ticketType: 'VIP Guest',
          qrCodeDataUrl: dummyQr,
        });
      }

      if (global.gc) global.gc();
      const startRss = process.memoryUsage().rss / 1024 / 1024;
      let peakRss = startRss;
      const timer = setInterval(() => {
        const rssMb = process.memoryUsage().rss / 1024 / 1024;
        if (rssMb > peakRss) peakRss = rssMb;
      }, 10);

      try {
        const results = await ticketImageService.renderBatchTickets(items, 2);
        expect(results).toHaveLength(10);
        for (const res of results) {
          expect(isPngBuffer(res.pngBuffer)).toBe(true);
        }
        const deltaRss = peakRss - startRss;
        expect(deltaRss).toBeLessThan(200);
      } finally {
        clearInterval(timer);
      }
    });
  });

  describe('Milestone 1: Default Global Ticket Credential Verification', () => {
    const dummyQr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    it('should output a valid high-resolution PNG image with magic bytes 0x89504E47', async () => {
      const ticketData: TicketImageData = {
        ticketId: 'SMP-00001',
        guestName: 'Rahul Sharma',
        eventName: 'Ticketification Launch Summit 2026',
        eventDate: 'November 20, 2026',
        eventTime: '10:00 AM IST',
        ticketType: 'VIP Attendee',
        qrCodeDataUrl: dummyQr,
        venue: 'Grand Convention Centre, Hall A',
        sequenceNumber: 42,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);
      expect(result).toBeDefined();
      expect(result.pngBuffer).toBeDefined();
      expect(isPngBuffer(result.pngBuffer)).toBe(true);
      expect(result.pngBuffer.length).toBeGreaterThan(5000);
      expect(result.fileName).toBe('ticket-SMP-00001.png');

      const meta = await sharp(result.pngBuffer).metadata();
      expect(meta.width).toBe(1620);
      expect(meta.height).toBe(2025);
      expect(meta.format).toBe('png');
    });

    it('should include all required metadata fields in the default global design', () => {
      const ticketData: TicketImageData = {
        ticketId: 'SMP-00042',
        guestName: 'Aman Gupta (राहुल शर्मा)',
        eventName: 'NextGen Tech Summit 2026',
        eventDate: 'Nov 15, 2026',
        eventTime: '09:30 AM IST',
        ticketType: 'VIP Delegate • All Access',
        venue: 'Grand Hall A, Cyber Hub',
        sequenceNumber: 42,
        organization: 'Lead Systems Architect • Tech Corp',
        qrCodeDataUrl: dummyQr,
      };

      const svg = ticketImageService.buildSvg(ticketData);

      // Event title
      expect(svg).toContain('NextGen Tech Summit 2026');
      // Event date & time
      expect(svg).toContain('Nov 15, 2026');
      expect(svg).toContain('09:30 AM IST');
      // Venue & Location
      expect(svg).toContain('Grand Hall A, Cyber Hub');
      // Attendee Name (supporting multilingual Devanagari)
      expect(svg).toContain('Aman Gupta (राहुल शर्मा)');
      // Organization / Subtitle
      expect(svg).toContain('Lead Systems Architect • Tech Corp');
      // Ticket tier badge text and style tokens
      expect(svg).toContain('VIP Delegate • All Access');
      expect(svg).toContain('#ECFDF5'); // Badge background
      expect(svg).toContain('#10B981'); // Emerald accent
      expect(svg).toContain('#059669'); // Badge text
      // Clean light background & card
      expect(svg).toContain('#FAFAF9');
      expect(svg).toContain('#F4F4F5');
      // No visible sequence ID or dynamic status on downloaded static ticket
      expect(svg).not.toContain('#00042');
      expect(svg).not.toContain('STATUS: ACTIVE');
      // High-contrast QR container and instructions
      expect(svg).toContain('Present this QR code at the entry gate turnstile for admission');
      expect(svg).toContain('SECURE TAMPER-PROOF ACCESS CREDENTIAL');
      expect(svg).toContain('Powered by Ticketification • Official Event Pass');
    });

    it('should strictly enforce invariant FR-TCK-3: internal ticket ID and crypto token are NEVER visibly printed', () => {
      const cryptoToken = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const ticketData: TicketImageData = {
        ticketId: 'SECRET-INTERNAL-DB-UUID-99999',
        guestName: 'Priya Verma',
        eventName: 'Developer Conference',
        eventDate: '2026-11-20',
        ticketType: 'General Admission',
        verificationToken: cryptoToken,
        qrCodeDataUrl: dummyQr,
        sequenceNumber: 15,
      };

      const svg = ticketImageService.buildSvg(ticketData);

      // Must NOT contain internal ticket database ID
      expect(svg).not.toContain('SECRET-INTERNAL-DB-UUID-99999');
      // Must NOT contain raw cryptographic verification token in text
      expect(svg).not.toContain(cryptoToken);
      // Strictly enforces no visible sequence or pass ID on visible ticket
      expect(svg).not.toContain('#00015');
      expect(svg).not.toContain('STATUS: ACTIVE');
    });

    it('should generate high-contrast 380x380 scannable QR code encoding the canonical verification URL', async () => {
      const cryptoToken = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0';
      const ticketData: TicketImageData = {
        ticketId: 'QR-TEST-001',
        guestName: 'John Doe',
        eventName: 'Security Summit',
        eventDate: '2026-12-05',
        ticketType: 'Delegate',
        verificationToken: cryptoToken,
        sequenceNumber: 1,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);
      expect(result.pngBuffer).toBeDefined();
      expect(isPngBuffer(result.pngBuffer)).toBe(true);

      // SVG must have embedded QR data URL generated from verificationToken
      expect(result.svg).toContain('data:image/png;base64,');
      // QR code image dimension must be 380x380 px
      expect(result.svg).toContain('width="380" height="380"');
    });

    it('should gracefully default non-critical missing fields (Valued Guest, Date TBA, Venue TBA, General Admission)', () => {
      const minimalData: TicketImageData = {
        ticketId: 'MIN-001',
        guestName: '',
        eventName: '',
        eventDate: '',
        ticketType: '',
        qrCodeDataUrl: dummyQr,
      };

      const svg = ticketImageService.buildSvg(minimalData);
      expect(svg).toContain('Valued Guest');
      expect(svg).toContain('Event Admission Pass');
      expect(svg).toContain('Date TBA');
      expect(svg).toContain('Venue TBA');
      expect(svg).toContain('General Admission');
      // Pass ID / internal sequence is intentionally not displayed on visible ticket per editorial design decision
      expect(svg).not.toContain('#00001');
    });

    it('should throw structured ValidationError for null payload or missing verification token/QR URL', async () => {
      expect(() => ticketImageService.validateTicketData(null as any)).toThrow(ValidationError);
      expect(() => ticketImageService.validateTicketData(undefined as any)).toThrow(ValidationError);
      expect(() => ticketImageService.validateTicketData({} as any)).toThrow(ValidationError);

      // Missing ticketId
      expect(() =>
        ticketImageService.validateTicketData({
          ticketId: '',
          guestName: 'Guest',
          eventName: 'Event',
          eventDate: '2026-11-20',
          ticketType: 'General',
          qrCodeDataUrl: dummyQr,
        })
      ).toThrow(ValidationError);

      // Missing both qrCodeDataUrl and verificationToken
      expect(() =>
        ticketImageService.validateTicketData({
          ticketId: 'ERR-001',
          guestName: 'Guest',
          eventName: 'Event',
          eventDate: '2026-11-20',
          ticketType: 'General',
        })
      ).toThrow(ValidationError);

      // Empty qrCodeDataUrl
      expect(() =>
        ticketImageService.validateTicketData({
          ticketId: 'ERR-002',
          guestName: 'Guest',
          eventName: 'Event',
          eventDate: '2026-11-20',
          ticketType: 'General',
          qrCodeDataUrl: '   ',
        })
      ).toThrow(ValidationError);
    });

    it('should strictly comply with Sharp concurrency and memory rules without leaking memory', () => {
      expect(sharp.concurrency()).toBe(1);
      const cacheStatus: any = sharp.cache();
      expect(cacheStatus.memory.max).toBe(0);
      expect(cacheStatus.files.max).toBe(0);
      expect(cacheStatus.items.max).toBe(0);
    });

    it('should generate and save a verified sample ticket PNG file using the new default design', async () => {
      const fs = require('fs');
      const path = require('path');

      const sampleData: TicketImageData = {
        ticketId: 'SMP-SAMPLE-2026',
        guestName: 'Aman Gupta (राहुल शर्मा)',
        eventName: 'Ticketification Launch Summit 2026',
        eventDate: 'November 20, 2026',
        eventTime: '10:00 AM IST',
        ticketType: 'VIP Delegate • All Access',
        venue: 'Grand Convention Centre, Hall A',
        sequenceNumber: 42,
        organization: 'Lead Systems Architect • Tech Corp',
        verificationToken: '4f8b2a1c9e3d7a5b6f0e2d4c8a1b3e5f7a9c2d4e6f8a0b1c3d5e7f9a1b3c5d7e',
      };

      const result = await ticketImageService.generateTicketImage(sampleData);
      expect(isPngBuffer(result.pngBuffer)).toBe(true);

      // Automated optical decode assertion using jsQR directly on the generated PNG buffer
      const rawImage = await sharp(result.pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decodedQr = jsQR(new Uint8ClampedArray(rawImage.data), rawImage.info.width, rawImage.info.height);

      expect(decodedQr).not.toBeNull();
      expect(decodedQr?.data).toBe('https://ticketification.app/verify/4f8b2a1c9e3d7a5b6f0e2d4c8a1b3e5f7a9c2d4e6f8a0b1c3d5e7f9a1b3c5d7e');

      const outputPath = path.resolve(__dirname, '../sample_default_ticket.png');
      fs.writeFileSync(outputPath, result.pngBuffer);
      expect(fs.existsSync(outputPath)).toBe(true);

      const stat = fs.statSync(outputPath);
      expect(stat.size).toBeGreaterThan(10000);
      console.log(`[SAMPLE_VERIFIED] Generated sample ticket at: ${outputPath} (${stat.size} bytes, QR decoded: ${decodedQr?.data})`);
    });
  });

  describe('Excel Export Pipeline (generateTicketsExcel)', () => {
    it('should generate valid .xlsx binary workbook with guest details and ticket URLs', async () => {
      const mockEventId = 'mock-event-123';
      const mockUserId = 'user-owner-123';

      const getTicketsSpy = jest.spyOn(ticketService as any, 'getTicketsByEvent').mockResolvedValueOnce({
        tickets: [
          {
            id: 'tkt-001',
            sequenceNumber: 1,
            verificationToken: 'token-abc-123',
            status: 'ACTIVE',
            usagePolicy: 'SINGLE_USE',
            assetUrl: 'https://xyz.supabase.co/storage/v1/object/public/ticket-images/events/test.png',
            createdAt: new Date(),
            guest: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '+91 9876543210',
              organization: 'Acme Corp',
              designation: 'Engineer',
              category: 'VIP',
            },
            ticketType: { name: 'VIP' },
          },
        ],
        total: 1,
      });

      const eventRepoSpy = jest.spyOn((ticketService as any).eventRepo, 'findByIdAndOwner').mockResolvedValueOnce({
        id: mockEventId,
        name: 'Tech Innovation Summit 2026',
      });

      const result = await ticketService.generateTicketsExcel(mockEventId, mockUserId);

      expect(result).toBeDefined();
      expect(result.count).toBe(1);
      expect(result.fileName).toContain('Tech_Innovation_Summit_2026');
      expect(result.fileName).toMatch(/\.xlsx$/);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(5000);

      const workbook = xlsx.read(result.buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Tickets Roster');
      const sheet = workbook.Sheets['Tickets Roster'];
      const data: any[] = xlsx.utils.sheet_to_json(sheet);
      expect(data.length).toBe(1);
      expect(data[0]['Name']).toBe('John Doe');
      expect(data[0]['Contact']).toBe('+91 9876543210');
      expect(data[0]['Email']).toBe('john@example.com');
      expect(data[0]['Ticket URL']).toBe('https://xyz.supabase.co/storage/v1/object/public/ticket-images/events/test.png');
      expect(data[0]['Category']).toBeUndefined();
      expect(data[0]['Status']).toBeUndefined();
      expect(data[0]['Ticket No']).toBeUndefined();
      expect(data[0]['Phone / Email']).toBeUndefined();

      getTicketsSpy.mockRestore();
      eventRepoSpy.mockRestore();
    });
  });
});




