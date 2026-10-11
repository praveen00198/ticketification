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
import { mongoEventRubricRepository } from '../src/modules/events/repositories/mongo-event-rubric.repository';
import { mongoEventEvaluationRepository } from '../src/modules/events/repositories/mongo-event-evaluation.repository';

describe('Phase 11: Evaluation & Scoring Engine Architecture', () => {
  const hostUser = { id: 'mock-host-uuid-phase11', email: 'host.phase11@hackathon.org' };
  const judge1User = { id: 'mock-judge1-uuid-phase11', email: 'judge1.phase11@judges.org' };
  const judge2User = { id: 'mock-judge2-uuid-phase11', email: 'judge2.phase11@judges.org' };
  const hackerUser = { id: 'mock-hacker-uuid-phase11', email: 'hacker.phase11@teamalpha.io' };

  const hostToken = 'valid-host-token-phase11';
  const judge1Token = 'valid-judge1-token-phase11';
  const judge2Token = 'valid-judge2-token-phase11';
  const hackerToken = 'valid-hacker-token-phase11';

  const hostMongoId = new mongoose.Types.ObjectId();
  const judge1MongoId = new mongoose.Types.ObjectId();
  const judge2MongoId = new mongoose.Types.ObjectId();
  const hackerMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const judge1MemberId = new mongoose.Types.ObjectId();
  const judge2MemberId = new mongoose.Types.ObjectId();
  const team1Id = new mongoose.Types.ObjectId();
  const team2Id = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockTeams: Map<string, any>;
  let mockRubrics: Map<string, any>;
  let mockEvaluations: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockTeams = new Map();
    mockRubrics = new Map();
    mockEvaluations = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Hackathon Grand Finale 2026',
      eventType: 'HACKATHON',
      credentialTerminology: 'Hacker Pass',
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockMembers.set(judge1MemberId.toString(), {
      _id: judge1MemberId,
      eventId: testEventId,
      userId: judge1MongoId,
      userEmail: judge1User.email,
      role: 'EVALUATOR',
      permissions: ['SCORE_ASSIGNED_TEAMS'],
      status: 'ACTIVE',
    });

    mockMembers.set(judge2MemberId.toString(), {
      _id: judge2MemberId,
      eventId: testEventId,
      userId: judge2MongoId,
      userEmail: judge2User.email,
      role: 'EVALUATOR',
      permissions: ['SCORE_ASSIGNED_TEAMS'],
      status: 'ACTIVE',
    });

    mockTeams.set(team1Id.toString(), {
      _id: team1Id,
      eventId: testEventId,
      teamName: 'Neural Flow',
      track: 'AI/ML',
      leaderName: 'Alice',
      leaderEmail: hackerUser.email,
      status: 'SUBMITTED',
      projectTitle: 'Realtime Neural Graph',
    });

    mockTeams.set(team2Id.toString(), {
      _id: team2Id,
      eventId: testEventId,
      teamName: 'Zero Knowledge Vault',
      track: 'Security',
      leaderName: 'Bob',
      leaderEmail: 'bob@zkp.io',
      status: 'SUBMITTED',
      projectTitle: 'Private State Channels',
    });

    mockGetUser.mockReset();
    mockGetUser.mockImplementation(async (token?: string): Promise<any> => {
      if (token === hostToken) return { data: { user: { id: hostUser.id, email: hostUser.email } }, error: null };
      if (token === judge1Token) return { data: { user: { id: judge1User.id, email: judge1User.email } }, error: null };
      if (token === judge2Token) return { data: { user: { id: judge2User.id, email: judge2User.email } }, error: null };
      if (token === hackerToken) return { data: { user: { id: hackerUser.id, email: hackerUser.email } }, error: null };
      return { data: { user: null }, error: { message: 'Invalid JWT' } };
    });

    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { id: hostUser.id, name: 'Host', email: hostUser.email, role: 'USER' };
      if (id === judge1User.id) return { id: judge1User.id, name: 'Judge 1', email: judge1User.email, role: 'USER' };
      if (id === judge2User.id) return { id: judge2User.id, name: 'Judge 2', email: judge2User.email, role: 'USER' };
      if (id === hackerUser.id) return { id: hackerUser.id, name: 'Hacker', email: hackerUser.email, role: 'USER' };
      return null;
    });

    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (id: string): Promise<any> => {
      if (id === hostUser.id) return { _id: hostMongoId, email: hostUser.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === judge1User.id) return { _id: judge1MongoId, email: judge1User.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === judge2User.id) return { _id: judge2MongoId, email: judge2User.email, platformRole: 'USER', status: 'ACTIVE' };
      if (id === hackerUser.id) return { _id: hackerMongoId, email: hackerUser.email, platformRole: 'USER', status: 'ACTIVE' };
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

    jest.spyOn(mongoEventTeamRepository, 'findByIdAndEvent').mockImplementation(
      async (id: any, eventId: any): Promise<any> => {
        const t = mockTeams.get(id.toString());
        if (t && t.eventId.toString() === eventId.toString()) return t;
        return null;
      }
    );

    // Mock Rubric Repository
    jest.spyOn(mongoEventRubricRepository, 'createRubric').mockImplementation(async (doc: any): Promise<any> => {
      const rubricId = new mongoose.Types.ObjectId();
      const created = {
        _id: rubricId,
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRubrics.set(rubricId.toString(), created);
      return created;
    });

    jest.spyOn(mongoEventRubricRepository, 'findByIdAndEvent').mockImplementation(
      async (id: any, eventId: any): Promise<any> => {
        const r = mockRubrics.get(id.toString());
        if (r && r.eventId.toString() === eventId.toString()) return r;
        return null;
      }
    );

    jest.spyOn(mongoEventRubricRepository, 'findByEvent').mockImplementation(
      async (eventId: any, track?: string): Promise<any> => {
        const results: any[] = [];
        for (const r of mockRubrics.values()) {
          if (r.eventId.toString() !== eventId.toString()) continue;
          if (track && track !== 'ALL' && r.track !== track) continue;
          results.push(r);
        }
        return results;
      }
    );

    jest.spyOn(mongoEventRubricRepository, 'updateRubric').mockImplementation(
      async (id: any, eventId: any, data: any): Promise<any> => {
        const existing = mockRubrics.get(id.toString());
        if (!existing || existing.eventId.toString() !== eventId.toString()) return null;
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockRubrics.set(id.toString(), updated);
        return updated;
      }
    );

    // Mock Evaluation Repository
    jest.spyOn(mongoEventEvaluationRepository, 'submitEvaluation').mockImplementation(
      async (doc: any): Promise<any> => {
        const key = `${doc.eventId}_${doc.teamId}_${doc.evaluatorMemberId}`;
        const evalId = new mongoose.Types.ObjectId();
        const created = {
          _id: evalId,
          ...doc,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockEvaluations.set(key, created);
        return created;
      }
    );

    jest.spyOn(mongoEventEvaluationRepository, 'findByEventAndTeamAndEvaluator').mockImplementation(
      async (eventId: any, teamId: any, evaluatorMemberId: any): Promise<any> => {
        const key = `${eventId}_${teamId}_${evaluatorMemberId}`;
        return mockEvaluations.get(key) || null;
      }
    );

    jest.spyOn(mongoEventEvaluationRepository, 'findByEvent').mockImplementation(
      async (eventId: any, filters?: any): Promise<any> => {
        const results: any[] = [];
        for (const ev of mockEvaluations.values()) {
          if (ev.eventId.toString() !== eventId.toString()) continue;
          if (filters?.teamId && ev.teamId.toString() !== filters.teamId.toString()) continue;
          if (filters?.evaluatorMemberId && ev.evaluatorMemberId.toString() !== filters.evaluatorMemberId.toString()) continue;
          results.push(ev);
        }
        return results;
      }
    );

    jest.spyOn(mongoEventEvaluationRepository, 'aggregateLeaderboard').mockImplementation(
      async (eventId: any, track?: string): Promise<any[]> => {
        const teamScoreMap = new Map<string, { total: number; count: number }>();
        for (const ev of mockEvaluations.values()) {
          if (ev.eventId.toString() !== eventId.toString()) continue;
          const tId = ev.teamId.toString();
          const prev = teamScoreMap.get(tId) || { total: 0, count: 0 };
          teamScoreMap.set(tId, { total: prev.total + ev.weightedTotal, count: prev.count + 1 });
        }

        const entries: any[] = [];
        for (const [tId, stats] of teamScoreMap.entries()) {
          const t = mockTeams.get(tId);
          if (!t) continue;
          if (track && track !== 'ALL' && t.track !== track) continue;
          entries.push({
            teamId: tId,
            teamName: t.teamName,
            track: t.track,
            tableNumber: t.tableNumber,
            averageScore: Math.round((stats.total / stats.count) * 100) / 100,
            evaluationCount: stats.count,
          });
        }
        return entries.sort((a, b) => b.averageScore - a.averageScore);
      }
    );
  });

  describe('1. Rubric Configuration & Criteria Management', () => {
    it('allows an event host to create a weighted judging rubric', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Final Championship Rubric',
          track: 'AI/ML',
          criteria: [
            { key: 'innovation', label: 'Innovation', maxScore: 10, weight: 40 },
            { key: 'tech_execution', label: 'Technical Execution', maxScore: 10, weight: 60 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Final Championship Rubric');
      expect(res.body.data.scoringStatus).toBe('OPEN');
      expect(res.body.data.criteria).toHaveLength(2);
    });

    it('denies rubric creation to unauthorized non-organizers', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/rubrics`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          title: 'Rogue Rubric',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Scorecard Submission & Weighted Score Calculation', () => {
    let rubricId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Final Scoring Matrix',
          criteria: [
            { key: 'innovation', label: 'Innovation', maxScore: 10, weight: 40 },
            { key: 'tech_execution', label: 'Technical Execution', maxScore: 10, weight: 60 },
          ],
        });
      rubricId = res.body.data._id;
    });

    it('allows an evaluator to submit a scorecard and correctly calculates weighted score', async () => {
      // Score: 8/10 on Innovation (40% weight -> 32 pts) + 9/10 on Technical Execution (60% weight -> 54 pts) = 86 pts
      const res = await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          rubricId,
          teamId: team1Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 8, feedback: 'Great concept' },
            { criteriaKey: 'tech_execution', score: 9, feedback: 'Flawless demo' },
          ],
          generalFeedback: 'Exceptional prototype overall',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weightedTotal).toBe(86);
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('rejects scores exceeding maxScore', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          rubricId,
          teamId: team1Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 15 }, // Max is 10
            { criteriaKey: 'tech_execution', score: 8 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/must be between 0 and 10/i);
    });

    it('rejects scorecard submission when rubric is CLOSED', async () => {
      // Close scoring
      await request(app)
        .patch(`/api/events/${testEventId}/rubrics/${rubricId}/status`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'CLOSED' });

      // Attempt submit
      const res = await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          rubricId,
          teamId: team1Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 8 },
            { criteriaKey: 'tech_execution', score: 8 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/scoring is closed/i);
    });
  });

  describe('3. Blind Review Isolation & Leaderboard Controls', () => {
    let rubricId: string;

    beforeEach(async () => {
      const rRes = await request(app)
        .post(`/api/events/${testEventId}/rubrics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Blind Matrix',
          criteria: [
            { key: 'innovation', label: 'Innovation', maxScore: 10, weight: 50 },
            { key: 'tech_execution', label: 'Technical Execution', maxScore: 10, weight: 50 },
          ],
        });
      rubricId = rRes.body.data._id;

      // Judge 1 scores Team 1 (90 pts)
      await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          rubricId,
          teamId: team1Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 9 },
            { criteriaKey: 'tech_execution', score: 9 },
          ],
        });

      // Judge 2 scores Team 1 (80 pts)
      await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge2Token}`)
        .send({
          rubricId,
          teamId: team1Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 8 },
            { criteriaKey: 'tech_execution', score: 8 },
          ],
        });

      // Judge 1 scores Team 2 (70 pts)
      await request(app)
        .post(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`)
        .send({
          rubricId,
          teamId: team2Id.toString(),
          scores: [
            { criteriaKey: 'innovation', score: 7 },
            { criteriaKey: 'tech_execution', score: 7 },
          ],
        });
    });

    it('enforces blind review: Judge 1 can only see their own scorecard, not Judge 2', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/evaluations`)
        .set('Authorization', `Bearer ${judge1Token}`);

      expect(res.status).toBe(200);
      // Judge 1 evaluated 2 teams (Team 1 and Team 2)
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((e: any) => e.evaluatorMemberId.toString() === judge1MemberId.toString())).toBe(true);
    });

    it('denies leaderboard access to participants while scoring is unfinalized', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/evaluations/leaderboard`)
        .set('Authorization', `Bearer ${hackerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/blind review in effect/i);
    });

    it('allows host to view live aggregate leaderboard anytime', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/evaluations/leaderboard`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      // Team 1 average score: (90 + 80) / 2 = 85
      expect(res.body.data[0].teamName).toBe('Neural Flow');
      expect(res.body.data[0].averageScore).toBe(85);
      expect(res.body.data[0].evaluationCount).toBe(2);
    });

    it('unlocks leaderboard for participants once host sets status to FINALIZED', async () => {
      // Finalize scoring
      await request(app)
        .patch(`/api/events/${testEventId}/rubrics/${rubricId}/status`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ status: 'FINALIZED' });

      // Participant can now view leaderboard
      const res = await request(app)
        .get(`/api/events/${testEventId}/evaluations/leaderboard`)
        .set('Authorization', `Bearer ${hackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].teamName).toBe('Neural Flow');
      expect(res.body.data[0].averageScore).toBe(85);
    });
  });
});
