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
import mongoose from 'mongoose';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventAssignmentRepository } from '../src/modules/events/repositories/mongo-event-assignment.repository';

import { createJwtToken } from '../src/utils/local-auth';

describe('Phase 9: Mentor & Evaluator System (Restricted Workspaces & Blind Review)', () => {
  const hostUser = { id: 'mock-host-uuid-phase9', email: 'host.phase9@hackathon.org', role: 'USER' as const };
  const coordinatorUser = { id: 'mock-coord-uuid-phase9', email: 'coord.phase9@hackathon.org', role: 'USER' as const };
  const mentorUser = { id: 'mock-mentor-uuid-phase9', email: 'mentor.phase9@hackathon.org', role: 'USER' as const };
  const evaluatorUser = { id: 'mock-eval-uuid-phase9', email: 'evaluator.phase9@hackathon.org', role: 'USER' as const };
  const volunteerUser = { id: 'mock-vol-uuid-phase9', email: 'volunteer.phase9@hackathon.org', role: 'USER' as const };
  const outsiderUser = { id: 'mock-out-uuid-phase9', email: 'outsider.phase9@other.org', role: 'USER' as const };

  const hostToken = createJwtToken(hostUser);
  const coordinatorToken = createJwtToken(coordinatorUser);
  const mentorToken = createJwtToken(mentorUser);
  const evaluatorToken = createJwtToken(evaluatorUser);
  const volunteerToken = createJwtToken(volunteerUser);
  const outsiderToken = createJwtToken(outsiderUser);

  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const mentorMongoId = new mongoose.Types.ObjectId();
  const evaluatorMongoId = new mongoose.Types.ObjectId();
  const volunteerMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const coordinatorMemberId = new mongoose.Types.ObjectId();
  const mentorMemberId = new mongoose.Types.ObjectId();
  const evaluatorMemberId = new mongoose.Types.ObjectId();
  const volunteerMemberId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockAssignments: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockAssignments = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Hackathon Championship 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    // Active Coordinator
    mockMembers.set(coordinatorMemberId.toString(), {
      _id: coordinatorMemberId,
      eventId: testEventId,
      userId: coordinatorMongoId,
      userEmail: coordinatorUser.email,
      role: 'COORDINATOR',
      permissions: ['MANAGE_STAFF', 'MANAGE_EVENT_SETTINGS'],
      status: 'ACTIVE',
    });

    // Active Mentor
    mockMembers.set(mentorMemberId.toString(), {
      _id: mentorMemberId,
      eventId: testEventId,
      userId: mentorMongoId,
      userEmail: mentorUser.email,
      role: 'MENTOR',
      permissions: ['MENTOR_ASSIGNED_TEAMS'],
      status: 'ACTIVE',
    });

    // Active Evaluator
    mockMembers.set(evaluatorMemberId.toString(), {
      _id: evaluatorMemberId,
      eventId: testEventId,
      userId: evaluatorMongoId,
      userEmail: evaluatorUser.email,
      role: 'EVALUATOR',
      permissions: ['SCORE_ASSIGNED_TEAMS', 'VIEW_EVALUATION_RESULTS'],
      status: 'ACTIVE',
    });

    // Active Volunteer
    mockMembers.set(volunteerMemberId.toString(), {
      _id: volunteerMemberId,
      eventId: testEventId,
      userId: volunteerMongoId,
      userEmail: volunteerUser.email,
      role: 'VOLUNTEER',
      permissions: ['VIEW_ASSIGNED_TASKS'],
      status: 'ACTIVE',
    });

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) return { data: { user: { id: hostUser.id, email: hostUser.email } }, error: null };
      if (token === coordinatorToken) return { data: { user: { id: coordinatorUser.id, email: coordinatorUser.email } }, error: null };
      if (token === mentorToken) return { data: { user: { id: mentorUser.id, email: mentorUser.email } }, error: null };
      if (token === evaluatorToken) return { data: { user: { id: evaluatorUser.id, email: evaluatorUser.email } }, error: null };
      if (token === volunteerToken) return { data: { user: { id: volunteerUser.id, email: volunteerUser.email } }, error: null };
      if (token === outsiderToken) return { data: { user: { id: outsiderUser.id, email: outsiderUser.email } }, error: null };
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, name: 'Coordinator', email: coordinatorUser.email, role: 'USER' };
      if (id === mentorUser.id) return { id: mentorUser.id, name: 'Mentor', email: mentorUser.email, role: 'USER' };
      if (id === evaluatorUser.id) return { id: evaluatorUser.id, name: 'Evaluator', email: evaluatorUser.email, role: 'USER' };
      if (id === volunteerUser.id) return { id: volunteerUser.id, name: 'Volunteer', email: volunteerUser.email, role: 'USER' };
      if (id === outsiderUser.id) return { id: outsiderUser.id, name: 'Outsider', email: outsiderUser.email, role: 'USER' };
      return null;
    });

    const userMap: Record<string, any> = {
      [hostUser.id]: { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [coordinatorUser.id]: { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [mentorUser.id]: { _id: mentorMongoId, supabaseUserId: mentorUser.id, email: mentorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [evaluatorUser.id]: { _id: evaluatorMongoId, supabaseUserId: evaluatorUser.id, email: evaluatorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [volunteerUser.id]: { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [outsiderUser.id]: { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [hostMongoId.toString()]: { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [coordinatorMongoId.toString()]: { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [mentorMongoId.toString()]: { _id: mentorMongoId, supabaseUserId: mentorUser.id, email: mentorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [evaluatorMongoId.toString()]: { _id: evaluatorMongoId, supabaseUserId: evaluatorUser.id, email: evaluatorUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [volunteerMongoId.toString()]: { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, platformRole: 'USER', status: 'ACTIVE' },
      [outsiderMongoId.toString()]: { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, platformRole: 'USER', status: 'ACTIVE' },
    };

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      return userMap[id] || null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventMemberRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockMembers.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(
      async (eventId: any, userId: any): Promise<any> => {
        for (const m of mockMembers.values()) {
          if (m.eventId.toString() === eventId.toString() && m.userId && m.userId.toString() === userId.toString()) {
            return m;
          }
        }
        return null;
      }
    );

    // Mock Assignment Repository
    jest.spyOn(mongoEventAssignmentRepository, 'createAssignment').mockImplementation(async (doc: any): Promise<any> => {
      const assignmentId = new mongoose.Types.ObjectId();
      const created = {
        _id: assignmentId,
        ...doc,
        mentorshipLogs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAssignments.set(assignmentId.toString(), created);
      return created;
    });

    jest.spyOn(mongoEventAssignmentRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockAssignments.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventAssignmentRepository, 'findByIdAndEvent').mockImplementation(
      async (assignmentId: any, eventId: any): Promise<any> => {
        const a = mockAssignments.get(assignmentId.toString());
        if (a && a.eventId.toString() === eventId.toString()) return a;
        return null;
      }
    );

    jest.spyOn(mongoEventAssignmentRepository, 'findByEventAndMemberAndTarget').mockImplementation(
      async (eventId: any, memberId: any, targetName: string): Promise<any> => {
        for (const a of mockAssignments.values()) {
          if (
            a.eventId.toString() === eventId.toString() &&
            a.memberId.toString() === memberId.toString() &&
            a.targetName === targetName
          ) {
            return a;
          }
        }
        return null;
      }
    );

    jest.spyOn(mongoEventAssignmentRepository, 'listAssignments').mockImplementation(
      async (eventId: any, filters?: any): Promise<any> => {
        const list: any[] = [];
        for (const a of mockAssignments.values()) {
          if (a.eventId.toString() === eventId.toString()) {
            if (filters?.role && a.role !== filters.role) continue;
            if (filters?.track && a.track !== filters.track) continue;
            list.push(a);
          }
        }
        return list;
      }
    );

    jest.spyOn(mongoEventAssignmentRepository, 'listAssignmentsForMember').mockImplementation(
      async (eventId: any, memberId: any): Promise<any> => {
        const list: any[] = [];
        for (const a of mockAssignments.values()) {
          if (a.eventId.toString() === eventId.toString() && a.memberId.toString() === memberId.toString()) {
            list.push(a);
          }
        }
        return list;
      }
    );

    jest.spyOn(mongoEventAssignmentRepository, 'addMentorshipLog').mockImplementation(
      async (assignmentId: any, log: any): Promise<any> => {
        const a = mockAssignments.get(assignmentId.toString());
        if (!a) return null;
        a.mentorshipLogs.push(log);
        mockAssignments.set(assignmentId.toString(), a);
        return a;
      }
    );

    jest.spyOn(mongoEventAssignmentRepository, 'deleteAssignment').mockImplementation(
      async (assignmentId: any): Promise<any> => {
        return mockAssignments.delete(assignmentId.toString());
      }
    );
  });

  describe('1. Mentor & Evaluator Assignment Workflows', () => {
    it('allows Host to assign a Mentor to a track with notes', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: mentorMemberId.toString(),
          role: 'MENTOR',
          track: 'AI & Machine Learning',
          targetName: 'Track: AI & Machine Learning',
          assignedTargetType: 'TRACK',
          notes: 'Guide teams on prompt engineering and model fine-tuning.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('MENTOR');
      expect(res.body.data.targetName).toBe('Track: AI & Machine Learning');
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('allows Coordinator to assign an Evaluator to a problem track', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          memberId: evaluatorMemberId.toString(),
          role: 'EVALUATOR',
          track: 'Fintech & Security',
          targetName: 'Track: Fintech & Security',
          assignedTargetType: 'TRACK',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('EVALUATOR');
    });

    it('allows Host to assign a Judge to a problem track', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: evaluatorMemberId.toString(),
          role: 'JUDGE',
          track: 'Web3 & Decentralization',
          targetName: 'Track: Web3 & Decentralization',
          assignedTargetType: 'TRACK',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('JUDGE');
    });

    it('rejects assigning EVALUATOR role to a member with VOLUNTEER role', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: volunteerMemberId.toString(),
          role: 'EVALUATOR',
          targetName: 'Track: Web3',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Update their member role first');
    });

    it('rejects duplicate assignment for the same member and target', async () => {
      await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: mentorMemberId.toString(),
          role: 'MENTOR',
          targetName: 'Track: Open Innovation',
        });

      const resDuplicate = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: mentorMemberId.toString(),
          role: 'MENTOR',
          targetName: 'Track: Open Innovation',
        });

      expect(resDuplicate.status).toBe(400);
      expect(resDuplicate.body.error.message).toContain('already assigned');
    });

    it('denies regular volunteers from creating assignments', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          memberId: mentorMemberId.toString(),
          role: 'MENTOR',
          targetName: 'Track: Hackers',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Workspace Isolation & Blind Review Scoping', () => {
    let mentorAssignmentId: string;

    beforeEach(async () => {
      const resMentor = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: mentorMemberId.toString(),
          role: 'MENTOR',
          track: 'AI Track',
          targetName: 'Track: AI Track',
        });
      mentorAssignmentId = resMentor.body.data._id.toString();

      await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          memberId: evaluatorMemberId.toString(),
          role: 'EVALUATOR',
          track: 'Web3 Track',
          targetName: 'Track: Web3 Track',
        });
    });

    it('allows Host to view all assignments and filter by role', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/assignments?role=MENTOR`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].role).toBe('MENTOR');
    });

    it('restricts Mentor to only their assigned targets via my-assignments endpoint', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/assignments/my-assignments`)
        .set('Authorization', `Bearer ${mentorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assignments.length).toBe(1);
      expect(res.body.data.assignments[0].targetName).toBe('Track: AI Track');
    });

    it('restricts Evaluator to only their assigned targets via my-assignments endpoint', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/assignments/my-assignments`)
        .set('Authorization', `Bearer ${evaluatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.assignments.length).toBe(1);
      expect(res.body.data.assignments[0].targetName).toBe('Track: Web3 Track');
    });

    it('denies outsider from accessing assignments', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/assignments`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });

    it('allows assigned Mentor to record mentorship session guidance notes', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/assignments/${mentorAssignmentId}/logs`)
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({
          note: 'Reviewed architecture diagram for AI pipeline. Recommended vector caching.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mentorshipLogs.length).toBe(1);
      expect(res.body.data.mentorshipLogs[0].note).toContain('Reviewed architecture diagram');
    });

    it('allows Host to delete an assignment', async () => {
      const res = await request(app)
        .delete(`/api/events/${testEventId.toString()}/assignments/${mentorAssignmentId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successfully removed');
    });
  });
});
