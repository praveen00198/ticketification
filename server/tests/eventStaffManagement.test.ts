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
import { mongoEventTaskRepository } from '../src/modules/events/repositories/mongo-event-task.repository';
import { createJwtToken } from '../src/utils/local-auth';

describe('Phase 8: Volunteer & Coordinator Management (Staff Operations & Task Engine)', () => {
  const hostUser = {
    id: 'mock-host-uuid-phase8',
    email: 'host.phase8@summit.org',
  };
  const coordinatorUser = {
    id: 'mock-coordinator-uuid-phase8',
    email: 'coordinator.phase8@summit.org',
  };
  const volunteerUser = {
    id: 'mock-volunteer-uuid-phase8',
    email: 'volunteer.phase8@summit.org',
  };
  const unassignedVolunteer = {
    id: 'mock-unassigned-uuid-phase8',
    email: 'unassigned.phase8@summit.org',
  };
  const outsiderUser = {
    id: 'mock-outsider-uuid-phase8',
    email: 'outsider@other.org',
  };

  const hostToken = createJwtToken({ id: hostUser.id, email: hostUser.email, role: 'USER' });
  const coordinatorToken = createJwtToken({ id: coordinatorUser.id, email: coordinatorUser.email, role: 'USER' });
  const volunteerToken = createJwtToken({ id: volunteerUser.id, email: volunteerUser.email, role: 'USER' });
  const unassignedToken = createJwtToken({ id: unassignedVolunteer.id, email: unassignedVolunteer.email, role: 'USER' });
  const outsiderToken = createJwtToken({ id: outsiderUser.id, email: outsiderUser.email, role: 'USER' });

  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const volunteerMongoId = new mongoose.Types.ObjectId();
  const unassignedMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const volunteerMemberId = new mongoose.Types.ObjectId();
  const unassignedMemberId = new mongoose.Types.ObjectId();
  const coordinatorMemberId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockTasks: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockTasks = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Global Tech Summit 2026',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Summit Badge',
      attendanceMode: 'TICKETIFICATION_REGISTRATION',
      venue: { type: 'PHYSICAL', name: 'Main Arena', city: 'Bengaluru', country: 'India' },
      schedule: {
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 172800000),
        timezone: 'Asia/Kolkata',
      },
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    // Active Coordinator Member
    mockMembers.set(coordinatorMemberId.toString(), {
      _id: coordinatorMemberId,
      eventId: testEventId,
      userId: coordinatorMongoId,
      userEmail: coordinatorUser.email,
      role: 'COORDINATOR',
      permissions: ['MANAGE_STAFF', 'MANAGE_ATTENDEES', 'SCAN_CREDENTIALS', 'UPDATE_ASSIGNED_TASKS', 'VIEW_ASSIGNED_TASKS'],
      status: 'ACTIVE',
    });

    // Active Volunteer Member (Assigned to task)
    mockMembers.set(volunteerMemberId.toString(), {
      _id: volunteerMemberId,
      eventId: testEventId,
      userId: volunteerMongoId,
      userEmail: volunteerUser.email,
      role: 'VOLUNTEER',
      permissions: ['VIEW_ASSIGNED_TASKS'],
      status: 'ACTIVE',
    });

    // Active Volunteer Member (Not assigned to task)
    mockMembers.set(unassignedMemberId.toString(), {
      _id: unassignedMemberId,
      eventId: testEventId,
      userId: unassignedMongoId,
      userEmail: unassignedVolunteer.email,
      role: 'VOLUNTEER',
      permissions: ['VIEW_ASSIGNED_TASKS'],
      status: 'ACTIVE',
    });

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) {
        return { data: { user: { id: hostUser.id, email: hostUser.email, user_metadata: { name: 'Host' } } }, error: null };
      }
      if (token === coordinatorToken) {
        return { data: { user: { id: coordinatorUser.id, email: coordinatorUser.email, user_metadata: { name: 'Coordinator' } } }, error: null };
      }
      if (token === volunteerToken) {
        return { data: { user: { id: volunteerUser.id, email: volunteerUser.email, user_metadata: { name: 'Volunteer' } } }, error: null };
      }
      if (token === unassignedToken) {
        return { data: { user: { id: unassignedVolunteer.id, email: unassignedVolunteer.email, user_metadata: { name: 'Unassigned' } } }, error: null };
      }
      if (token === outsiderToken) {
        return { data: { user: { id: outsiderUser.id, email: outsiderUser.email, user_metadata: { name: 'Outsider' } } }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, name: 'Coordinator', email: coordinatorUser.email, role: 'USER' };
      if (id === volunteerUser.id) return { id: volunteerUser.id, name: 'Volunteer', email: volunteerUser.email, role: 'USER' };
      if (id === unassignedVolunteer.id) return { id: unassignedVolunteer.id, name: 'Unassigned', email: unassignedVolunteer.email, role: 'USER' };
      if (id === outsiderUser.id) return { id: outsiderUser.id, name: 'Outsider', email: outsiderUser.email, role: 'USER' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) {
        return { _id: hostMongoId, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === coordinatorUser.id) {
        return { _id: coordinatorMongoId, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === volunteerUser.id) {
        return { _id: volunteerMongoId, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === unassignedVolunteer.id) {
        return { _id: unassignedMongoId, supabaseUserId: unassignedVolunteer.id, email: unassignedVolunteer.email, name: 'Unassigned', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === outsiderUser.id) {
        return { _id: outsiderMongoId, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider', platformRole: 'USER', status: 'ACTIVE' };
      }
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id || id === hostMongoId.toString()) {
        return { _id: hostMongoId, id: hostUser.id, supabaseUserId: hostUser.id, email: hostUser.email, name: 'Host', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === coordinatorUser.id || id === coordinatorMongoId.toString()) {
        return { _id: coordinatorMongoId, id: coordinatorUser.id, supabaseUserId: coordinatorUser.id, email: coordinatorUser.email, name: 'Coordinator', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === volunteerUser.id || id === volunteerMongoId.toString()) {
        return { _id: volunteerMongoId, id: volunteerUser.id, supabaseUserId: volunteerUser.id, email: volunteerUser.email, name: 'Volunteer', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === unassignedVolunteer.id || id === unassignedMongoId.toString()) {
        return { _id: unassignedMongoId, id: unassignedVolunteer.id, supabaseUserId: unassignedVolunteer.id, email: unassignedVolunteer.email, name: 'Unassigned', platformRole: 'USER', status: 'ACTIVE' };
      }
      if (id === outsiderUser.id || id === outsiderMongoId.toString()) {
        return { _id: outsiderMongoId, id: outsiderUser.id, supabaseUserId: outsiderUser.id, email: outsiderUser.email, name: 'Outsider', platformRole: 'USER', status: 'ACTIVE' };
      }
      return null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
    });

    // Mock Member repo
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

    jest.spyOn(mongoEventMemberRepository, 'updateMember').mockImplementation(
      async (id: any, updates: any): Promise<any> => {
        const member = mockMembers.get(id.toString());
        if (!member) return null;
        const updated = { ...member, ...updates, updatedAt: new Date() };
        mockMembers.set(id.toString(), updated);
        return updated;
      }
    );

    // Mock Task repo
    jest.spyOn(mongoEventTaskRepository, 'createTask').mockImplementation(async (doc: any): Promise<any> => {
      const taskId = new mongoose.Types.ObjectId();
      const created = {
        _id: taskId,
        ...doc,
        assignedMemberIds: (doc.assignedMemberIds || []).map((id: any) => new mongoose.Types.ObjectId(id)),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTasks.set(taskId.toString(), created);
      return created;
    });

    jest.spyOn(mongoEventTaskRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockTasks.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventTaskRepository, 'findByIdAndEvent').mockImplementation(
      async (taskId: any, eventId: any): Promise<any> => {
        const task = mockTasks.get(taskId.toString());
        if (task && task.eventId.toString() === eventId.toString()) {
          return task;
        }
        return null;
      }
    );

    jest.spyOn(mongoEventTaskRepository, 'listTasks').mockImplementation(
      async (eventId: any, filters?: any): Promise<any> => {
        const list: any[] = [];
        for (const t of mockTasks.values()) {
          if (t.eventId.toString() === eventId.toString()) {
            if (filters?.status && t.status !== filters.status) continue;
            if (filters?.station && t.station !== filters.station) continue;
            if (filters?.category && t.category !== filters.category) continue;
            list.push(t);
          }
        }
        return list;
      }
    );

    jest.spyOn(mongoEventTaskRepository, 'findTasksForMember').mockImplementation(
      async (eventId: any, memberId: any): Promise<any> => {
        const list: any[] = [];
        for (const t of mockTasks.values()) {
          if (t.eventId.toString() === eventId.toString()) {
            const hasMember = t.assignedMemberIds.some(
              (id: any) => id.toString() === memberId.toString()
            );
            if (hasMember) list.push(t);
          }
        }
        return list;
      }
    );

    jest.spyOn(mongoEventTaskRepository, 'updateTask').mockImplementation(
      async (taskId: any, updates: any): Promise<any> => {
        const task = mockTasks.get(taskId.toString());
        if (!task) return null;
        const updated = { ...task, ...updates, updatedAt: new Date() };
        mockTasks.set(taskId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventTaskRepository, 'deleteTask').mockImplementation(
      async (taskId: any): Promise<any> => {
        return mockTasks.delete(taskId.toString());
      }
    );
  });

  describe('1. Task & Shift Creation', () => {
    it('allows event owner to create an operational task with volunteer assignments', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Main Entrance Ticket Scanner Desk',
          description: 'Scan all attendee QR codes and distribute badges.',
          category: 'REGISTRATION',
          station: 'Gate 1',
          priority: 'HIGH',
          requiresScanning: true,
          assignedMemberIds: [volunteerMemberId.toString()],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Main Entrance Ticket Scanner Desk');
      expect(res.body.data.station).toBe('Gate 1');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.requiresScanning).toBe(true);
    });

    it('allows Coordinator to create an operational station shift', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          title: 'Swag Bag Distribution',
          category: 'LOGISTICS',
          station: 'Counter B',
          priority: 'MEDIUM',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.station).toBe('Counter B');
    });

    it('rejects task creation from regular volunteers', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({
          title: 'Unauthorized Task',
          station: 'Gate 2',
        });

      expect(res.status).toBe(403);
    });

    it('rejects task creation with missing required fields', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Only Title Without Station',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('station / zone is required');
    });
  });

  describe('2. Task Listing & Volunteer Personal Console', () => {
    let createdTaskId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'VIP Gate Check-in',
          category: 'REGISTRATION',
          station: 'VIP North Gate',
          priority: 'HIGH',
          requiresScanning: true,
          assignedMemberIds: [volunteerMemberId.toString()],
        });
      createdTaskId = res.body.data._id.toString();
    });

    it('allows Host to list all tasks with station filter', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/tasks?station=VIP North Gate`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].station).toBe('VIP North Gate');
    });

    it('allows assigned volunteer to view their tasks via my-tasks endpoint', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/tasks/my-tasks`)
        .set('Authorization', `Bearer ${volunteerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(1);
      expect(res.body.data.tasks[0]._id.toString()).toBe(createdTaskId);
      expect(res.body.data.member._id.toString()).toBe(volunteerMemberId.toString());
    });

    it('returns empty tasks for unassigned volunteer', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/tasks/my-tasks`)
        .set('Authorization', `Bearer ${unassignedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tasks.length).toBe(0);
    });

    it('denies outsider from viewing event tasks', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Task Status Progression & Volunteer Action', () => {
    let taskId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Main Hall Directional Assistance',
          category: 'HOSPITALITY',
          station: 'Atrium',
          priority: 'LOW',
          assignedMemberIds: [volunteerMemberId.toString()],
        });
      taskId = res.body.data._id.toString();
    });

    it('allows assigned volunteer to transition status to IN_PROGRESS and COMPLETED', async () => {
      // Step 1: In Progress
      const resInProgress = await request(app)
        .patch(`/api/events/${testEventId.toString()}/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(resInProgress.status).toBe(200);
      expect(resInProgress.body.data.status).toBe('IN_PROGRESS');

      // Step 2: Completed
      const resCompleted = await request(app)
        .patch(`/api/events/${testEventId.toString()}/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${volunteerToken}`)
        .send({ status: 'COMPLETED' });

      expect(resCompleted.status).toBe(200);
      expect(resCompleted.body.data.status).toBe('COMPLETED');
    });

    it('rejects status transition from unassigned volunteer', async () => {
      const res = await request(app)
        .patch(`/api/events/${testEventId.toString()}/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${unassignedToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('not assigned to this task');
    });
  });

  describe('4. Dynamic Scanner Delegation & Task Lifecycle', () => {
    let taskId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          title: 'Admissions Scanner Gate 3',
          station: 'Gate 3',
          category: 'REGISTRATION',
          requiresScanning: true,
          assignedMemberIds: [volunteerMemberId.toString()],
        });
      taskId = res.body.data._id.toString();
    });

    it('allows Coordinator to dynamically grant ticket scanning permission to volunteer', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks/members/${volunteerMemberId.toString()}/scanner`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Granted ticket scanning');

      const updatedMember = mockMembers.get(volunteerMemberId.toString());
      expect(updatedMember.permissions).toContain('SCAN_CREDENTIALS');
    });

    it('allows Coordinator to dynamically revoke ticket scanning permission', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId.toString()}/tasks/members/${volunteerMemberId.toString()}/scanner`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Revoked ticket scanning');

      const updatedMember = mockMembers.get(volunteerMemberId.toString());
      expect(updatedMember.permissions).not.toContain('SCAN_CREDENTIALS');
    });

    it('allows Host to update task details and delete task', async () => {
      const resUpdate = await request(app)
        .put(`/api/events/${testEventId.toString()}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Updated Gate 3 Admissions Desk',
          priority: 'CRITICAL',
        });

      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.data.title).toBe('Updated Gate 3 Admissions Desk');
      expect(resUpdate.body.data.priority).toBe('CRITICAL');

      const resDelete = await request(app)
        .delete(`/api/events/${testEventId.toString()}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(resDelete.status).toBe(200);
      expect(resDelete.body.message).toContain('deleted');
    });
  });
});
