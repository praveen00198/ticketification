import mongoose from 'mongoose';
import {
  EventMemberModel,
  IEventMember,
  IEventMemberDocument,
} from '../../../db/mongo/models/event-member.model';

export class MongoEventMemberRepository {
  constructor(private model: typeof EventMemberModel = EventMemberModel) {}

  /**
   * Create an event membership or invitation document.
   */
  async createMember(data: Partial<IEventMember>): Promise<IEventMemberDocument> {
    return await this.model.create(data);
  }

  /**
   * Find a membership by event ID and user email.
   */
  async findByEventAndEmail(
    eventId: string | mongoose.Types.ObjectId,
    userEmail: string
  ): Promise<IEventMemberDocument | null> {
    return await this.model
      .findOne({
        eventId,
        userEmail: userEmail.toLowerCase().trim(),
      })
      .exec();
  }

  /**
   * Find an active membership by event ID and user ID.
   */
  async findByEventAndUser(
    eventId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<IEventMemberDocument | null> {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }
    return await this.model
      .findOne({
        eventId,
        userId,
        status: 'ACTIVE',
      })
      .exec();
  }

  /**
   * Find membership by secret invitation token (includes token field in projection).
   */
  async findByInvitationToken(token: string): Promise<IEventMemberDocument | null> {
    return await this.model
      .findOne({
        invitationToken: token,
        status: 'INVITED',
      })
      .select('+invitationToken')
      .exec();
  }

  /**
   * Find membership by its MongoDB ID.
   */
  async findById(memberId: string | mongoose.Types.ObjectId): Promise<IEventMemberDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(memberId)) return null;
    return await this.model.findById(memberId).exec();
  }

  /**
   * List all members for an event with user details populated.
   */
  async listEventMembers(
    eventId: string | mongoose.Types.ObjectId,
    status?: string
  ): Promise<IEventMemberDocument[]> {
    const query: Record<string, any> = { eventId };
    if (status) {
      query.status = status;
    }

    return await this.model
      .find(query)
      .populate('userId', 'name email avatarUrl hostProfile')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Update an existing member record.
   */
  async updateMember(
    memberId: string | mongoose.Types.ObjectId,
    updates: Partial<IEventMember>
  ): Promise<IEventMemberDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(memberId)) return null;

    return await this.model
      .findByIdAndUpdate(memberId, { $set: updates }, { returnDocument: 'after', runValidators: true })
      .exec();
  }

  /**
   * Remove a membership.
   */
  async deleteMember(memberId: string | mongoose.Types.ObjectId): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(memberId)) return false;

    const result = await this.model.findByIdAndDelete(memberId).exec();
    return !!result;
  }
}

export const mongoEventMemberRepository = new MongoEventMemberRepository();
export default mongoEventMemberRepository;
