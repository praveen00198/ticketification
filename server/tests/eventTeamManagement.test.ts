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
import { mongoEventTeamRepository } from '../src/modules/events/repositories/mongo-event-team.repository';

describe('Phase 10: Event Team Management Architecture', () => {
  const hostUser = { id: 'mock-host-uuid-phase10', email: 'host.phase10@hackathon.org' };
  const coordinatorUser = { id: 'mock-coord-uuid-phase10', email: 'coord.phase10@hackathon.org' };
  const leaderUser = { id: 'mock-leader-uuid-phase10', email: 'lead.phase10@teamalpha.io' };
  const outsiderUser = { id: 'mock-out-uuid-phase10', email: 'outsider.phase10@external.com' };

  const hostToken = 'valid-host-token-phase10';
  const coordinatorToken = 'valid-coord-token-phase10';
  const leaderToken = 'valid-leader-token-phase10';
  const outsiderToken = 'valid-out-token-phase10';

  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const leaderMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const otherEventId = new mongoose.Types.ObjectId();
  const coordinatorMemberId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockTeams: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockTeams = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Global AI Hackathon 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockMembers.set(coordinatorMemberId.toString(), {
      _id: coordinatorMemberId,
      eventId: testEventId,
      userId: coordinatorMongoId,
      userEmail: coordinatorUser.email,
      role: 'COORDINATOR',
      permissions: ['MANAGE_STAFF', 'MANAGE_EVENT_SETTINGS'],
      status: 'ACTIVE',
    });

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) return { data: { user: { id: hostUser.id, email: hostUser.email } }, error: null };
      if (token === coordinatorToken) return { data: { user: { id: coordinatorUser.id, email: coordinatorUser.email } }, error: null };
      if (token === leaderToken) return { data: { user: { id: leaderUser.id, email: leaderUser.email } }, error: null };
      if (token === outsiderToken) return { data: { user: { id: outsiderUser.id, email: outsiderUser.email } }, error: null };
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, name: 'Coordinator', email: coordinatorUser.email, role: 'USER' };
      if (id === leaderUser.id) return { id: leaderUser.id, name: 'Leader', email: leaderUser.email, role: 'USER' };
      if (id === outsiderUser.id) return { id: outsiderUser.id, name: 'Outsider', email: outsiderUser.email, role: 'USER' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { _id: hostMongoId, email: hostUser.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === coordinatorUser.id) return { _id: coordinatorMongoId, email: coordinatorUser.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === leaderUser.id) return { _id: leaderMongoId, email: leaderUser.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === outsiderUser.id) return { _id: outsiderMongoId, email: outsiderUser.email, platformRole: 'USER', status: 'ACTIVE' };
      return null;
    });

    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
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

    // Mock Team Repository
    jest.spyOn(mongoEventTeamRepository, 'createTeam').mockImplementation(async (doc: any): Promise<any> => {
      const teamId = new mongoose.Types.ObjectId();
      const created = {
        _id: teamId,
        ...doc,
        members: doc.members || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTeams.set(teamId.toString(), created);
      return created;
    });

    jest.spyOn(mongoEventTeamRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockTeams.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventTeamRepository, 'findByIdAndEvent').mockImplementation(
      async (id: any, eventId: any): Promise<any> => {
        const t = mockTeams.get(id.toString());
        if (t && t.eventId.toString() === eventId.toString()) return t;
        return null;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'findByEventAndName').mockImplementation(
      async (eventId: any, name: string): Promise<any> => {
        for (const t of mockTeams.values()) {
          if (t.eventId.toString() === eventId.toString() && t.teamName.toLowerCase() === name.trim().toLowerCase()) {
            return t;
          }
        }
        return null;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'findByEvent').mockImplementation(
      async (eventId: any, filters?: any): Promise<any> => {
        const results: any[] = [];
        for (const t of mockTeams.values()) {
          if (t.eventId.toString() !== eventId.toString()) continue;
          if (filters?.track && t.track !== filters.track) continue;
          if (filters?.status && t.status !== filters.status) continue;
          if (filters?.search && !t.teamName.toLowerCase().includes(filters.search.toLowerCase())) continue;
          results.push(t);
        }
        return results;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'updateTeam').mockImplementation(
      async (teamId: any, eventId: any, updateData: any): Promise<any> => {
        const existing = mockTeams.get(teamId.toString());
        if (!existing || existing.eventId.toString() !== eventId.toString()) return null;
        const updated = { ...existing, ...updateData, updatedAt: new Date() };
        mockTeams.set(teamId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'addMember').mockImplementation(
      async (teamId: any, eventId: any, member: any): Promise<any> => {
        const existing = mockTeams.get(teamId.toString());
        if (!existing || existing.eventId.toString() !== eventId.toString()) return null;
        const updatedMembers = [...existing.members, member];
        const updated = { ...existing, members: updatedMembers, updatedAt: new Date() };
        mockTeams.set(teamId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'removeMember').mockImplementation(
      async (teamId: any, eventId: any, email: string): Promise<any> => {
        const existing = mockTeams.get(teamId.toString());
        if (!existing || existing.eventId.toString() !== eventId.toString()) return null;
        const updatedMembers = existing.members.filter((m: any) => m.email.toLowerCase() !== email.toLowerCase());
        const updated = { ...existing, members: updatedMembers, updatedAt: new Date() };
        mockTeams.set(teamId.toString(), updated);
        return updated;
      }
    );

    jest.spyOn(mongoEventTeamRepository, 'deleteTeam').mockImplementation(
      async (teamId: any, eventId: any): Promise<any> => {
        const existing = mockTeams.get(teamId.toString());
        if (!existing || existing.eventId.toString() !== eventId.toString()) return false;
        mockTeams.delete(teamId.toString());
        return true;
      }
    );
  });

  describe('1. Team Registration Flow', () => {
    it('allows an event Host to register a new team with leader details', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Neural Innovators',
          track: 'AI/ML',
          tableNumber: 'Table A-12',
          leaderName: 'Alice Developer',
          leaderEmail: 'alice@neural.dev',
          projectTitle: 'Real-Time Edge Audio Summarizer',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.teamName).toBe('Neural Innovators');
      expect(res.body.data.track).toBe('AI/ML');
      expect(res.body.data.status).toBe('REGISTERED');
      expect(res.body.data.members).toHaveLength(1);
      expect(res.body.data.members[0].email).toBe('alice@neural.dev');
    });

    it('allows an event Coordinator to register a team', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          teamName: 'Quantum Coders',
          track: 'Quantum',
          leaderName: 'Bob Physicist',
          leaderEmail: 'bob@quantum.io',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.teamName).toBe('Quantum Coders');
    });

    it('rejects duplicate team names within the same event (409 Conflict)', async () => {
      // First registration
      await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Unique Team',
          leaderName: 'Charlie',
          leaderEmail: 'charlie@test.com',
        });

      // Second registration with same name
      const duplicateRes = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Unique Team',
          leaderName: 'David',
          leaderEmail: 'david@test.com',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.message).toMatch(/already exists/i);
    });

    it('denies team creation by an unauthorized outsider', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          teamName: 'Rogue Squad',
          leaderName: 'Eve',
          leaderEmail: 'eve@rogue.com',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Team Roster Management & Capacity Rules', () => {
    let createdTeamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Cyber Defense',
          track: 'Security',
          leaderName: 'Lead Hacker',
          leaderEmail: leaderUser.email,
        });
      createdTeamId = res.body.data._id;
    });

    it('allows team leader or host to add a new member to the roster', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams/${createdTeamId}/members`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          name: 'Dave Engineer',
          email: 'dave@teamalpha.io',
          role: 'Backend Dev',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.members).toHaveLength(2);
      expect(res.body.data.members[1].name).toBe('Dave Engineer');
    });

    it('rejects adding duplicate member email to the same team', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams/${createdTeamId}/members`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          name: 'Duplicate Lead',
          email: leaderUser.email,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already in this team/i);
    });

    it('rejects roster expansion past 6 members limit', async () => {
      // Add 5 more members (reaching 6)
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/events/${testEventId}/teams/${createdTeamId}/members`)
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            name: `Hacker ${i}`,
            email: `hacker${i}@teamalpha.io`,
          });
      }

      // Attempt 7th member
      const overflowRes = await request(app)
        .post(`/api/events/${testEventId}/teams/${createdTeamId}/members`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: '7th Member',
          email: 'hacker7@teamalpha.io',
        });

      expect(overflowRes.status).toBe(400);
      expect(overflowRes.body.error.message).toMatch(/maximum.*roster/i);
    });

    it('allows removing a member but prevents removing the team leader', async () => {
      // Add a member first
      await request(app)
        .post(`/api/events/${testEventId}/teams/${createdTeamId}/members`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          name: 'Temporary Guy',
          email: 'temp@teamalpha.io',
        });

      // Remove temporary member
      const removeRes = await request(app)
        .delete(`/api/events/${testEventId}/teams/${createdTeamId}/members/temp@teamalpha.io`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(removeRes.status).toBe(200);

      // Attempt removing leader
      const removeLeaderRes = await request(app)
        .delete(`/api/events/${testEventId}/teams/${createdTeamId}/members/${leaderUser.email}`)
        .set('Authorization', `Bearer ${leaderToken}`);

      expect(removeLeaderRes.status).toBe(400);
      expect(removeLeaderRes.body.error.message).toMatch(/cannot remove team leader/i);
    });
  });

  describe('3. Project Submission & Status Transitions', () => {
    let createdTeamId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Web3 Pioneers',
          track: 'Web3',
          leaderName: 'Satoshi Lead',
          leaderEmail: leaderUser.email,
        });
      createdTeamId = res.body.data._id;
    });

    it('allows team leader to update project submission and submit project', async () => {
      const updateRes = await request(app)
        .patch(`/api/events/${testEventId}/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({
          projectTitle: 'Decentralized Oracle Engine',
          projectDescription: 'Sub-second finality oracle infrastructure on EVM',
          repoUrl: 'https://github.com/web3-pioneers/oracle',
          demoUrl: 'https://oracle-demo.web3pioneers.io',
          status: 'SUBMITTED',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.projectTitle).toBe('Decentralized Oracle Engine');
      expect(updateRes.body.data.status).toBe('SUBMITTED');
      expect(updateRes.body.data.submittedAt).toBeDefined();
    });

    it('allows host to disqualify a team', async () => {
      const res = await request(app)
        .patch(`/api/events/${testEventId}/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          status: 'DISQUALIFIED',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DISQUALIFIED');
    });

    it('denies project edit by an outsider', async () => {
      const res = await request(app)
        .patch(`/api/events/${testEventId}/teams/${createdTeamId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({
          projectTitle: 'Hacked Title',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Team Queries & Deletion Security', () => {
    let team1Id: string;
    let team2Id: string;

    beforeEach(async () => {
      const t1 = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Alpha ML',
          track: 'AI/ML',
          leaderName: 'Lead 1',
          leaderEmail: 'lead1@alpha.com',
        });
      team1Id = t1.body.data._id;

      const t2 = await request(app)
        .post(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          teamName: 'Beta Health',
          track: 'HealthTech',
          leaderName: 'Lead 2',
          leaderEmail: 'lead2@beta.com',
        });
      team2Id = t2.body.data._id;
    });

    it('lists teams with track and search filtering', async () => {
      const allRes = await request(app)
        .get(`/api/events/${testEventId}/teams`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(allRes.status).toBe(200);
      expect(allRes.body.data).toHaveLength(2);

      const trackFiltered = await request(app)
        .get(`/api/events/${testEventId}/teams?track=AI/ML`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(trackFiltered.status).toBe(200);
      expect(trackFiltered.body.data).toHaveLength(1);
      expect(trackFiltered.body.data[0].teamName).toBe('Alpha ML');
    });

    it('allows host to delete team', async () => {
      const deleteRes = await request(app)
        .delete(`/api/events/${testEventId}/teams/${team1Id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });

    it('denies team deletion by non-coordinator outsider', async () => {
      const deleteRes = await request(app)
        .delete(`/api/events/${testEventId}/teams/${team2Id}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });
});

function duplicateResRegex(msg?: string) {
  return msg && /already in this team/i.test(msg) ? msg : undefined;
}
