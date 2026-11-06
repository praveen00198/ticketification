import {
  ticketImageService,
  isPngBuffer,
  formatTicketFileName,
  TicketImageData,
  escapeXml,
  splitTextIntoLines,
} from '../src/modules/tickets/services/ticket-image.service';
import { qrService } from '../src/modules/tickets/services/qr.service';
import { ValidationError, AppError } from '../src/middlewares/error.middleware';
import sharp from 'sharp';
import jsQR from 'jsqr';

describe('Empirical Challenger: Default Global Ticket Credential Verification (M1)', () => {
  jest.setTimeout(60000);

  const sampleCryptoToken = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const expectedQrUrl = `https://ticketification.app/verify/${sampleCryptoToken}`;

  // =========================================================================
  // 1. BINARY INTEGRITY, DIMENSIONS & BUFFER SIZE
  // =========================================================================
  describe('1. Binary Integrity, Dimensions & Buffer Size Verification', () => {
    it('1.1 Generates genuine PNG binary matching standard 8-byte magic header 0x89504E470D0A1A0A', async () => {
      const ticketData: TicketImageData = {
        ticketId: 'CHL-001',
        guestName: 'Empirical Challenger',
        eventName: 'Platform Verification Summit 2026',
        eventDate: 'December 1, 2026',
        eventTime: '10:00 AM IST',
        ticketType: 'Auditor VIP',
        venue: 'Main Audit Auditorium',
        verificationToken: sampleCryptoToken,
        sequenceNumber: 42,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);

      expect(result).toBeDefined();
      expect(result.pngBuffer).toBeInstanceOf(Buffer);

      // Verify exact 8-byte PNG signature
      const buf = result.pngBuffer;
      expect(buf.length).toBeGreaterThan(8);
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50); // P
      expect(buf[2]).toBe(0x4e); // N
      expect(buf[3]).toBe(0x47); // G
      expect(buf[4]).toBe(0x0d); // \r
      expect(buf[5]).toBe(0x0a); // \n
      expect(buf[6]).toBe(0x1a); // EOF
      expect(buf[7]).toBe(0x0a); // \n

      expect(isPngBuffer(buf)).toBe(true);
    });

    it('1.2 Generates exact dimensions 1620 x 2025 pixels with 4 RGBA channels', async () => {
      const ticketData: TicketImageData = {
        ticketId: 'CHL-002',
        guestName: 'Dimensions Verification',
        eventName: 'Resolution Compliance Expo',
        eventDate: 'December 2, 2026',
        ticketType: 'Standard Delegate',
        verificationToken: sampleCryptoToken,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);
      const metadata = await sharp(result.pngBuffer).metadata();

      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(1620);
      expect(metadata.height).toBe(2025);
      expect(metadata.channels).toBe(4);
    });

    it('1.3 PNG buffer size falls within reasonable production range (80KB - 250KB)', async () => {
      const ticketData: TicketImageData = {
        ticketId: 'CHL-003',
        guestName: 'Compression Verification',
        eventName: 'Bandwidth & Storage Optimization Summit',
        eventDate: 'December 3, 2026',
        ticketType: 'General Admission',
        venue: 'Cloud Center 1',
        verificationToken: sampleCryptoToken,
        sequenceNumber: 100,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);
      const sizeBytes = result.pngBuffer.length;
      const sizeKB = sizeBytes / 1024;

      console.log(`[CHALLENGER:SIZE] Generated PNG size: ${sizeBytes} bytes (${sizeKB.toFixed(1)} KB)`);

      // Must not be an empty or corrupted stub
      expect(sizeBytes).toBeGreaterThan(50 * 1024); // > 50KB
      // Must not exceed 300KB uncompressed bloat
      expect(sizeBytes).toBeLessThan(300 * 1024); // < 300KB
      // Expected typical range is ~90KB - 160KB
      expect(sizeKB).toBeGreaterThanOrEqual(80);
      expect(sizeKB).toBeLessThanOrEqual(250);
    });
  });

  // =========================================================================
  // 2. END-TO-END QR CODE OPTICAL SCANNABILITY & ZERO PII VERIFICATION
  // =========================================================================
  describe('2. Optical QR Scannability & Zero PII Decoding Verification', () => {
    it('2.1 Directly decodes QR code from the rasterized 1620x2025 PNG image using jsQR', async () => {
      const dynamicToken = qrService.generateVerificationToken();
      const targetUrl = `https://ticketification.app/verify/${dynamicToken}`;

      const ticketData: TicketImageData = {
        ticketId: 'CHL-QR-001',
        guestName: 'John Doe',
        eventName: 'QR Optical Scannability Verification',
        eventDate: 'December 4, 2026',
        ticketType: 'VIP Attendee',
        venue: 'Testing Facility Alpha',
        verificationToken: dynamicToken,
        sequenceNumber: 777,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);

      // Extract raw RGBA from the generated PNG
      const rawImage = await sharp(result.pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Run jsQR on the raw full image
      const clampedArray = new Uint8ClampedArray(rawImage.data);
      const decoded = jsQR(clampedArray, rawImage.info.width, rawImage.info.height);

      expect(decoded).not.toBeNull();
      expect(decoded?.data).toBeDefined();
      expect(decoded!.data).toBe(targetUrl);
    });

    it('2.2 Directly decodes QR code from the cropped QR viewport area', async () => {
      const dynamicToken = qrService.generateVerificationToken();
      const targetUrl = `https://ticketification.app/verify/${dynamicToken}`;

      const ticketData: TicketImageData = {
        ticketId: 'CHL-QR-002',
        guestName: 'Sarah Connor',
        eventName: 'Sub-Region Scan Accuracy Expo',
        eventDate: 'December 5, 2026',
        ticketType: 'Keynote Speaker',
        verificationToken: dynamicToken,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);

      // In the SVG layout:
      // Outer QR card: translate(530, 840), width=560, height=560
      // Inner QR image: x=90, y=90, width=380, height=380
      // Bounding box: left: 620, top: 930, width: 380, height: 380
      const croppedQr = await sharp(result.pngBuffer)
        .extract({ left: 530, top: 840, width: 560, height: 560 })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const clampedCropped = new Uint8ClampedArray(croppedQr.data);
      const decodedCropped = jsQR(clampedCropped, croppedQr.info.width, croppedQr.info.height);

      expect(decodedCropped).not.toBeNull();
      expect(decodedCropped?.data).toBe(targetUrl);
    });

    it('2.3 Strictly confirms ZERO raw PII is embedded into the QR payload', async () => {
      const sensitiveName = 'Deepak Kumar Sharma';
      const sensitiveEmail = 'deepak.sharma@confidential-corp.in';
      const sensitivePhone = '+919876543210';
      const internalDbUuid = '8f4c2850-7164-4680-a65c-6b3bca4628f4';
      const dynamicToken = qrService.generateVerificationToken();

      const ticketData: TicketImageData = {
        ticketId: internalDbUuid,
        guestName: sensitiveName,
        eventName: 'Zero PII Conformance Test',
        eventDate: 'December 6, 2026',
        ticketType: 'Executive Guest',
        verificationToken: dynamicToken,
        phone: sensitivePhone,
        organization: sensitiveEmail,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);

      // Decode the QR payload
      const rawImage = await sharp(result.pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(rawImage.data), rawImage.info.width, rawImage.info.height);

      expect(decoded).not.toBeNull();
      const payload = decoded!.data;

      // QR Payload MUST be strictly the verification URL
      expect(payload).toBe(`https://ticketification.app/verify/${dynamicToken}`);

      // Must NOT contain sensitive attendee name
      expect(payload).not.toContain(sensitiveName);
      expect(payload).not.toContain('Deepak');
      expect(payload).not.toContain('Sharma');

      // Must NOT contain sensitive email or @
      expect(payload).not.toContain(sensitiveEmail);
      expect(payload).not.toContain('@confidential-corp.in');

      // Must NOT contain phone number
      expect(payload).not.toContain(sensitivePhone);
      expect(payload).not.toContain('9876543210');

      // Must NOT contain internal database UUID
      expect(payload).not.toContain(internalDbUuid);
    });
  });

  // =========================================================================
  // 3. STRICT FR-TCK-3 ENFORCEMENT (DATABASE UUID & CRYPTO HASH HIDING)
  // =========================================================================
  describe('3. Strict Invariant FR-TCK-3 Verification (Internal ID & Crypto Hash Obfuscation)', () => {
    it('3.1 Internal database UUID and raw crypto hash NEVER appear in visible SVG text elements', async () => {
      const internalDbUuid = '550e8400-e29b-41d4-a716-446655440000';
      const cryptoToken = 'f0e4c2f76c58916ec258f246851bea091d14d4247a2fc3e18694461b1816e13b';

      const ticketData: TicketImageData = {
        ticketId: internalDbUuid,
        guestName: 'Jane Smith',
        eventName: 'Cybersecurity Architecture Conference',
        eventDate: 'December 7, 2026',
        eventTime: '02:00 PM EST',
        ticketType: 'VIP All-Access Pass',
        venue: 'Grand Hall B, Metropolitan Center',
        verificationToken: cryptoToken,
        sequenceNumber: 42,
      };

      const result = await ticketImageService.generateTicketImage(ticketData);
      const svg = result.svg;

      // 1. Internal DB UUID must NOT appear in the SVG markup
      expect(svg).not.toContain(internalDbUuid);

      // 2. Raw 64-char crypto hash must NOT appear inside visible <text> elements
      // (It only appears as part of the data:image/png QR code base64 stream)
      const textMatches = svg.match(/<text[^>]*>([\s\S]*?)<\/text>/gi) || [];
      const allTextContent = textMatches.join(' ');

      expect(allTextContent).not.toContain(cryptoToken);
      expect(allTextContent).not.toContain(internalDbUuid);

      // 3. Human sequence identifier DOES appear in visible text
      expect(allTextContent).toContain('#00042');
    });

    it('3.2 Custom alphanumeric sequence formats are preserved without leaking database UUID', () => {
      const customSequences = ['#TK-00042', 'CONF-999', '#ALPHA-7', '42'];

      for (const seq of customSequences) {
        const ticketData: TicketImageData = {
          ticketId: 'internal-uuid-should-not-leak',
          guestName: 'Sequence Tester',
          eventName: 'Sequence Test Expo',
          eventDate: 'December 8, 2026',
          ticketType: 'Attendee',
          verificationToken: sampleCryptoToken,
          sequenceNumber: seq,
        };

        const svg = ticketImageService.buildSvg(ticketData);
        expect(svg).not.toContain('internal-uuid-should-not-leak');

        if (seq === '42') {
          // Numeric 42 gets padded to #00042
          expect(svg).toContain('#00042');
        } else {
          expect(svg).toContain(seq);
        }
      }
    });
  });

  // =========================================================================
  // 4. MULTILINGUAL & NON-ASCII TYPOGRAPHY RENDERING
  // =========================================================================
  describe('4. Multilingual & Complex Script Typography Rendering', () => {
    it('4.1 Successfully renders Hindi Devanagari names without rasterization failure', async () => {
      const hindiNames = [
        'राहुल शर्मा',
        'डॉ. सुब्रह्मण्यम जयशंकर',
        'अमित पटेल (Amit Patel)',
        '|| श्री गणेशाय नमः ||',
      ];

      for (const name of hindiNames) {
        const ticketData: TicketImageData = {
          ticketId: `HIN-${Date.now()}`,
          guestName: name,
          eventName: 'राष्ट्रीय प्रौद्योगिकी सम्मेलन २०२६',
          eventDate: '२० नवम्बर २०२६',
          ticketType: 'विशिष्ट अतिथि',
          venue: 'विज्ञान भवन, नई दिल्ली',
          verificationToken: sampleCryptoToken,
          sequenceNumber: 1,
        };

        const result = await ticketImageService.generateTicketImage(ticketData);

        expect(isPngBuffer(result.pngBuffer)).toBe(true);
        const meta = await sharp(result.pngBuffer).metadata();
        expect(meta.width).toBe(1620);
        expect(meta.height).toBe(2025);
        expect(result.svg).toContain(escapeXml(name));
      }
    });

    it('4.2 Successfully renders international characters (CJK, Arabic, European accents)', async () => {
      const internationalCases = [
        { name: '佐藤 健 (Sato Takeru)', event: 'Tokyo Tech Summit 2026' },
        { name: '张伟 (Zhang Wei)', event: 'Shanghai Innovation Forum' },
        { name: 'أحمد المنصوري (Ahmed Al-Mansouri)', event: 'Dubai Future Conference' },
        { name: 'René François Müller', event: 'Geneva Scientific Congress' },
      ];

      for (const tc of internationalCases) {
        const ticketData: TicketImageData = {
          ticketId: `INTL-${Date.now()}`,
          guestName: tc.name,
          eventName: tc.event,
          eventDate: '2026-11-20',
          ticketType: 'Delegate',
          verificationToken: sampleCryptoToken,
          sequenceNumber: 88,
        };

        const result = await ticketImageService.generateTicketImage(ticketData);
        expect(isPngBuffer(result.pngBuffer)).toBe(true);
        expect(result.pngBuffer.length).toBeGreaterThan(50 * 1024);
      }
    });
  });

  // =========================================================================
  // 5. ADVERSARIAL STRESS TESTING: INJECTION, BOUNDS & GRACEFUL DEGRADATION
  // =========================================================================
  describe('5. Adversarial Input Stress Testing & XML Injection Defense', () => {
    it('5.1 Sanitizes XML injection payloads in all string fields without breaking SVG rasterization', async () => {
      const maliciousData: TicketImageData = {
        ticketId: 'INJ-001',
        guestName: '<script>alert("XSS")</script> & "quotes" \'apostrophe\' <tag>',
        eventName: 'Event with <bold> & "special" characters </bold>',
        eventDate: '2026-12-10 & <time>',
        eventTime: '<09:00> & "AM"',
        ticketType: 'VIP & <Exclusive> "Pass"',
        venue: 'Room <101> & "102" \'Main\'',
        organization: 'Organization <Dept & Co>',
        verificationToken: sampleCryptoToken,
      };

      const result = await ticketImageService.generateTicketImage(maliciousData);

      // Must succeed and produce a valid PNG
      expect(isPngBuffer(result.pngBuffer)).toBe(true);

      // SVG must NOT contain raw unescaped unclosed tags
      expect(result.svg).not.toContain('<script>');
      expect(result.svg).not.toContain('alert("XSS")</script>');
      expect(result.svg).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('5.2 Gracefully truncates extreme text lengths without throwing or overflowing layout', async () => {
      const extremeEventName = 'A'.repeat(500) + ' Extreme Title with Spaces ' + 'B'.repeat(500);
      const extremeGuestName = 'VeryLongNameWithoutSpaces'.repeat(20);
      const extremeVenue = 'Very long venue description '.repeat(15);

      const extremeData: TicketImageData = {
        ticketId: 'EXT-001',
        guestName: extremeGuestName,
        eventName: extremeEventName,
        eventDate: '2026-12-11',
        ticketType: 'Attendee',
        venue: extremeVenue,
        verificationToken: sampleCryptoToken,
      };

      const result = await ticketImageService.generateTicketImage(extremeData);

      expect(isPngBuffer(result.pngBuffer)).toBe(true);
      const meta = await sharp(result.pngBuffer).metadata();
      expect(meta.width).toBe(1620);
      expect(meta.height).toBe(2025);
    });

    it('5.3 Gracefully defaults missing non-critical metadata fields', () => {
      const minimalData: TicketImageData = {
        ticketId: 'MIN-002',
        guestName: '  ',
        eventName: '',
        eventDate: '   ',
        ticketType: '',
        verificationToken: sampleCryptoToken,
      };

      const svg = ticketImageService.buildSvg(minimalData);

      expect(svg).toContain('Valued Guest');
      expect(svg).toContain('Event Admission Pass');
      expect(svg).toContain('Date TBA');
      expect(svg).toContain('Venue TBA');
      expect(svg).toContain('General Admission');
      expect(svg).toContain('#00001');
    });

    it('5.4 Rejects invalid or null ticket data payloads with structured ValidationError', () => {
      expect(() => ticketImageService.validateTicketData(null as any)).toThrow(ValidationError);
      expect(() => ticketImageService.validateTicketData(undefined as any)).toThrow(ValidationError);
      expect(() => ticketImageService.validateTicketData({} as any)).toThrow(ValidationError);

      // Missing ticketId
      expect(() =>
        ticketImageService.validateTicketData({
          ticketId: '',
          guestName: 'Test',
          eventName: 'Test',
          eventDate: '2026-11-20',
          ticketType: 'General',
          verificationToken: sampleCryptoToken,
        })
      ).toThrow(ValidationError);

      // Verification token too short (< 16 characters)
      expect(() =>
        ticketImageService.validateTicketData({
          ticketId: 'VALID-ID',
          guestName: 'Test',
          eventName: 'Test',
          eventDate: '2026-11-20',
          ticketType: 'General',
          verificationToken: 'short-token',
        })
      ).toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 6. CONCURRENCY, RESOURCE CONSUMPTION & MULTI-TENANT ISOLATION
  // =========================================================================
  describe('6. Concurrency & Resource Isolation Verification', () => {
    it('6.1 Sharp concurrency and cache invariants are strictly configured', () => {
      expect(sharp.concurrency()).toBe(1);
      const cache: any = sharp.cache();
      expect(cache.memory.max).toBe(0);
      expect(cache.files.max).toBe(0);
      expect(cache.items.max).toBe(0);
    });

    it('6.2 Handles concurrent ticket image generation without race conditions or cross-talk', async () => {
      const concurrentCount = 3;
      const tasks = Array.from({ length: concurrentCount }).map(async (_, idx) => {
        const token = qrService.generateVerificationToken();
        const ticketId = `CONC-TICK-${idx + 1}`;
        const guestName = `Concurrent Guest ${idx + 1}`;

        const result = await ticketImageService.generateTicketImage({
          ticketId,
          guestName,
          eventName: `Concurrency Test Event ${idx + 1}`,
          eventDate: '2026-12-15',
          ticketType: idx % 2 === 0 ? 'VIP' : 'Standard',
          verificationToken: token,
          sequenceNumber: idx + 1,
        });

        // Verify independent PNG buffer
        expect(isPngBuffer(result.pngBuffer)).toBe(true);

        // Verify QR optical decode matches specific token
        const raw = await sharp(result.pngBuffer)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const decoded = jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height);

        expect(decoded).not.toBeNull();
        expect(decoded!.data).toBe(`https://ticketification.app/verify/${token}`);

        return { idx, size: result.pngBuffer.length, decodedData: decoded!.data };
      });

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(concurrentCount);

      // Ensure all decoded tokens are completely distinct
      const uniqueTokens = new Set(results.map((r) => r.decodedData));
      expect(uniqueTokens.size).toBe(concurrentCount);
    }, 90000);
  });
});
