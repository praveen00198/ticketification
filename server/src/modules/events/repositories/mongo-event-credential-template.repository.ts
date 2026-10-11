import mongoose from 'mongoose';
import {
  EventCredentialTemplateModel,
  IEventCredentialTemplateDocument,
  ITemplateField,
  TemplatePresetId,
} from '../../../db/mongo/models/event-credential-template.model';

export const GLOBAL_PRESET_DEFINITIONS: Array<{
  name: string;
  description: string;
  presetId: TemplatePresetId;
  dimensions: { width: number; height: number };
  fields: ITemplateField[];
}> = [
  {
    name: 'Modern Conference Badge',
    description: 'Portrait format attendee badge optimized for conferences, summits, and symposiums.',
    presetId: 'CONFERENCE_BADGE',
    dimensions: { width: 1620, height: 2025 },
    fields: [
      {
        key: 'eventName',
        label: 'Event Title',
        x: 810,
        y: 380,
        fontSize: 44,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#E2E8F0',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'date',
        label: 'Date & Time',
        x: 810,
        y: 460,
        fontSize: 30,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'normal',
        color: '#94A3B8',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'name',
        label: 'Attendee Full Name',
        x: 810,
        y: 840,
        fontSize: 64,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'role',
        label: 'Role Badge',
        x: 810,
        y: 940,
        fontSize: 36,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#10B981',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'qr',
        label: 'Verification QR Code',
        x: 620,
        y: 1100,
        width: 380,
        height: 380,
        visible: true,
      },
      {
        key: 'sequence',
        label: 'Sequence Number',
        x: 810,
        y: 1560,
        fontSize: 32,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#94A3B8',
        textAlign: 'center',
        visible: true,
      },
    ],
  },
  {
    name: 'Concert & Festival Ticket',
    description: 'High-visibility admission ticket with bold event branding and scanner code.',
    presetId: 'CONCERT_TICKET',
    dimensions: { width: 1620, height: 2025 },
    fields: [
      {
        key: 'eventName',
        label: 'Festival / Concert Name',
        x: 810,
        y: 360,
        fontSize: 50,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'date',
        label: 'Date & Venue',
        x: 810,
        y: 450,
        fontSize: 32,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'normal',
        color: '#E2E8F0',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'name',
        label: 'Guest Name',
        x: 810,
        y: 880,
        fontSize: 56,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'role',
        label: 'Admission Tier',
        x: 810,
        y: 970,
        fontSize: 34,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#F59E0B',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'qr',
        label: 'Gate Scan QR',
        x: 620,
        y: 1100,
        width: 380,
        height: 380,
        visible: true,
      },
      {
        key: 'sequence',
        label: 'Ticket Tag',
        x: 810,
        y: 1560,
        fontSize: 34,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#E2E8F0',
        textAlign: 'center',
        visible: true,
      },
    ],
  },
  {
    name: 'Hackathon Hacker Badge',
    description: 'Dynamic participant pass featuring hacker handle, challenge track, and quick verification.',
    presetId: 'HACKATHON_PASS',
    dimensions: { width: 1620, height: 2025 },
    fields: [
      {
        key: 'eventName',
        label: 'Hackathon Title',
        x: 810,
        y: 380,
        fontSize: 48,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'name',
        label: 'Hacker Name',
        x: 810,
        y: 820,
        fontSize: 64,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'role',
        label: 'Hacker Category',
        x: 810,
        y: 920,
        fontSize: 36,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#10B981',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'venue',
        label: 'Track & Table',
        x: 810,
        y: 1000,
        fontSize: 32,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'normal',
        color: '#38BDF8',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'qr',
        label: 'Check-in QR Code',
        x: 620,
        y: 1120,
        width: 380,
        height: 380,
        visible: true,
      },
      {
        key: 'sequence',
        label: 'Pass Number',
        x: 810,
        y: 1580,
        fontSize: 30,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#94A3B8',
        textAlign: 'center',
        visible: true,
      },
    ],
  },
  {
    name: 'Reusable Worker & Staff Pass',
    description: 'High-contrast reusable credential for volunteers, security staff, and organizers.',
    presetId: 'WORKER_PASS',
    dimensions: { width: 1620, height: 2025 },
    fields: [
      {
        key: 'eventName',
        label: 'Crew Category',
        x: 810,
        y: 380,
        fontSize: 44,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#F59E0B',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'role',
        label: 'Security Tier',
        x: 810,
        y: 460,
        fontSize: 38,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#EF4444',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'name',
        label: 'Worker Name',
        x: 810,
        y: 860,
        fontSize: 60,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        visible: true,
      },
      {
        key: 'qr',
        label: 'Access QR Code',
        x: 620,
        y: 1080,
        width: 380,
        height: 380,
        visible: true,
      },
      {
        key: 'sequence',
        label: 'Worker Sequence',
        x: 810,
        y: 1560,
        fontSize: 38,
        fontFamily: 'Noto Sans, sans-serif',
        fontWeight: 'bold',
        color: '#F59E0B',
        textAlign: 'center',
        visible: true,
      },
    ],
  },
];

