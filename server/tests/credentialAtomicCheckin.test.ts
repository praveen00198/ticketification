const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: null,
  supabasePublic: null,
}));

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { mongoEventCredentialCheckinRepository } from '../src/modules/events/repositories/mongo-event-credential-checkin.repository';

import { createJwtToken } from '../src/utils/local-auth';
import { setMongoConnectedForTesting } from '../src/db/mongodb';

describe('Phase 14: QR Verification + Atomic Check-in Engine', () => {
  jest.setTimeout(30000);

  const hostUser = { id: 'host-auth-id-14', email: 'host14@event.com', role: 'HOST' };
  const coordinatorUser = { id: 'coord-auth-id-14', email: 'coord14@event.com', role: 'COORDINATOR' };
  const authorizedVolunteerUser = { id: 'vol-auth-14', email: 'volunteer14@event.com', role: 'VOLUNTEER' };
  const unauthorizedVolunteerUser = { id: 'unauth-vol-14', email: 'unauthvol14@event.com', role: 'VOLUNTEER' };
  const outsiderUser = { id: 'outsider-14', email: 'outsider14@event.com', role: 'ATTENDEE' };

  const hostToken = createJwtToken({ id: hostUser.id, email: hostUser.email, role: 'USER' });
  const coordinatorToken = createJwtToken({ id: coordinatorUser.id, email: coordinatorUser.email, role: 'USER' });
  const authorizedVolunteerToken = createJwtToken({ id: authorizedVolunteerUser.id, email: authorizedVolunteerUser.email, role: 'USER' });
  const unauthorizedVolunteerToken = createJwtToken({ id: unauthorizedVolunteerUser.id, email: unauthorizedVolunteerUser.email, role: 'USER' });
  const outsiderToken = createJwtToken({ id: outsiderUser.id, email: outsiderUser.email, role: 'USER' });

  const testEventId = new mongoose.Types.ObjectId();
  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const authorizedVolunteerMongoId = new mongoose.Types.ObjectId();
  const unauthorizedVolunteerMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  let mockCredentials: Map<string, any>;
  let mockCheckinLogs: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);
    mockCredentials = new Map();
    mockCheckinLogs = [];

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'HackIndia 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'EVENT_LIVE',
      verificationStatus: 'VERIFIED',
    };

    // Supabase Auth
    mockGetUser.mockImplementation(async (token: string) => {
      if (token === hostToken) return { data: { user: hostUser }, error: null };
      if (token === coordinatorToken) return { data: { user: coordinatorUser }, error: null };
      if (token === authorizedVolunteerToken) return { data: { user: authorizedVolunteerUser }, error: null };
      if (token === unauthorizedVolunteerToken) return { data: { user: unauthorizedVolunteerUser }, error: null };
      if (token === outsiderToken) return { data: { user: outsiderUser }, error: null };
      return { data: { user: null }, error: new Error('Invalid token') };
    });

    // PG User Repo
    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === hostUser.id) return { id: hostUser.id, email: hostUser.email, role: 'HOST' } as any;
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, email: coordinatorUser.email, role: 'COORDINATOR' } as any;
      if (id === authorizedVolunteerUser.id) return { id: authorizedVolunteerUser.id, email: authorizedVolunteerUser.email, role: 'VOLUNTEER' } as any;
      if (id === unauthorizedVolunteerUser.id) return { id: unauthorizedVolunteerUser.id, email: unauthorizedVolunteerUser.email, role: 'VOLUNTEER' } as any;
      if (id === outsiderUser.id) return { id: outsiderUser.id, email: outsiderUser.email, role: 'ATTENDEE' } as any;
      return null;
    });

    // Mongo User Repo
    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === hostUser.id) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host User', platformRole: 'USER', status: 'ACTIVE' } as any;
      if (id === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator User', platformRole: 'USER', status: 'ACTIVE' } as any;
      if (id === authorizedVolunteerUser.id) return { _id: authorizedVolunteerMongoId, supabaseUserId: authorizedVolunteerUser.id, email: authorizedVolunteerUser.email, name: 'Authorized Volunteer', platformRole: 'USER', status: 'ACTIVE' } as any;
      if (id === unauthorizedVolunteerUser.id) return { _id: unauthorizedVolunteerMongoId, supabaseUserId: unauthorizedVolunteerUser.id, email: unauthorizedVolunteerUser.email, name: 'Unauthorized Volunteer', platformRole: 'USER', status: 'ACTIVE' } as any;
      if (id === outsiderUser.id) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider User', platformRole: 'USER', status: 'ACTIVE' } as any;
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (supabaseId: string) => {
      if (supabaseId === hostUser.id) return { _id: hostMongoId, supabaseId: hostUser.id, email: hostUser.email, platformRole: 'HOST' } as any;
      if (supabaseId === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'COORDINATOR' } as any;
      if (supabaseId === authorizedVolunteerUser.id) return { _id: authorizedVolunteerMongoId, supabaseId: authorizedVolunteerUser.id, email: authorizedVolunteerUser.email, platformRole: 'VOLUNTEER' } as any;
      if (supabaseId === unauthorizedVolunteerUser.id) return { _id: unauthorizedVolunteerMongoId, supabaseId: unauthorizedVolunteerUser.id, email: unauthorizedVolunteerUser.email, platformRole: 'VOLUNTEER' } as any;
      if (supabaseId === outsiderUser.id) return { _id: outsiderMongoId, supabaseId: outsiderUser.id, email: outsiderUser.email, platformRole: 'ATTENDEE' } as any;
      return null;
    });

    // Mongo Event Repo
    jest.spyOn(mongoEventRepository, 'findById').mockResolvedValue(baseEvent);

    // Mongo Member Repo (RBAC)
    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(async (eId: any, uId: any): Promise<any> => {
      if (uId.toString() === coordinatorMongoId.toString()) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: coordinatorMongoId,
          role: 'COORDINATOR',
          status: 'ACTIVE',
        };
      }
      if (uId.toString() === authorizedVolunteerMongoId.toString()) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: authorizedVolunteerMongoId,
          role: 'VOLUNTEER',
          permissions: ['SCAN_CREDENTIALS'],
          status: 'ACTIVE',
        };
      }
      if (uId.toString() === unauthorizedVolunteerMongoId.toString()) {
        return {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          userId: unauthorizedVolunteerMongoId,
          role: 'VOLUNTEER',
          permissions: ['WATER_DISTRIBUTION'], // Lacks SCAN_CREDENTIALS
          status: 'ACTIVE',
        };
      }
      return null;
    });

    // Mock Credential Repo
    jest.spyOn(mongoEventCredentialRepository, 'findByVerificationToken').mockImplementation(async (token: string) => {
      for (const cred of mockCredentials.values()) {
        if (cred.verificationToken === token) return cred;
      }
      return null;
    });

    jest.spyOn(mongoEventCredentialRepository, 'findById').mockImplementation(async (eId: any, cId?: any) => {
      const targetId = cId ? cId.toString() : eId.toString();
      return mockCredentials.get(targetId) || null;
    });

    // Mock Atomic Check-In Single Use
    jest.spyOn(mongoEventCredentialRepository, 'atomicCheckInSingleUse').mockImplementation(async (eId: string, cId: string) => {
      const cred = mockCredentials.get(cId.toString());
      if (!cred || cred.status !== 'ACTIVE' || cred.usagePolicy !== 'SINGLE_USE') {
        return null;
      }
      cred.status = 'CHECKED_IN';
      cred.firstCheckedInAt = cred.firstCheckedInAt || new Date();
      cred.lastCheckedInAt = new Date();
      cred.checkInCount = (cred.checkInCount || 0) + 1;
      return cred;
    });

    // Mock Atomic Check-In Reusable
    jest.spyOn(mongoEventCredentialRepository, 'atomicCheckInReusable').mockImplementation(async (eId: string, cId: string, workerName?: string) => {
      const cred = mockCredentials.get(cId.toString());
      if (!cred) return null;
      if (workerName && workerName.trim()) {
        cred.holder.name = workerName.trim();
        cred.holder.isAssigned = true;
      }
      cred.status = 'CHECKED_IN';
      cred.firstCheckedInAt = cred.firstCheckedInAt || new Date();
      cred.lastCheckedInAt = new Date();
      cred.checkInCount = (cred.checkInCount || 0) + 1;
      return cred;
    });

    // Mock Checkin Log Repo
    jest.spyOn(mongoEventCredentialCheckinRepository, 'createCheckinLog').mockImplementation(async (data: any) => {
      const logDoc = {
        _id: new mongoose.Types.ObjectId(),
        ...data,
        scannedAt: data.scannedAt || new Date(),
        createdAt: new Date(),
      };
      mockCheckinLogs.push(logDoc);
      return logDoc as any;
    });

    jest.spyOn(mongoEventCredentialCheckinRepository, 'findRecentByEvent').mockImplementation(async (eId: string, options: any = {}) => {
      let filtered = [...mockCheckinLogs];
      if (options.gate && options.gate !== 'ALL') {
        filtered = filtered.filter((l) => l.gate === options.gate);
      }
      if (options.scanStatus && options.scanStatus !== 'ALL') {
        filtered = filtered.filter((l) => l.scanStatus === options.scanStatus);
      }
      return filtered.slice(0, options.limit || 50);
    });

    jest.spyOn(mongoEventCredentialCheckinRepository, 'getCheckinStats').mockImplementation(async (eId: string) => {
      const successful = mockCheckinLogs.filter((l) => l.scanStatus === 'SUCCESS').length;
      const duplicates = mockCheckinLogs.filter((l) => l.scanStatus === 'ALREADY_CHECKED_IN').length;
      const revoked = mockCheckinLogs.filter((l) => l.scanStatus === 'REVOKED').length;
      return {
        totalScans: mockCheckinLogs.length,
        successfulCheckins: successful,
        duplicateRejections: duplicates,
        revokedRejections: revoked,
        velocityLast15Mins: successful,
      };
    });
  });

  describe('1. Single-Use Pass Check-In & Duplicate Scan Defense', () => {
    it('successfully checks in an active single-use credential and updates status', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 1,
        formattedId: 'HCK-00001',
        verificationToken: token,
        usagePolicy: 'SINGLE_USE',
        status: 'ACTIVE',
        holder: { name: 'Priya Sharma', category: 'HACKER', isAssigned: true },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ token, gate: 'North Entrance' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('CHECKED_IN');
      expect(res.body.data.checkInCount).toBe(1);
      expect(res.body.data.credential.status).toBe('CHECKED_IN');
      expect(mockCheckinLogs.length).toBe(1);
      expect(mockCheckinLogs[0].scanStatus).toBe('SUCCESS');
      expect(mockCheckinLogs[0].gate).toBe('North Entrance');
    });

    it('rejects a second check-in attempt on a single-use credential with ALREADY_CHECKED_IN', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '222233334444555566667777888899990000aaaabbbbccccddddeeeeffff1111';
      const firstScanTime = new Date('2026-10-10T09:00:00Z');
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 2,
        formattedId: 'HCK-00002',
        verificationToken: token,
        usagePolicy: 'SINGLE_USE',
        status: 'CHECKED_IN',
        holder: { name: 'Aditya Verma', category: 'HACKER', isAssigned: true },
        checkInCount: 1,
        firstCheckedInAt: firstScanTime,
        lastCheckedInAt: firstScanTime,
      };
      mockCredentials.set(credId.toString(), credential);

      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ token, gate: 'VIP Gate' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('ALREADY_CHECKED_IN');
      expect(res.body.message).toMatch(/already checked in/i);
      expect(mockCheckinLogs.length).toBe(1);
      expect(mockCheckinLogs[0].scanStatus).toBe('ALREADY_CHECKED_IN');
    });

    it('handles concurrent scans on single-use pass with exactly one success and one duplicate', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '7777888899990000aaaabbbbccccddddeeeeffff111122223333444455556666';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 3,
        formattedId: 'HCK-00003',
        verificationToken: token,
        usagePolicy: 'SINGLE_USE',
        status: 'ACTIVE',
        holder: { name: 'Concurrent Test', category: 'HACKER', isAssigned: true },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/events/${testEventId}/credentials/checkin`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({ token, gate: 'Gate A' }),
        request(app)
          .post(`/api/events/${testEventId}/credentials/checkin`)
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({ token, gate: 'Gate B' }),
      ]);

      const codes = [res1.body.code, res2.body.code];
      expect(codes).toContain('CHECKED_IN');
      expect(codes).toContain('ALREADY_CHECKED_IN');
    });
  });

  describe('2. Reusable Pass Multi-Entry & Unassigned Worker Workflow', () => {
    it('permits multiple entries for reusable staff credentials', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '33334444555566667777888899990000aaaabbbbccccddddeeeeffff11112222';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 10,
        formattedId: 'HCK-00010',
        verificationToken: token,
        usagePolicy: 'REUSABLE',
        status: 'ACTIVE',
        holder: { name: 'Siddharth Roy', category: 'ORGANIZER', isAssigned: true },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      // First entry
      const res1 = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ token, gate: 'Stage Gate' });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.code).toBe('VALID_REUSABLE');
      expect(res1.body.data.checkInCount).toBe(1);

      // Second entry
      const res2 = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ token, gate: 'Stage Gate' });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.code).toBe('VALID_REUSABLE');
      expect(res2.body.data.checkInCount).toBe(2);
    });

    it('requires worker name on first entry for an unassigned worker pass', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '4444555566667777888899990000aaaabbbbccccddddeeeeffff111122223333';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 25,
        formattedId: 'HCK-00025',
        verificationToken: token,
        usagePolicy: 'REUSABLE_WORKER',
        status: 'ACTIVE',
        holder: { name: '', category: 'CREW', isAssigned: false },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      // Attempt scan without workerName
      const resNoName = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ token, gate: 'Backstage Door' });

      expect(resNoName.status).toBe(200);
      expect(resNoName.body.success).toBe(false);
      expect(resNoName.body.code).toBe('WORKER_NAME_REQUIRED');

      // Attempt scan with workerName provided
      const resWithName = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ token, gate: 'Backstage Door', workerName: 'Anil Kumar' });

      expect(resWithName.status).toBe(200);
      expect(resWithName.body.success).toBe(true);
      expect(resWithName.body.code).toBe('VALID_REUSABLE');
      expect(credential.holder.name).toBe('Anil Kumar');
      expect(credential.holder.isAssigned).toBe(true);
    });
  });

  describe('3. Revoked & Expired Pass Rejection', () => {
    it('rejects revoked credentials and records an audit log entry', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '555566667777888899990000aaaabbbbccccddddeeeeffff1111222233334444';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 99,
        formattedId: 'HCK-00099',
        verificationToken: token,
        usagePolicy: 'SINGLE_USE',
        status: 'REVOKED',
        revokedReason: 'Security incident',
        holder: { name: 'Bad Actor', category: 'ATTENDEE', isAssigned: true },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ token, gate: 'Main Gate' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CREDENTIAL_REVOKED');
      expect(res.body.message).toContain('Security incident');
      expect(mockCheckinLogs.some((l) => l.scanStatus === 'REVOKED')).toBe(true);
    });
  });

  describe('4. Zero-Trust Staff RBAC Verification', () => {
    it('allows volunteer with SCAN_CREDENTIALS permission to check in attendees', async () => {
      const credId = new mongoose.Types.ObjectId();
      const token = '66667777888899990000aaaabbbbccccddddeeeeffff11112222333344445555';
      const credential: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 4,
        formattedId: 'HCK-00004',
        verificationToken: token,
        usagePolicy: 'SINGLE_USE',
        status: 'ACTIVE',
        holder: { name: 'Kavita Sen', category: 'HACKER', isAssigned: true },
        checkInCount: 0,
      };
      mockCredentials.set(credId.toString(), credential);

      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${authorizedVolunteerToken}`)
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('CHECKED_IN');
    });

    it('rejects volunteer without scanning permission with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${unauthorizedVolunteerToken}`)
        .send({ token: 'mock-token' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/scanning permissions/i);
    });

    it('rejects outside attendee with 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ token: 'mock-token' });

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/checkin`)
        .send({ token: 'mock-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('5. Live Logs Feed & Velocity Statistics', () => {
    it('retrieves recent checkin logs and aggregated velocity stats', async () => {
      // Seed some logs
      mockCheckinLogs.push(
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          scanStatus: 'SUCCESS',
          gate: 'Main Gate',
          holderSnapshot: { name: 'User 1', category: 'HACKER', formattedId: 'HCK-00001' },
          scannedAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          scanStatus: 'ALREADY_CHECKED_IN',
          gate: 'Main Gate',
          holderSnapshot: { name: 'User 2', category: 'HACKER', formattedId: 'HCK-00002' },
          scannedAt: new Date(),
        }
      );

      // Check logs endpoint
      const logsRes = await request(app)
        .get(`/api/events/${testEventId}/credentials/checkins?gate=Main Gate`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(logsRes.status).toBe(200);
      expect(logsRes.body.success).toBe(true);
      expect(logsRes.body.data.length).toBe(2);

      // Check stats endpoint
      const statsRes = await request(app)
        .get(`/api/events/${testEventId}/credentials/checkin-stats`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.success).toBe(true);
      expect(statsRes.body.data.totalScans).toBe(2);
      expect(statsRes.body.data.successfulCheckins).toBe(1);
      expect(statsRes.body.data.duplicateRejections).toBe(1);
    });
  });
});
