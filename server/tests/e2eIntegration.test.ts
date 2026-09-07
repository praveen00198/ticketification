import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db';
import { qrService } from '../src/modules/tickets/services/qr.service';
import { formatTicketFileName, isPngBuffer } from '../src/modules/tickets/services/ticket-image.service';

describe('Phase 10: End-to-End System Integration & Contract Verification', () => {
  describe('API Health & System Routing', () => {
    it('should correctly handle public verification redirection for mobile scans', async () => {
      const res = await request(app).get('/verify/test_token_12345');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/verify/test_token_12345');
    });

    it('should reject unauthenticated access to protected API endpoints', async () => {
      const res = await request(app).get('/api/events');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with ValidationError on malformed login requests', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Core Invariant Verification across Master Plan', () => {
    it('Invariant 1: Verification tokens must be cryptographically opaque 64-char hex strings with zero PII', () => {
      const token = qrService.generateVerificationToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token).not.toContain('@');
      expect(token).not.toContain('+');
    });

    it('Invariant 2: Filename canonical generator must enforce <Name>-<ID>.png and <ID>.png for unassigned', () => {
      expect(formatTicketFileName('Aman Gupta', 'GAN-00001')).toBe('Aman-Gupta-GAN-00001.png');
      expect(formatTicketFileName(null, 'WRK-00005')).toBe('WRK-00005.png');
      expect(formatTicketFileName('', 'WRK-00006')).toBe('WRK-00006.png');
      expect(formatTicketFileName('Priya Sharma', 'VIP-00010')).toBe('Priya-Sharma-VIP-00010.png');
    });

    it('Invariant 3: PNG binary validator must strictly enforce 0x89504E47 header and reject SVG/other binaries', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const invalidSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      const invalidJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      expect(isPngBuffer(validPng)).toBe(true);
      expect(isPngBuffer(invalidSvg)).toBe(false);
      expect(isPngBuffer(invalidJpeg)).toBe(false);
    });
  });
});