export class MongoEventCredentialTemplateRepository {
  async findGlobalPresets(): Promise<IEventCredentialTemplateDocument[]> {
    return EventCredentialTemplateModel.find({ eventId: null }).sort({ createdAt: 1 }).exec();
  }

  async findByEventId(eventId: string): Promise<IEventCredentialTemplateDocument[]> {
    const objId = new mongoose.Types.ObjectId(eventId);
    return EventCredentialTemplateModel.find({
      $or: [{ eventId: objId }, { eventId: null }],
    })
      .sort({ isDefault: -1, createdAt: 1 })
      .exec();
  }

  async findDefaultByEventId(
    eventId: string
  ): Promise<IEventCredentialTemplateDocument | null> {
    const objId = new mongoose.Types.ObjectId(eventId);
    // First look for active default specifically configured for this event
    const eventDefault = await EventCredentialTemplateModel.findOne({
      eventId: objId,
      isDefault: true,
    }).exec();

    if (eventDefault) return eventDefault;

    // Fall back to first custom event template if available
    const firstEventTemplate = await EventCredentialTemplateModel.findOne({
      eventId: objId,
    }).exec();

    if (firstEventTemplate) return firstEventTemplate;

    // Otherwise fall back to global conference badge preset
    return EventCredentialTemplateModel.findOne({
      eventId: null,
      presetId: 'CONFERENCE_BADGE',
    }).exec();
  }

  async findById(id: string): Promise<IEventCredentialTemplateDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return EventCredentialTemplateModel.findById(id).exec();
  }

  async create(
    data: Partial<IEventCredentialTemplateDocument>
  ): Promise<IEventCredentialTemplateDocument> {
    return EventCredentialTemplateModel.create(data);
  }

  async update(
    id: string,
    data: Partial<IEventCredentialTemplateDocument>
  ): Promise<IEventCredentialTemplateDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return EventCredentialTemplateModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async setDefault(
    eventId: string,
    templateId: string
  ): Promise<IEventCredentialTemplateDocument | null> {
    const objEventId = new mongoose.Types.ObjectId(eventId);
    const objTemplateId = new mongoose.Types.ObjectId(templateId);

    // Unset any previous defaults for this event
    await EventCredentialTemplateModel.updateMany(
      { eventId: objEventId },
      { $set: { isDefault: false } }
    ).exec();

    // Set the chosen template as default
    return EventCredentialTemplateModel.findOneAndUpdate(
      { _id: objTemplateId, eventId: objEventId },
      { $set: { isDefault: true } },
      { new: true }
    ).exec();
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const res = await EventCredentialTemplateModel.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      eventId: { $ne: null }, // Global presets cannot be deleted
    }).exec();
    return (res.deletedCount || 0) > 0;
  }

  async seedGlobalPresetsIfEmpty(): Promise<number> {
    const count = await EventCredentialTemplateModel.countDocuments({ eventId: null }).exec();
    if (count > 0) return 0;

    const docs = GLOBAL_PRESET_DEFINITIONS.map((def, idx) => ({
      eventId: null,
      name: def.name,
      description: def.description,
      presetId: def.presetId,
      isDefault: idx === 0,
      dimensions: def.dimensions,
      fields: def.fields,
      createdBy: null,
    }));

    await EventCredentialTemplateModel.insertMany(docs);
    return docs.length;
  }
}

export const mongoEventCredentialTemplateRepository =
  new MongoEventCredentialTemplateRepository();
