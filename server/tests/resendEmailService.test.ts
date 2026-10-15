const mockEmailsSend = jest.fn();

jest.mock('resend', () => {
  return {
    __esModule: true,
    Resend: class MockResend {
      apiKey: string;
      emails: {
        send: typeof mockEmailsSend;
      };
      constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.emails = {
          send: mockEmailsSend,
        };
      }
    },
  };
});

import { ResendEmailService } from '../src/modules/email/services/resend-email.service';

describe('ResendEmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Standby / Mock Mode (Unconfigured)', () => {
    it('initializes gracefully in standby mode when no API key is provided', () => {
      const service = new ResendEmailService('', '');
      expect(service.isConfigured()).toBe(false);
    });

    it('simulates email delivery in standby mode without throwing errors', async () => {
      const service = new ResendEmailService('', '');
      const result = await service.sendEmail({
        to: 'attendee@example.com',
        subject: 'Welcome to the Summit',
        html: '<p>Hello!</p>',
      });

      expect(result.success).toBe(true);
      expect(result.isMock).toBe(true);
      expect(result.id).toMatch(/^mock-email-/);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });

    it('rejects sending when recipient is missing', async () => {
      const service = new ResendEmailService('', '');
      const result = await service.sendEmail({
        to: '',
        subject: 'No recipient',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recipient address (to) is required');
    });

    it('rejects sending when subject is empty', async () => {
      const service = new ResendEmailService('', '');
      const result = await service.sendEmail({
        to: 'test@example.com',
        subject: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email subject is required');
    });
  });

  describe('Active Configured Mode', () => {
    it('initializes Resend client when API key is provided', () => {
      const service = new ResendEmailService('re_test_123456789', 'Ticketification <test@resend.dev>');
      expect(service.isConfigured()).toBe(true);
    });

    it('allows dynamically setting the API key at runtime', () => {
      const service = new ResendEmailService('', '');
      expect(service.isConfigured()).toBe(false);

      service.setApiKey('re_dynamic_key_999');
      expect(service.isConfigured()).toBe(true);
    });

    it('sends email successfully through Resend SDK', async () => {
      mockEmailsSend.mockResolvedValueOnce({
        data: { id: 'resend_msg_abc123' },
        error: null,
      });

      const service = new ResendEmailService('re_test_valid_key', 'Ticketification <noreply@event.app>');
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Your Access Pass',
        html: '<p>Your pass is confirmed</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('resend_msg_abc123');
      expect(mockEmailsSend).toHaveBeenCalledWith({
        from: 'Ticketification <noreply@event.app>',
        to: ['user@example.com'],
        subject: 'Your Access Pass',
        html: '<p>Your pass is confirmed</p>',
      });
    });

    it('handles Resend API rejection errors gracefully and sanitizes secrets', async () => {
      mockEmailsSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Domain unverified for key re_test_secret_123' },
      });

      const service = new ResendEmailService('re_test_secret_123');
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain unverified');
    });

    it('catches and sanitizes delivery exceptions', async () => {
      mockEmailsSend.mockRejectedValueOnce(new Error('Network error with token re_key_xyz and Bearer abc.def.ghi'));

      const service = new ResendEmailService('re_key_xyz');
      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('re_key_xyz');
      expect(result.error).toContain('[REDACTED_RESEND_KEY]');
      expect(result.error).toContain('Bearer [REDACTED]');
    });
  });

  describe('Domain Helper Methods', () => {
    let service: ResendEmailService;

    beforeEach(() => {
      service = new ResendEmailService('re_domain_test_key');
      mockEmailsSend.mockResolvedValue({
        data: { id: 'msg_helper_success' },
        error: null,
      });
    });

    it('sendTicketPassEmail formats subject, generates HTML, and attaches image buffer', async () => {
      const dummyBuffer = Buffer.from('fake-png-image');
      const result = await service.sendTicketPassEmail({
        to: 'attendee@tech.org',
        attendeeName: 'Aarav Patel',
        eventName: 'AI Summit 2026',
        credentialTerminology: 'VIP Pass',
        formattedId: 'VIP-00042',
        verificationToken: 'a'.repeat(64),
        passImageBuffer: dummyBuffer,
        venueName: 'Grand Hyatt Convention Center',
        eventDate: 'November 20, 2026',
      });

      expect(result.success).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['attendee@tech.org'],
          subject: 'Your VIP Pass for AI Summit 2026 [VIP-00042]',
          html: expect.stringContaining('Your VIP Pass is Ready!'),
          text: expect.stringContaining('VIP-00042'),
          attachments: [
            {
              filename: 'VIP-00042-vip_pass.png',
              content: dummyBuffer,
              contentType: 'image/png',
            },
          ],
        })
      );
    });

    it('sendRegistrationConfirmationEmail delivers confirmation without attachments', async () => {
      const result = await service.sendRegistrationConfirmationEmail({
        to: 'guest@summit.org',
        attendeeName: 'Priya Sharma',
        eventName: 'DevCon Global',
        formattedId: 'DEV-00100',
        eventDate: 'December 5, 2026',
      });

      expect(result.success).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['guest@summit.org'],
          subject: 'Registration Confirmed: DevCon Global',
          html: expect.stringContaining('Registration Confirmed'),
          text: expect.stringContaining('DEV-00100'),
        })
      );
    });

    it('sendStaffInvitationEmail generates invitation email with role and accept URL', async () => {
      const result = await service.sendStaffInvitationEmail({
        to: 'volunteer@summit.org',
        inviteeName: 'Rohan Mehra',
        eventName: 'HackIndia 2026',
        role: 'COORDINATOR',
        invitationUrl: 'https://ticketification.app/invite/token-12345',
        hostName: 'Organizer Team',
        customMessage: 'Looking forward to working with you at the gate turnstiles!',
      });

      expect(result.success).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['volunteer@summit.org'],
          subject: 'Invitation to join HackIndia 2026 as COORDINATOR',
          html: expect.stringContaining('Looking forward to working with you'),
          text: expect.stringContaining('https://ticketification.app/invite/token-12345'),
        })
      );
    });

    it('sendEventAnnouncementEmail broadcasts announcements', async () => {
      const result = await service.sendEventAnnouncementEmail({
        to: 'all@attendees.org',
        attendeeName: 'Everyone',
        eventName: 'HackIndia 2026',
        announcementTitle: 'Keynote Speaker Announcement',
        announcementBody: 'We are thrilled to welcome our keynote speakers at 9:00 AM sharp.',
      });

      expect(result.success).toBe(true);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['all@attendees.org'],
          subject: '[HackIndia 2026] Keynote Speaker Announcement',
          html: expect.stringContaining('Keynote Speaker Announcement'),
        })
      );
    });
  });
});
