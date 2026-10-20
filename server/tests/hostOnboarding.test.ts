const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
  supabasePublic: null,
}));

import request from 'supertest';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { createJwtToken } from '../src/utils/local-auth';

describe('Phase 3: Host Identity, Organizer Onboarding & Workspace Initialization', () => {
  const hostUser = {
    id: 'host-user-uuid-001',
    email: 'host.organizer@example.com',
    role: 'USER' as const,
  };

  const otherUser = {
    id: 'other-user-uuid-002',
    email: 'other.attendee@example.com',
    role: 'USER' as const,
  };

  const hostUserToken = createJwtToken({ id: hostUser.id, email: hostUser.email, role: hostUser.role });
  const otherUserToken = createJwtToken({ id: otherUser.id, email: otherUser.email, role: otherUser.role });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase Auth verification
    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostUserToken) {
        return {
          data: {
            user: {
              id: hostUser.id,
              email: hostUser.email,
              user_metadata: { name: 'Host Organizer' },
            } as any,
          },
          error: null,
        };
      }
      if (token === otherUserToken) {
        return {
          data: {
            user: {
              id: otherUser.id,
              email: otherUser.email,
              user_metadata: { name: 'Other User' },
            } as any,
          },
          error: null,
        };
      }
      return {
        data: { user: null },
        error: { message: 'Invalid JWT or expired token' } as any,
      };
    });

    // Mock PostgreSQL user repository
    jest.spyOn(userRepository, 'findById').mockImplementation((async (id: string): Promise<any> => {
      if (id === hostUser.id) {
        return {
          id: hostUser.id,
          name: 'Host Organizer',
          email: hostUser.email,
          role: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      if (id === otherUser.id) {
        return {
          id: otherUser.id,
          name: 'Other User',
          email: otherUser.email,
          role: 'USER',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    }) as any);

    // Mock Mongo user repository defaults
    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation((async (id: string): Promise<any> => {
      if (id === hostUser.id) {
        return {
          supabaseUserId: hostUser.id,
          email: hostUser.email,
          name: 'Host Organizer',
          platformRole: 'USER',
          status: 'ACTIVE',
          hostProfile: null,
          workspaceStatus: 'ACTIVE',
          hostVerificationStatus: 'UNVERIFIED',
        };
      }
      if (id === otherUser.id) {
        return {
          supabaseUserId: otherUser.id,
          email: otherUser.email,
          name: 'Other User',
          platformRole: 'USER',
          status: 'ACTIVE',
          hostProfile: null,
          workspaceStatus: 'ACTIVE',
          hostVerificationStatus: 'UNVERIFIED',
        };
      }
      return null;
    }) as any);

    jest.spyOn(mongoUserRepository, 'upsert').mockImplementation((async (data: any): Promise<any> => ({
      ...data,
      platformRole: 'USER',
      status: 'ACTIVE',
      workspaceStatus: 'ACTIVE',
      hostVerificationStatus: 'UNVERIFIED',
    })) as any);
  });

  describe('1. GET /api/host/profile — Authentication & Profile Retrieval', () => {
    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/host/profile');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when an invalid token is provided', async () => {
      const res = await request(app)
        .get('/api/host/profile')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return incomplete onboarding state (isOnboarded: false) for a user without a hostProfile', async () => {
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: null,
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .get('/api/host/profile')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnboarded).toBe(false);
      expect(res.body.data.hostProfile).toBeNull();
      expect(res.body.data.workspaceStatus).toBe('ACTIVE');
      expect(res.body.data.verificationStatus).toBe('UNVERIFIED');
    });

    it('should return full organizer profile (isOnboarded: true) for an onboarded user', async () => {
      const mockHostProfile = {
        organizationName: 'Pulse Hackathons',
        institutionType: 'COLLEGE_UNIVERSITY',
        institutionName: 'IIT Bombay',
        website: 'https://pulse.org',
        phone: '+91 9876543210',
        bio: 'Premier national collegiate hackathon circuit.',
        logoUrl: 'https://storage.ticketification.internal/hosts/host-1/logo.png',
        onboardedAt: new Date('2026-10-09T00:00:00.000Z'),
      };

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: mockHostProfile,
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .get('/api/host/profile')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnboarded).toBe(true);
      expect(res.body.data.hostProfile.organizationName).toBe('Pulse Hackathons');
      expect(res.body.data.hostProfile.institutionType).toBe('COLLEGE_UNIVERSITY');
      expect(res.body.data.hostProfile.institutionName).toBe('IIT Bombay');
      expect(res.body.data.workspaceStatus).toBe('ACTIVE');
      expect(res.body.data.verificationStatus).toBe('UNVERIFIED');
    });
  });

  describe('2. POST /api/host/onboarding — Input Validation', () => {
    it('should reject submission when organizationName is missing or whitespace-only', async () => {
      const res1 = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({ institutionType: 'COLLEGE_UNIVERSITY' });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({ organizationName: '   ', institutionType: 'COLLEGE_UNIVERSITY' });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
    });

    it('should reject submission when institutionType is invalid', async () => {
      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'Global Hack',
          institutionType: 'INVALID_CATEGORY',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Invalid institution type');
    });

    it('should reject submission when website URL format is invalid', async () => {
      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'Global Hack',
          institutionType: 'INDEPENDENT',
          website: 'ftp://not-supported-scheme.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Website must use http:// or https://');
    });

    it('should reject submission when phone format is invalid', async () => {
      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'Global Hack',
          institutionType: 'INDEPENDENT',
          phone: 'abc-not-a-phone',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Invalid phone number format');
    });

    it('should reject submission when bio exceeds 500 characters', async () => {
      const longBio = 'A'.repeat(501);
      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'Global Hack',
          institutionType: 'INDEPENDENT',
          bio: longBio,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Bio cannot exceed 500 characters');
    });
  });

  describe('3. POST /api/host/onboarding — Successful Execution & Idempotency', () => {
    it('should successfully complete onboarding and persist hostProfile with least-privileged role USER', async () => {
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: null,
      } as any);

      jest.spyOn(mongoUserRepository, 'completeOnboarding').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        status: 'ACTIVE',
        hostProfile: {
          organizationName: 'HackIndia Summit',
          institutionType: 'COLLEGE_UNIVERSITY',
          institutionName: 'IIT Delhi',
          website: 'https://hackindia.com',
          phone: '+91 9988776655',
          bio: 'National collegiate innovation summit.',
          logoUrl: null,
          onboardedAt: new Date(),
        },
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: '  HackIndia Summit  ',
          institutionType: 'COLLEGE_UNIVERSITY',
          institutionName: '  IIT Delhi  ',
          website: 'hackindia.com',
          phone: '+91 9988776655',
          bio: 'National collegiate innovation summit.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isOnboarded).toBe(true);
      expect(res.body.data.hostProfile.organizationName).toBe('HackIndia Summit');
      expect(res.body.data.workspaceStatus).toBe('ACTIVE');
      expect(res.body.data.verificationStatus).toBe('UNVERIFIED');
    });

    it('should handle repeated submissions idempotently without creating duplicate profiles', async () => {
      const existingProfile = {
        organizationName: 'HackIndia Summit',
        institutionType: 'COLLEGE_UNIVERSITY',
        institutionName: 'IIT Delhi',
        onboardedAt: new Date('2026-10-09T00:00:00.000Z'),
      };

      // User is already onboarded
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        name: 'Host Organizer',
        platformRole: 'USER',
        hostProfile: existingProfile,
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const updateSpy = jest.spyOn(mongoUserRepository, 'updateHostProfile').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        platformRole: 'USER',
        hostProfile: {
          ...existingProfile,
          organizationName: 'HackIndia Summit Updated',
        },
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'HackIndia Summit Updated',
          institutionType: 'COLLEGE_UNIVERSITY',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('4. PUT /api/host/profile — Profile Updates', () => {
    it('should reject profile update if user has not completed onboarding', async () => {
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        hostProfile: null,
      } as any);

      const res = await request(app)
        .put('/api/host/profile')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({ organizationName: 'New Org Name' });

      expect(res.status).toBe(400);
      expect(res.body.error.message || res.body.error).toContain('Organizer profile has not been initialized');
    });

    it('should update permitted fields while preserving omitted optional fields and verification status', async () => {
      const existingProfile = {
        organizationName: 'Original Org',
        institutionType: 'CORPORATE',
        institutionName: 'Original Corp',
        website: 'https://original.com',
        phone: '+1 555-0100',
        bio: 'Original Bio',
        logoUrl: 'https://original.com/logo.png',
        onboardedAt: new Date('2026-10-09T00:00:00.000Z'),
      };

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        platformRole: 'USER',
        hostProfile: existingProfile,
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const updateSpy = jest.spyOn(mongoUserRepository, 'updateHostProfile').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        platformRole: 'USER',
        hostProfile: {
          ...existingProfile,
          organizationName: 'Updated Brand Name',
          bio: 'Updated Bio text',
        },
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .put('/api/host/profile')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .send({
          organizationName: 'Updated Brand Name',
          bio: 'Updated Bio text',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(hostUser.id, {
        organizationName: 'Updated Brand Name',
        bio: 'Updated Bio text',
      });
      expect(res.body.data.workspaceStatus).toBe('ACTIVE');
      expect(res.body.data.verificationStatus).toBe('UNVERIFIED');
    });
  });

  describe('5. POST /api/host/logo — Asset Uploads to Object Storage', () => {
    it('should return 400 when no file is attached', async () => {
      const res = await request(app)
        .post('/api/host/logo')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No file uploaded');
    });

    it('should successfully upload logo buffer and return storage URL', async () => {
      jest.spyOn(supabaseStorageService, 'uploadHostAsset').mockResolvedValue({
        publicUrl: 'https://supabase.internal/storage/v1/object/public/ticket-images/hosts/host-1/assets/logo.png',
        storagePath: 'hosts/host-1/assets/logo.png',
      });

      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockResolvedValue({
        supabaseUserId: hostUser.id,
        email: hostUser.email,
        hostProfile: { organizationName: 'My Org' },
      } as any);

      const updateSpy = jest.spyOn(mongoUserRepository, 'updateHostProfile').mockResolvedValue({} as any);

      const fakeImageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

      const res = await request(app)
        .post('/api/host/logo')
        .set('Authorization', `Bearer ${hostUserToken}`)
        .attach('logo', fakeImageBuffer, 'logo.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.logoUrl).toContain('supabase.internal');
      expect(updateSpy).toHaveBeenCalledWith(hostUser.id, {
        logoUrl: expect.stringContaining('supabase.internal'),
      });
    });
  });

  describe('6. Security & Invariant Regression Protections', () => {
    it('an onboarded host user CANNOT access Admin Dashboard endpoints merely because onboarding is complete', async () => {
      const res = await request(app)
        .get('/api/auth/admin/status')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message || res.body.error).toContain('Requires one of');
    });

    it('an onboarded host user CANNOT access Super Admin endpoints', async () => {
      const res = await request(app)
        .get('/api/auth/admin/super-status')
        .set('Authorization', `Bearer ${hostUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('User A cannot view or mutate User B organizer profile via body parameters (identity derived from JWT)', async () => {
      // Caller is otherUser, but attempts to pass hostUser.id in payload
      jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string) => {
        if (id === otherUser.id) {
          return {
            supabaseUserId: otherUser.id,
            email: otherUser.email,
            name: 'Other User',
            platformRole: 'USER',
            hostProfile: null,
          } as any;
        }
        return null;
      });

      const completeSpy = jest.spyOn(mongoUserRepository, 'completeOnboarding').mockResolvedValue({
        supabaseUserId: otherUser.id,
        email: otherUser.email,
        platformRole: 'USER',
        hostProfile: {
          organizationName: 'Spoofed Org',
          institutionType: 'INDEPENDENT',
        },
        workspaceStatus: 'ACTIVE',
        hostVerificationStatus: 'UNVERIFIED',
      } as any);

      const res = await request(app)
        .post('/api/host/onboarding')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          userId: hostUser.id, // Malicious spoofing attempt
          organizationName: 'Spoofed Org',
          institutionType: 'INDEPENDENT',
        });

      expect(res.status).toBe(200);
      // The service must have called completeOnboarding strictly with otherUser.id from verified JWT
      expect(completeSpy).toHaveBeenCalledWith(otherUser.id, expect.objectContaining({
        organizationName: 'Spoofed Org',
      }));
      expect(completeSpy).not.toHaveBeenCalledWith(hostUser.id, expect.anything());
    });
  });
});
