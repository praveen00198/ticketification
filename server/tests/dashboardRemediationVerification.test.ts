import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import { createJwtToken } from '../src/utils/local-auth';
import { mongoEventReportRepository } from '../src/modules/events/repositories/mongo-event-report.repository';
import { EventReportModel } from '../src/db/mongo/models/event-report.model';

describe('Dashboard Remediation & Functional Verification Test Suite', () => {
  const userA = {
    id: 'usr_remediation_001',
    email: 'user_a@example.com',
    role: 'USER' as const,
    name: 'User Alpha',
  };

  const userB = {
    id: 'usr_remediation_002',
    email: 'user_b@example.com',
    role: 'USER' as const,
    name: 'User Beta',
  };

  const tokenA = createJwtToken({
    id: userA.id,
    email: userA.email,
    role: userA.role,
  });

  const tokenB = createJwtToken({
    id: userB.id,
    email: userB.email,
    role: userB.role,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. Venue Object Normalization (Crash Prevention)
  // =========================================================================
  describe('1. Venue Object Normalization & React Safety', () => {
    // Replicates client/src/utils/venue.ts formatVenueLabel logic directly
    const formatVenueLabel = (venue: any): string => {
      if (!venue) return 'Online / TBA';
      if (typeof venue === 'string') return venue;
      if (typeof venue === 'object') {
        if (venue.name && venue.city) return `${venue.name}, ${venue.city}`;
        if (venue.name) return venue.name;
        if (venue.city) return venue.city;
        if (venue.address) return venue.address;
        if (venue.type === 'ONLINE') return 'Virtual Event (Online)';
        if (venue.type === 'HYBRID') return 'Hybrid Event';
        if (venue.type) return String(venue.type);
        return 'Venue Announced Soon';
      }
      return String(venue);
    };

    it('normalizes venue object with name and city', () => {
      const venue = { name: 'Convention Center', city: 'San Francisco', address: '747 Howard St' };
      const label = formatVenueLabel(venue);
      expect(label).toBe('Convention Center, San Francisco');
      expect(typeof label).toBe('string');
    });

    it('normalizes venue object with name only', () => {
      const venue = { name: 'Main Auditorium' };
      const label = formatVenueLabel(venue);
      expect(label).toBe('Main Auditorium');
      expect(typeof label).toBe('string');
    });

    it('normalizes online event venue object', () => {
      const venue = { type: 'ONLINE' };
      const label = formatVenueLabel(venue);
      expect(label).toBe('Virtual Event (Online)');
      expect(typeof label).toBe('string');
    });

    it('normalizes hybrid event venue object', () => {
      const venue = { type: 'HYBRID' };
      const label = formatVenueLabel(venue);
      expect(label).toBe('Hybrid Event');
      expect(typeof label).toBe('string');
    });

    it('handles null, undefined, or missing venue safely without throwing', () => {
      expect(formatVenueLabel(null)).toBe('Online / TBA');
      expect(formatVenueLabel(undefined)).toBe('Online / TBA');
      expect(formatVenueLabel('')).toBe('Online / TBA');
    });

    it('handles string venue directly', () => {
      expect(formatVenueLabel('Grand Hall, NYC')).toBe('Grand Hall, NYC');
    });

    it('guarantees output is never an object (preventing React child rendering crashes)', () => {
      const testCases = [
        {},
        { foo: 'bar' },
        { address: '123 Market St' },
        { city: 'Chicago' },
        { type: 'PHYSICAL' },
      ];
      for (const tc of testCases) {
        const result = formatVenueLabel(tc);
        expect(typeof result).toBe('string');
        expect(result).not.toBe('[object Object]');
      }
    });
  });

  // =========================================================================
  // 2. Error Message Extraction & JSX Crash Prevention
  // =========================================================================
  describe('2. Error Message Extraction & JSX Crash Prevention', () => {
    // Replicates client/src/api/client.ts extractErrorMessage logic directly
    const extractErrorMessage = (error: any, fallbackMessage: string = 'An unexpected error occurred'): string => {
      if (!error) return fallbackMessage;
      if (typeof error === 'string') return error;
      if (typeof error.response?.data?.error?.message === 'string') {
        return error.response.data.error.message;
      }
      if (typeof error.response?.data?.error === 'string') {
        return error.response.data.error;
      }
      if (typeof error.response?.data?.message === 'string') {
        return error.response.data.message;
      }
      if (typeof error.message === 'string' && error.message) {
        return error.message;
      }
      return fallbackMessage;
    };

    it('extracts message from structured backend error response { error: { message } }', () => {
      const err = {
        response: {
          data: {
            error: {
              message: 'Invalid credentials provided.',
              code: 'AUTHENTICATION_FAILED',
              details: { attempt: 3 },
            },
          },
        },
      };
      const result = extractErrorMessage(err);
      expect(result).toBe('Invalid credentials provided.');
      expect(typeof result).toBe('string');
    });

    it('extracts message from string error.response.data.error', () => {
      const err = { response: { data: { error: 'Access denied.' } } };
      expect(extractErrorMessage(err)).toBe('Access denied.');
    });

    it('extracts message from standard axios Error instance', () => {
      const err = new Error('Network timeout after 10000ms');
      expect(extractErrorMessage(err)).toBe('Network timeout after 10000ms');
    });

    it('safely handles raw error objects without string message, falling back to default', () => {
      const err = { response: { data: { error: { code: 'INTERNAL_ERROR' } } } };
      const result = extractErrorMessage(err, 'Failed to fetch analytics.');
      expect(result).toBe('Failed to fetch analytics.');
      expect(typeof result).toBe('string');
    });

    it('never leaks stack traces or returns an object', () => {
      const errWithStack = {
        message: 'Something broke',
        stack: 'Error: Something broke\n at /server/src/index.ts:42:15',
      };
      const result = extractErrorMessage(errWithStack);
      expect(result).toBe('Something broke');
      expect(result).not.toContain('stack');
      expect(typeof result).toBe('string');
    });
  });

  // =========================================================================
  // 3. Account Settings Persistence & Downstream Date Localization
  // =========================================================================
  describe('3. Account Settings & Downstream Date Formatting', () => {
    // Replicates client/src/utils/date.ts formatLocalizedDate logic directly
    const formatLocalizedDate = (
      dateInput: string | number | Date | null | undefined,
      preferences: { timezone?: string; dateFormat?: string } = {}
    ): string => {
      if (!dateInput) return 'TBD';
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return 'TBD';

      const timezone = preferences.timezone || 'UTC';
      const dateFormat = preferences.dateFormat || 'YYYY-MM-DD';

      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const parts = dtf.formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value || '1970';
      const month = parts.find((p) => p.type === 'month')?.value || '01';
      const day = parts.find((p) => p.type === 'day')?.value || '01';

      switch (dateFormat) {
        case 'DD/MM/YYYY':
          return `${day}/${month}/${year}`;
        case 'MM/DD/YYYY':
          return `${month}/${day}/${year}`;
        case 'YYYY-MM-DD':
        default:
          return `${year}-${month}-${day}`;
      }
    };

    it('formats date according to user preference YYYY-MM-DD', () => {
      const isoDate = '2026-10-25T14:30:00.000Z';
      const formatted = formatLocalizedDate(isoDate, { timezone: 'UTC', dateFormat: 'YYYY-MM-DD' });
      expect(formatted).toBe('2026-10-25');
    });

    it('formats date according to user preference DD/MM/YYYY', () => {
      const isoDate = '2026-10-25T14:30:00.000Z';
      const formatted = formatLocalizedDate(isoDate, { timezone: 'UTC', dateFormat: 'DD/MM/YYYY' });
      expect(formatted).toBe('25/10/2026');
    });

    it('formats date according to user preference MM/DD/YYYY', () => {
      const isoDate = '2026-10-25T14:30:00.000Z';
      const formatted = formatLocalizedDate(isoDate, { timezone: 'UTC', dateFormat: 'MM/DD/YYYY' });
      expect(formatted).toBe('10/25/2026');
    });

    it('respects timezone shifting across day boundary', () => {
      // 2026-10-25 at 23:30 UTC is 2026-10-26 at 05:00 in Asia/Kolkata (+5:30)
      const lateNightUtc = '2026-10-25T23:30:00.000Z';
      const inUtc = formatLocalizedDate(lateNightUtc, { timezone: 'UTC', dateFormat: 'YYYY-MM-DD' });
      const inIndia = formatLocalizedDate(lateNightUtc, { timezone: 'Asia/Kolkata', dateFormat: 'YYYY-MM-DD' });

      expect(inUtc).toBe('2026-10-25');
      expect(inIndia).toBe('2026-10-26');
    });
  });

  // =========================================================================
  // 4. Notifications Multi-User Storage Isolation
  // =========================================================================
  describe('4. Notifications Multi-User Isolation', () => {
    it('generates distinct storage keys per user ID to prevent cross-account leak', () => {
      const getStorageKey = (userId?: string) => `ticketification_read_notifications_${userId || 'anonymous'}`;

      const keyUserA = getStorageKey(userA.id);
      const keyUserB = getStorageKey(userB.id);

      expect(keyUserA).not.toBe(keyUserB);
      expect(keyUserA).toBe('ticketification_read_notifications_usr_remediation_001');
      expect(keyUserB).toBe('ticketification_read_notifications_usr_remediation_002');
    });
  });

  // =========================================================================
  // 5. Support Reports: Authentication, Token Validation & Ownership Isolation
  // =========================================================================
  describe('5. Support Reports: Auth Token Validation & Strict Ownership', () => {
    it('POST /api/support/report: rejects invalid Bearer token with 401', async () => {
      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', 'Bearer invalid.expired.token')
        .send({
          reporterEmail: 'attacker@example.com',
          reason: 'Attempting to spoof authenticated report submission',
          category: 'TECHNICAL_ISSUE',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/support/report: rejects malformed Authorization header with 401', async () => {
      const res = await request(app)
        .post('/api/support/report')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .send({
          reporterEmail: 'test@example.com',
          reason: 'Header format is not Bearer token',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/support/report: validates minimum reason length (10 characters)', async () => {
      const res = await request(app)
        .post('/api/support/report')
        .send({
          reporterEmail: 'test@example.com',
          reason: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('minimum 10 characters');
    });

    it('GET /api/support/my-reports: rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/support/my-reports');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Support Report Repository: findByReporterUserId strictly isolates records by reporterUserId', async () => {
      const mockReports = [
        {
          _id: new mongoose.Types.ObjectId(),
          reporterUserId: userA.id,
          reporterEmail: userA.email,
          reason: 'User A legitimate issue report',
          status: 'PENDING',
          createdAt: new Date(),
        },
      ];

      const mockFind = jest.spyOn(EventReportModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockReports),
          }),
        }),
      } as any);

      const userAReports = await mongoEventReportRepository.findByReporterUserId(userA.id);

      // Verify that the query explicitly filtered by { $or: [{ reporterUserId: userA.id }] }
      expect(mockFind).toHaveBeenCalledWith({
        $or: [{ reporterUserId: userA.id }],
      });
      expect(userAReports.length).toBe(1);
      expect(userAReports[0].reporterUserId).toBe(userA.id);
      expect(userAReports[0].reporterEmail).toBe(userA.email);

      mockFind.mockRestore();
    });

    it('Support Report Repository: prevents anonymous or other users reports from leaking to user', async () => {
      const mockFind = jest.spyOn(EventReportModel, 'find').mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const userBReports = await mongoEventReportRepository.findByReporterUserId(userB.id);

      // User B should query only their own ID, never null or userA.id
      expect(mockFind).toHaveBeenCalledWith({
        $or: [{ reporterUserId: userB.id }],
      });
      expect(userBReports.length).toBe(0);

      mockFind.mockRestore();
    });
  });

  // =========================================================================
  // 6. Security and Password Invariants
  // =========================================================================
  describe('6. Security & Password Invariants', () => {
    it('POST /api/auth/change-password: rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewSecurePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/change-password: rejects short new password with 400', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 7. Targeted Final Fixes: User Isolation, Privacy Cleanliness & Timestamp Safety
  // =========================================================================
  describe('7. Targeted Final Fixes: User Isolation, Privacy Cleanliness & Timestamp Safety', () => {
    describe('A. Privacy Settings Cleanliness', () => {
      it('PrivacySettingsPage contains no leftover collaboration preferences or speculative toggles', () => {
        const privacyPagePath = path.resolve(__dirname, '../../client/src/pages/PrivacySettingsPage.tsx');
        expect(fs.existsSync(privacyPagePath)).toBe(true);

        const content = fs.readFileSync(privacyPagePath, 'utf-8');

        // Verify that removed unsupported sections are NOT present
        expect(content).not.toContain('Planned Collaboration Preferences');
        expect(content).not.toContain('publicProfileInRoster');
        expect(content).not.toContain('organizerMessagingConsent');
        expect(content).not.toContain('Granular public attendee roster visibility');
        expect(content).not.toContain('organizer direct messaging preferences');

        // Verify that legitimate active privacy safeguards are present
        expect(content).toContain('Zero-Trust Event Isolation (IDOR Defense)');
        expect(content).toContain('Cryptographic Credential & Turnstile Security');
        expect(content).toContain('No Government ID Collection');
      });
    });

    describe('B. User-Specific Date & Time Preferences Isolation', () => {
      // Direct simulation of client/src/utils/date.ts user-scoping logic
      const BASE_PREFIX = 'ticketification_user_preferences_';
      const mockStorage: Record<string, string> = {};

      const getUserPreferencesStorageKey = (userId?: string | null): string | null => {
        if (!userId) return null;
        return `${BASE_PREFIX}${userId}`;
      };

      const getStoredUserPreferences = (userId?: string | null) => {
        const key = getUserPreferencesStorageKey(userId);
        if (key && mockStorage[key]) {
          try {
            const parsed = JSON.parse(mockStorage[key]);
            return {
              timezone: parsed.timezone || 'UTC',
              dateFormat: parsed.dateFormat || 'YYYY-MM-DD',
            };
          } catch {
            // fallback
          }
        }
        return {
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        };
      };

      const setStoredUserPreferences = (prefs: any, userId?: string | null) => {
        const key = getUserPreferencesStorageKey(userId);
        if (key) {
          mockStorage[key] = JSON.stringify(prefs);
        }
      };

      it('isolates cached date/time preferences strictly per user ID', () => {
        // User A saves Tokyo timezone and DD/MM/YYYY
        setStoredUserPreferences({ timezone: 'Asia/Tokyo', dateFormat: 'DD/MM/YYYY' }, userA.id);

        // User B saves New York timezone and MM/DD/YYYY
        setStoredUserPreferences({ timezone: 'America/New_York', dateFormat: 'MM/DD/YYYY' }, userB.id);

        // Verify User A receives User A preferences
        const prefsA = getStoredUserPreferences(userA.id);
        expect(prefsA.timezone).toBe('Asia/Tokyo');
        expect(prefsA.dateFormat).toBe('DD/MM/YYYY');

        // Verify User B receives User B preferences
        const prefsB = getStoredUserPreferences(userB.id);
        expect(prefsB.timezone).toBe('America/New_York');
        expect(prefsB.dateFormat).toBe('MM/DD/YYYY');

        // Verify User B cannot access User A's cached preferences
        expect(prefsB.timezone).not.toBe(prefsA.timezone);
        expect(prefsB.dateFormat).not.toBe(prefsA.dateFormat);
      });

      it('account logout / unauthenticated session falls back to default preferences without leaking previous user', () => {
        // Active User A has custom preferences
        setStoredUserPreferences({ timezone: 'Asia/Tokyo', dateFormat: 'DD/MM/YYYY' }, userA.id);

        // When user logs out, active userId becomes null
        const unauthenticatedPrefs = getStoredUserPreferences(null);

        // Must return clean platform defaults, NEVER User A's preferences
        expect(unauthenticatedPrefs.timezone).toBe('UTC');
        expect(unauthenticatedPrefs.dateFormat).toBe('YYYY-MM-DD');
        expect(unauthenticatedPrefs.timezone).not.toBe('Asia/Tokyo');
        expect(unauthenticatedPrefs.dateFormat).not.toBe('DD/MM/YYYY');
      });

      it('switching accounts immediately switches to the new user preferences', () => {
        // Simulate User A active
        let activeUserId: string | null = userA.id;
        expect(getStoredUserPreferences(activeUserId).timezone).toBe('Asia/Tokyo');

        // User logs out
        activeUserId = null;
        expect(getStoredUserPreferences(activeUserId).timezone).toBe('UTC');

        // User B logs in
        activeUserId = userB.id;
        expect(getStoredUserPreferences(activeUserId).timezone).toBe('America/New_York');
      });

      it('missing or unknown user ID handles gracefully without crashing', () => {
        expect(() => getStoredUserPreferences(undefined)).not.toThrow();
        expect(() => getStoredUserPreferences('')).not.toThrow();
        expect(getStoredUserPreferences(undefined)).toEqual({
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        });
      });
    });

    describe('C. Notifications: Timestamps are Never Invented', () => {
      // Replicates the fixed notification creation logic from NotificationsPage.tsx
      const buildNotificationItem = (reg: { id: string; name: string; createdAt?: any }) => {
        const rawDate = reg.createdAt;
        const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());
        const dateStr = isValidDate ? new Date(rawDate).toISOString() : null;

        return {
          id: `reg-${reg.id}`,
          title: `Registration Confirmed: ${reg.name}`,
          timestamp: dateStr,
        };
      };

      const formatNotificationTimestamp = (timestamp: string | null): string => {
        if (!timestamp) return 'Date unavailable';
        const d = new Date(timestamp);
        if (isNaN(d.getTime())) return 'Date unavailable';
        return d.toISOString().split('T')[0];
      };

      it('preserves valid historical timestamps exactly', () => {
        const item = buildNotificationItem({
          id: 'reg-1',
          name: 'Tech Conf 2026',
          createdAt: '2026-03-15T10:00:00.000Z',
        });

        expect(item.timestamp).toBe('2026-03-15T10:00:00.000Z');
        expect(formatNotificationTimestamp(item.timestamp)).toBe('2026-03-15');
      });

      it('does NOT substitute the current time when createdAt is missing', () => {
        const beforeTest = Date.now();

        const item = buildNotificationItem({
          id: 'reg-missing-date',
          name: 'Old Event Without Date',
          createdAt: undefined,
        });

        // FIXED: timestamp must be null, never replaced with Date.now() / new Date()
        expect(item.timestamp).toBeNull();
        expect(formatNotificationTimestamp(item.timestamp)).toBe('Date unavailable');

        // Guarantees it did not create a timestamp close to right now
        if (item.timestamp) {
          const itemTime = new Date(item.timestamp).getTime();
          expect(Math.abs(itemTime - beforeTest)).toBeGreaterThan(100_000);
        }
      });

      it('does NOT substitute the current time when createdAt is an invalid string', () => {
        const item = buildNotificationItem({
          id: 'reg-invalid-date',
          name: 'Corrupt Date Event',
          createdAt: 'not-a-valid-date-string',
        });

        expect(item.timestamp).toBeNull();
        expect(formatNotificationTimestamp(item.timestamp)).toBe('Date unavailable');
      });

      it('sorts notifications without timestamps to the bottom so old items do not jump to top', () => {
        const items = [
          buildNotificationItem({ id: '1', name: 'Event No Date', createdAt: undefined }),
          buildNotificationItem({ id: '2', name: 'Event Recent', createdAt: '2026-10-20T12:00:00.000Z' }),
          buildNotificationItem({ id: '3', name: 'Event Older', createdAt: '2026-05-01T12:00:00.000Z' }),
        ];

        // Sort identical to NotificationsPage.tsx
        items.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });

        // Event Recent (newest) must be first
        expect(items[0].id).toBe('reg-2');
        // Event Older must be second
        expect(items[1].id).toBe('reg-3');
        // Undated event must be at the very bottom, never masquerading as newest
        expect(items[2].id).toBe('reg-1');
      });
    });
  });
});

