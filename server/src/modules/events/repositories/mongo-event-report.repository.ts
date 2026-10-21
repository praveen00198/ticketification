import mongoose from 'mongoose';
import {
  EventReportModel,
  IEventReport,
  IEventReportDocument,
} from '../../../db/mongo/models/event-report.model';

export class MongoEventReportRepository {
  constructor(private model: typeof EventReportModel = EventReportModel) {}

  /**
   * Create an event abuse/scam report.
   */
  async create(data: Partial<IEventReport>): Promise<IEventReportDocument> {
    return await this.model.create(data);
  }

  /**
   * Find all reports for a specific event.
   */
  async findByEventId(eventId: string): Promise<IEventReportDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return [];
    }
    return await this.model
      .find({ eventId: new mongoose.Types.ObjectId(eventId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Find a report by its ID.
   */
  async findById(id: string): Promise<IEventReportDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await this.model.findById(id).exec();
  }

  /**
   * Update report status and resolution notes (admin only).
   */
  async updateStatus(
    id: string,
    status: string,
    actionTaken?: string
  ): Promise<IEventReportDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status,
            ...(actionTaken ? { actionTaken } : {}),
          },
        },
        { returnDocument: 'after', runValidators: true }
      )
      .exec();
  }

  /**
   * Find reports strictly submitted by a specific authenticated user.
   * Excludes unauthenticated / anonymous submissions to prevent cross-account leakage.
   */
  async findByReporterUserId(reporterUserId: string): Promise<IEventReportDocument[]> {
    if (!reporterUserId) return [];
    const orConditions: any[] = [{ reporterUserId }];
    if (mongoose.Types.ObjectId.isValid(reporterUserId)) {
      orConditions.push({ reporterUserId: new mongoose.Types.ObjectId(reporterUserId) });
    }
    return await this.model
      .find({ $or: orConditions })
      .populate('eventId', 'name slug date venue')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Find reports submitted by a specific user or email.
   */
  async findByReporter(reporterUserId?: string, reporterEmail?: string): Promise<IEventReportDocument[]> {
    const orConditions: any[] = [];
    if (reporterUserId) {
      orConditions.push({ reporterUserId });
      if (mongoose.Types.ObjectId.isValid(reporterUserId)) {
        orConditions.push({ reporterUserId: new mongoose.Types.ObjectId(reporterUserId) });
      }
    }
    if (reporterEmail) {
      orConditions.push({ reporterEmail: reporterEmail.toLowerCase().trim() });
    }
    if (orConditions.length === 0) return [];
    return await this.model
      .find({ $or: orConditions })
      .populate('eventId', 'name slug date venue')
      .sort({ createdAt: -1 })
      .exec();
  }
}

export const mongoEventReportRepository = new MongoEventReportRepository();
export default mongoEventReportRepository;
