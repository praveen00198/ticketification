import mongoose from 'mongoose';
import {
  EventEvaluationModel,
  IEventEvaluationDocument,
  ICriterionScore,
  EvaluationStatus,
} from '../../../db/mongo/models/event-evaluation.model';

export interface SubmitEvaluationInput {
  eventId: mongoose.Types.ObjectId | string;
  rubricId: mongoose.Types.ObjectId | string;
  teamId: mongoose.Types.ObjectId | string;
  evaluatorMemberId: mongoose.Types.ObjectId | string;
  evaluatorEmail: string;
  evaluatorName: string;
  scores: ICriterionScore[];
  weightedTotal: number;
  generalFeedback?: string;
  status?: EvaluationStatus;
}

export interface EvaluationFilterOptions {
  rubricId?: mongoose.Types.ObjectId | string;
  teamId?: mongoose.Types.ObjectId | string;
  evaluatorMemberId?: mongoose.Types.ObjectId | string;
}

export interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  track?: string;
  tableNumber?: string;
  averageScore: number;
  evaluationCount: number;
  evaluations: Array<{
    evaluatorMemberId: string;
    evaluatorName: string;
    weightedTotal: number;
    submittedAt: Date;
  }>;
}

export class MongoEventEvaluationRepository {
  async submitEvaluation(data: SubmitEvaluationInput): Promise<IEventEvaluationDocument> {
    const filter = {
      eventId: new mongoose.Types.ObjectId(data.eventId),
      teamId: new mongoose.Types.ObjectId(data.teamId),
      evaluatorMemberId: new mongoose.Types.ObjectId(data.evaluatorMemberId),
    };

    const update = {
      $set: {
        rubricId: new mongoose.Types.ObjectId(data.rubricId),
        evaluatorEmail: data.evaluatorEmail.toLowerCase().trim(),
        evaluatorName: data.evaluatorName.trim(),
        scores: data.scores,
        weightedTotal: data.weightedTotal,
        generalFeedback: data.generalFeedback?.trim(),
        status: data.status || 'SUBMITTED',
        submittedAt: new Date(),
      },
    };

    return (await EventEvaluationModel.findOneAndUpdate(filter, update, {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    }).exec()) as IEventEvaluationDocument;
  }

  async findByEventAndTeamAndEvaluator(
    eventId: mongoose.Types.ObjectId | string,
    teamId: mongoose.Types.ObjectId | string,
    evaluatorMemberId: mongoose.Types.ObjectId | string
  ): Promise<IEventEvaluationDocument | null> {
    if (
      !mongoose.Types.ObjectId.isValid(eventId) ||
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(evaluatorMemberId)
    ) {
      return null;
    }

    return await EventEvaluationModel.findOne({
      eventId: new mongoose.Types.ObjectId(eventId),
      teamId: new mongoose.Types.ObjectId(teamId),
      evaluatorMemberId: new mongoose.Types.ObjectId(evaluatorMemberId),
    }).exec();
  }

  async findByEvent(
    eventId: mongoose.Types.ObjectId | string,
    filters?: EvaluationFilterOptions
  ): Promise<IEventEvaluationDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const query: any = { eventId: new mongoose.Types.ObjectId(eventId) };

    if (filters?.rubricId && mongoose.Types.ObjectId.isValid(filters.rubricId)) {
      query.rubricId = new mongoose.Types.ObjectId(filters.rubricId);
    }

    if (filters?.teamId && mongoose.Types.ObjectId.isValid(filters.teamId)) {
      query.teamId = new mongoose.Types.ObjectId(filters.teamId);
    }

    if (filters?.evaluatorMemberId && mongoose.Types.ObjectId.isValid(filters.evaluatorMemberId)) {
      query.evaluatorMemberId = new mongoose.Types.ObjectId(filters.evaluatorMemberId);
    }

    return await EventEvaluationModel.find(query)
      .populate('teamId', 'teamName track tableNumber status projectTitle')
      .populate('rubricId', 'title scoringStatus')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async aggregateLeaderboard(
    eventId: mongoose.Types.ObjectId | string,
    track?: string
  ): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) return [];

    const matchStage: any = {
      eventId: new mongoose.Types.ObjectId(eventId),
      status: 'SUBMITTED',
    };

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $group: {
          _id: '$teamId',
          averageScore: { $avg: '$weightedTotal' },
          evaluationCount: { $sum: 1 },
          evaluations: {
            $push: {
              evaluatorMemberId: '$evaluatorMemberId',
              evaluatorName: '$evaluatorName',
              weightedTotal: '$weightedTotal',
              submittedAt: '$submittedAt',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'event_teams',
          localField: '_id',
          foreignField: '_id',
          as: 'team',
        },
      },
      { $unwind: '$team' },
    ];

    if (track && track !== 'ALL') {
      pipeline.push({
        $match: { 'team.track': track },
      });
    }

    pipeline.push(
      {
        $project: {
          teamId: '$_id',
          teamName: '$team.teamName',
          track: '$team.track',
          tableNumber: '$team.tableNumber',
          projectTitle: '$team.projectTitle',
          repoUrl: '$team.repoUrl',
          demoUrl: '$team.demoUrl',
          averageScore: { $round: ['$averageScore', 2] },
          evaluationCount: 1,
          evaluations: 1,
        },
      },
      { $sort: { averageScore: -1, evaluationCount: -1 } }
    );

    return await EventEvaluationModel.aggregate(pipeline).exec();
  }

  async deleteEvaluation(
    evaluationId: mongoose.Types.ObjectId | string,
    eventId: mongoose.Types.ObjectId | string
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(evaluationId) || !mongoose.Types.ObjectId.isValid(eventId)) {
      return false;
    }

    const result = await EventEvaluationModel.deleteOne({
      _id: new mongoose.Types.ObjectId(evaluationId),
      eventId: new mongoose.Types.ObjectId(eventId),
    }).exec();

    return result.deletedCount > 0;
  }
}

export const mongoEventEvaluationRepository = new MongoEventEvaluationRepository();
