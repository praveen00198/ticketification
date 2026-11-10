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

import * as xlsx from 'xlsx';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { ticketService } from '../src/modules/tickets/services/ticket.service';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';
import { EventModel } from '../src/db/mongo/models/event.model';
import { EventMemberModel } from '../src/db/mongo/models/event-member.model';
import { EventCredentialModel } from '../src/db/mongo/models/event-credential.model';
import { UserModel } from '../src/db/mongo/models/user.model';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { createJwtToken } from '../src/utils/local-auth';
import { setMongoConnectedForTesting } from '../src/db/mongodb';
import { NotFoundError } from '../src/middlewares/error.middleware';

describe('Milestone 1: Full Database Export for Excel with Event Scoping', () => {
  jest.setTimeout(30000);

  const hostUser = { id: 'host-auth-id-m1', email: 'host-m1@event.com', role: 'HOST' };
  const coordinatorUser = { id: 'coord-auth-id-m1', email: 'coord-m1@event.com', role: 'COORDINATOR' };
  const volunteerUser = { id: 'vol-auth-m1', email: 'vol-m1@event.com', role: 'VOLUNTEER' };
  const outsiderUser = { id: 'outsider-auth-id-m1', email: 'outsider-m1@event.com', role: 'ATTENDEE' };

  const hostToken = createJwtToken({ id: hostUser.id, email: hostUser.email, role: 'USER' });
  const coordinatorToken = createJwtToken({ id: coordinatorUser.id, email: coordinatorUser.email, role: 'USER' });
  const volunteerToken = createJwtToken({ id: volunteerUser.id, email: volunteerUser.email, role: 'USER' });
  const outsiderToken = createJwtToken({ id: outsiderUser.id, email: outsiderUser.email, role: 'USER' });

  const testEventId = new mongoose.Types.ObjectId();
  const otherEventId = new mongoose.Types.ObjectId();
  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const volunteerMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  let testEvent: any;
  let otherEvent: any;
  let mockCredentials: any[] = [];
  let otherEventCredentials: any[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    setMongoConnectedForTesting(true);

    testEvent = {
      _id: testEventId,
      name: 'Global Tech Summit 2026',
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      eventType: 'CONFERENCE',
      credentialTerminology: 'Conference Badge',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };

    otherEvent = {
      _id: otherEventId,
      name: 'Unrelated Hackathon 2026',
      ownerId: outsiderMongoId,
      ownerSupabaseId: outsiderUser.id,
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };

    // Generate 716 test credentials for testEventId (to strictly test exceeding the old 200 clamp)
    mockCredentials = [];
    for (let i = 1; i <= 716; i++) {
      const credId = new mongoose.Types.ObjectId();
      const seqStr = i.toString().padStart(5, '0');
      mockCredentials.push({
        _id: credId,
        eventId: testEventId,
        sequenceNumber: i,
        formattedId: `GLO-${seqStr}`,
        verificationToken: `token-secret-${i}`,
        credentialType: i % 2 === 0 ? 'VIP' : 'General Admission',
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        holder: {
          name: `Attendee ${i}`,
          email: `attendee${i}@summit.org`,
          phone: `+1 555-01${(100 + (i % 899)).toString()}`,
          organization: `Company ${i % 20}`,
          designation: 'Engineer',
          category: 'ATTENDEE',
          isAssigned: true,
        },
        asset: {
          storagePath: `events/${testEventId}/credentials/GLO-${seqStr}.png`,
          publicUrl: `https://test-storage.supabase.co/storage/v1/object/public/credentials/GLO-${seqStr}.png`,
          renderedAt: new Date(),
          mimeType: 'image/png',
        },
        createdAt: new Date(),
      });
    }

    // Generate 50 credentials for otherEventId
    otherEventCredentials = [];
    for (let j = 1; j <= 50; j++) {
      const otherId = new mongoose.Types.ObjectId();
      otherEventCredentials.push({
        _id: otherId,
        eventId: otherEventId,
        sequenceNumber: j,
        formattedId: `HAK-${j.toString().padStart(5, '0')}`,
        verificationToken: `other-token-${j}`,
        credentialType: 'Hacker Pass',
        status: 'ACTIVE',
        usagePolicy: 'SINGLE_USE',
        holder: {
          name: `Other Attendee ${j}`,
          email: `other${j}@hackathon.org`,
          phone: `+1 555-0999`,
          category: 'ATTENDEE',
          isAssigned: true,
        },
        asset: {
          storagePath: `events/${otherEventId}/credentials/HAK-${j.toString().padStart(5, '0')}.png`,
          publicUrl: `https://test-storage.supabase.co/credentials/other-${j}.png`,
        },
        createdAt: new Date(),
      });
    }

    // Mock Supabase Auth
    mockGetUser.mockImplementation(async (token: string) => {
      if (token === hostToken) return { data: { user: hostUser }, error: null };
      if (token === coordinatorToken) return { data: { user: coordinatorUser }, error: null };
      if (token === volunteerToken) return { data: { user: volunteerUser }, error: null };
      if (token === outsiderToken) return { data: { user: outsiderUser }, error: null };
      return { data: { user: null }, error: new Error('Invalid token') };
    });

    // Mock User Model & Repositories
    jest.spyOn(UserModel, 'findById').mockImplementation(((id: any) => ({
      lean: () => ({
        exec: async () => {
          const idStr = id?.toString();
          if (idStr === hostMongoId.toString()) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, platformRole: 'USER' };
          if (idStr === coordinatorMongoId.toString()) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'USER' };
          if (idStr === volunteerMongoId.toString()) return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, platformRole: 'USER' };
          if (idStr === outsiderMongoId.toString()) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, platformRole: 'USER' };
          return null;
        },
      }),
    })) as any);

    jest.spyOn(UserModel, 'findOne').mockImplementation(((query: any) => ({
      lean: () => ({
        exec: async () => {
          const subId = query?.supabaseUserId;
          if (subId === hostUser.id) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, platformRole: 'USER' };
          if (subId === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'USER' };
          if (subId === volunteerUser.id) return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, platformRole: 'USER' };
          if (subId === outsiderUser.id) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, platformRole: 'USER' };
          return null;
        },
      }),
    })) as any);

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id || id === hostMongoId.toString()) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === coordinatorUser.id || id === coordinatorMongoId.toString()) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === volunteerUser.id || id === volunteerMongoId.toString()) return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === outsiderUser.id || id === outsiderMongoId.toString()) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider User', platformRole: 'USER', status: 'ACTIVE' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === coordinatorUser.id) return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === volunteerUser.id) return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer User', platformRole: 'USER', status: 'ACTIVE' };
      if (id === outsiderUser.id) return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider User', platformRole: 'USER', status: 'ACTIVE' };
      return null;
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === hostUser.id) return { id: hostUser.id, email: hostUser.email, role: 'HOST' } as any;
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, email: coordinatorUser.email, role: 'COORDINATOR' } as any;
      if (id === volunteerUser.id) return { id: volunteerUser.id, email: volunteerUser.email, role: 'VOLUNTEER' } as any;
      if (id === outsiderUser.id) return { id: outsiderUser.id, email: outsiderUser.email, role: 'ATTENDEE' } as any;
      return null;
    });

    // Mock Event Model & Repository
    jest.spyOn(EventModel, 'findById').mockImplementation(((id: any) => {
      const idStr = id?.toString();
      if (idStr === testEventId.toString()) return Promise.resolve(testEvent);
      if (idStr === otherEventId.toString()) return Promise.resolve(otherEvent);
      return Promise.resolve(null);
    }) as any);

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === testEventId.toString()) return testEvent;
      if (id === otherEventId.toString()) return otherEvent;
      return null;
    });

    // Mock Event Member Model (strictly scoped RBAC)
    jest.spyOn(EventMemberModel, 'findOne').mockImplementation(((query: any) => {
      const eventIdMatch = query?.eventId?.toString() === testEventId.toString();
      if (!eventIdMatch) return Promise.resolve(null);

      const statusMatch = !query.status || query.status === 'ACTIVE';
      if (!statusMatch) return Promise.resolve(null);

      // Check user identity in $or
      const orList: any[] = query.$or || [];
      const userMatched = orList.some((cond: any) => {
        if (cond.userId && (cond.userId.toString() === coordinatorMongoId.toString() || cond.userId.toString() === coordinatorUser.id)) {
          return true;
        }
        if (cond.userEmail && cond.userEmail.toLowerCase() === coordinatorUser.email.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (userMatched) {
        const allowedRoles = query.role?.$in || [query.role];
        if (allowedRoles.includes('COORDINATOR') || allowedRoles.includes('HOST')) {
          return Promise.resolve({
            _id: new mongoose.Types.ObjectId(),
            eventId: testEventId,
            userId: coordinatorMongoId,
            userEmail: coordinatorUser.email,
            role: 'COORDINATOR',
            status: 'ACTIVE',
          });
        }
      }

      return Promise.resolve(null);
    }) as any);

    // Mock Credential Model & Repository
    jest.spyOn(mongoEventCredentialRepository, 'findAllForExport').mockImplementation(
      async (eventId: string, filters: any = {}): Promise<any[]> => {
        if (eventId === testEventId.toString()) {
          return [...mockCredentials];
        }
        if (eventId === otherEventId.toString()) {
          return [...otherEventCredentials];
        }
        return [];
      }
    );

    jest.spyOn(mongoEventCredentialRepository, 'findByEvent').mockImplementation(
      async (eventId: string, filters: any = {}): Promise<any> => {
        const source = eventId === testEventId.toString() ? mockCredentials : otherEventCredentials;
        const requestedLimit = Number(filters.limit) || 50;
        const limit = Math.min(Math.max(requestedLimit, 1), 50000);
        const offset = Math.max(Number(filters.offset) || 0, 0);

        const sliced = source.slice(offset, offset + limit);
        return {
          credentials: sliced,
          total: source.length,
        };
      }
    );
  });

  describe('Full Database Export Query & Volume (> 200 Rows)', () => {
    it('should export all 716 attendees without truncation by the previous 200-row limit', async () => {
      const result = await ticketService.generateTicketsExcel(testEventId.toString(), hostUser.id);

      expect(result).toBeDefined();
      expect(result.count).toBe(716);
      expect(result.fileName).toMatch(/Global_Tech_Summit_2026.*Tickets-Roster\.xlsx$/);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);

      // Verify Excel contents
      const workbook = xlsx.read(result.buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('Tickets Roster');
      const sheet = workbook.Sheets['Tickets Roster'];
      const data: any[] = xlsx.utils.sheet_to_json(sheet);

      expect(data.length).toBe(716);
      expect(data[0]['Name']).toBe('Attendee 1');
      expect(data[0]['Email']).toBe('attendee1@summit.org');
      expect(data[0]['Contact']).toContain('+1 555-01');
      expect(data[0]['Ticket URL']).toBe(mockCredentials[0].asset.publicUrl);

      // Verify last row is included (confirming no 200 row cutoff)
      expect(data[715]['Name']).toBe('Attendee 716');
      expect(data[715]['Email']).toBe('attendee716@summit.org');
    });

    it('should export all 716 attendees via HTTP API endpoint GET /api/tickets/events/:eventId/export-excel', async () => {
      const res = await request(app)
        .get(`/api/tickets/events/${testEventId}/export-excel`)
        .set('Authorization', `Bearer ${hostToken}`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.header['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.header['content-disposition']).toContain('Global_Tech_Summit_2026');

      const workbook = xlsx.read(res.body, { type: 'buffer' });
      const sheet = workbook.Sheets['Tickets Roster'];
      const data: any[] = xlsx.utils.sheet_to_json(sheet);

      expect(data.length).toBe(716);
    });

    it('should strictly isolate events and never export records belonging to another eventId', async () => {
      const result = await ticketService.generateTicketsExcel(testEventId.toString(), hostUser.id);
      const workbook = xlsx.read(result.buffer, { type: 'buffer' });
      const data: any[] = xlsx.utils.sheet_to_json(workbook.Sheets['Tickets Roster']);

      // None of the 50 otherEvent attendees should be present
      const otherEmails = new Set(otherEventCredentials.map((c) => c.holder.email));
      const crossEventLeak = data.some((row: any) => otherEmails.has(row['Email']));
      expect(crossEventLeak).toBe(false);
    });
  });

  describe('IDOR Security & Host/Coordinator RBAC Permissions', () => {
    it('should allow the Event Owner to export Excel roster', async () => {
      const result = await ticketService.generateTicketsExcel(testEventId.toString(), hostUser.id);
      expect(result.count).toBe(716);
    });

    it('should allow an active Coordinator in event_members to export Excel roster', async () => {
      const result = await ticketService.generateTicketsExcel(testEventId.toString(), coordinatorUser.id);
      expect(result.count).toBe(716);

      // Via API endpoint
      await request(app)
        .get(`/api/tickets/events/${testEventId}/export-excel`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .expect(200);
    });

    it('should block unauthorized users (IDOR) who are not event owner or host/coordinator', async () => {
      // Direct service call should reject with NotFoundError
      await expect(
        ticketService.generateTicketsExcel(testEventId.toString(), outsiderUser.id)
      ).rejects.toThrow(NotFoundError);

      // HTTP API call should return 404
      const res = await request(app)
        .get(`/api/tickets/events/${testEventId}/export-excel`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);

      const errorMessage = res.body.error?.message || res.body.message || JSON.stringify(res.body);
      expect(errorMessage).toMatch(/unauthorized|not found/i);
    });

    it('should block volunteers from exporting Excel roster (insufficient role)', async () => {
      await expect(
        ticketService.generateTicketsExcel(testEventId.toString(), volunteerUser.id)
      ).rejects.toThrow(NotFoundError);

      await request(app)
        .get(`/api/tickets/events/${testEventId}/export-excel`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .expect(404);
    });

    it('should block unauthorized users on getTicketsByEvent', async () => {
      await expect(
        ticketService.getTicketsByEvent(testEventId.toString(), outsiderUser.id)
      ).rejects.toThrow(NotFoundError);

      const authorizedResult = await ticketService.getTicketsByEvent(testEventId.toString(), hostUser.id);
      expect(authorizedResult.tickets.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization & Storage Check Elimination', () => {
    it('should eliminate sequential synchronous storage check calls during Excel generation', async () => {
      const checkStorageSpy = jest.spyOn(supabaseStorageService, 'checkObjectExists');

      const result = await ticketService.generateTicketsExcel(testEventId.toString(), hostUser.id);

      expect(result.count).toBe(716);
      // Verify checkObjectExists was NEVER called in a loop for the 716 items
      expect(checkStorageSpy).not.toHaveBeenCalled();
    });

    it('should construct deterministic download fallback URLs when direct public URL is not populated', async () => {
      // Mock credentials with missing public URL but valid storagePath
      const customCredentials = [
        {
          _id: new mongoose.Types.ObjectId(),
          eventId: testEventId,
          sequenceNumber: 1,
          formattedId: 'GLO-00001',
          verificationToken: 'token-1',
          credentialType: 'General Admission',
          status: 'ACTIVE',
          holder: { name: 'Alice Test', email: 'alice@test.com' },
          asset: { storagePath: `events/${testEventId}/credentials/GLO-00001.png` },
          createdAt: new Date(),
        },
      ];

      jest.spyOn(mongoEventCredentialRepository, 'findAllForExport').mockResolvedValueOnce(customCredentials as any);
      jest.spyOn(supabaseStorageService, 'isConfigured').mockReturnValue(true);
      jest.spyOn(supabaseStorageService, 'getPublicUrl').mockReturnValue('https://supabase.co/storage/GLO-00001.png');

      const result = await ticketService.generateTicketsExcel(testEventId.toString(), hostUser.id);
      const workbook = xlsx.read(result.buffer, { type: 'buffer' });
      const data: any[] = xlsx.utils.sheet_to_json(workbook.Sheets['Tickets Roster']);

      expect(data[0]['Ticket URL']).toBe('https://supabase.co/storage/GLO-00001.png');
    });
  });

  describe('Partial Export with specific ticketIds', () => {
    it('should export only specified ticketIds when filter is provided', async () => {
      const selectedIds = [
        mockCredentials[0]._id.toString(),
        mockCredentials[1]._id.toString(),
        mockCredentials[2]._id.toString(),
      ];

      const result = await ticketService.generateTicketsExcel(
        testEventId.toString(),
        hostUser.id,
        selectedIds
      );

      expect(result.count).toBe(3);
      expect(result.fileName).toContain('Selected-Tickets-Roster.xlsx');

      const workbook = xlsx.read(result.buffer, { type: 'buffer' });
      const data: any[] = xlsx.utils.sheet_to_json(workbook.Sheets['Tickets Roster']);
      expect(data.length).toBe(3);
      expect(data[0]['Name']).toBe('Attendee 1');
      expect(data[1]['Name']).toBe('Attendee 2');
      expect(data[2]['Name']).toBe('Attendee 3');
    });
  });

  describe('Repository Layer Verification', () => {
    it('should allow findByEvent to request up to 50,000 without 200 clamp', async () => {
      // Restore the mock to test real repository method logic
      jest.restoreAllMocks();

      // Temporarily mock EventCredentialModel.find and countDocuments for repository unit test
      const dummy500: any[] = Array.from({ length: 500 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(),
        eventId: testEventId,
        sequenceNumber: i + 1,
      }));

      const findSpy = jest.spyOn(EventCredentialModel, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation((lim: number) => {
          expect(lim).toBe(50000); // Verify limit is NOT clamped to 200
          return Promise.resolve(dummy500);
        }),
      } as any);

      const countSpy = jest.spyOn(EventCredentialModel, 'countDocuments').mockResolvedValue(500 as any);

      const repoResult = await mongoEventCredentialRepository.findByEvent(testEventId.toString(), {
        limit: 50000,
      });

      expect(repoResult.credentials.length).toBe(500);
      expect(findSpy).toHaveBeenCalled();

      findSpy.mockRestore();
      countSpy.mockRestore();
    });
  });
});
