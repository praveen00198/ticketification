import mongoose, { Schema, Document, Model } from 'mongoose';

export type TemplatePresetId =
  | 'CONFERENCE_BADGE'
  | 'CONCERT_TICKET'
  | 'HACKATHON_PASS'
  | 'WORKER_PASS'
  | 'CUSTOM';

export const TEMPLATE_PRESET_IDS: TemplatePresetId[] = [
  'CONFERENCE_BADGE',
  'CONCERT_TICKET',
  'HACKATHON_PASS',
  'WORKER_PASS',
  'CUSTOM',
];

export type TemplateFieldKey =
  | 'name'
  | 'qr'
  | 'sequence'
  | 'role'
  | 'eventName'
  | 'date'
  | 'venue'
  | 'custom';

export const TEMPLATE_FIELD_KEYS: TemplateFieldKey[] = [
  'name',
  'qr',
  'sequence',
  'role',
  'eventName',
  'date',
  'venue',
  'custom',
];

export interface ITemplateField {
  key: TemplateFieldKey;
  label: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  fontSize?: number | null;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface ITemplateDimensions {
  width: number;
  height: number;
}

export interface IEventCredentialTemplateDocument extends Document {
  _id: mongoose.Types.ObjectId;
  eventId?: mongoose.Types.ObjectId | null;
  name: string;
  description?: string | null;
  isDefault: boolean;
  presetId: TemplatePresetId;
  dimensions: ITemplateDimensions;
  backgroundStoragePath?: string | null;
  backgroundPublicUrl?: string | null;
  fields: ITemplateField[];
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateFieldSchema = new Schema<ITemplateField>(
  {
    key: {
      type: String,
      required: true,
      enum: TEMPLATE_FIELD_KEYS,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    x: {
      type: Number,
      required: true,
      default: 0,
    },
    y: {
      type: Number,
      required: true,
      default: 0,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    fontSize: {
      type: Number,
      default: 32,
    },
    fontFamily: {
      type: String,
      default: 'Noto Sans, sans-serif',
      trim: true,
    },
    fontWeight: {
      type: String,
      default: 'bold',
      trim: true,
    },
    color: {
      type: String,
      default: '#FFFFFF',
      trim: true,
    },
    textAlign: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center',
    },
    visible: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const TemplateDimensionsSchema = new Schema<ITemplateDimensions>(
  {
    width: {
      type: Number,
      required: true,
      default: 1620,
    },
    height: {
      type: Number,
      required: true,
      default: 2025,
    },
  },
  { _id: false }
);

const EventCredentialTemplateSchema = new Schema<IEventCredentialTemplateDocument>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    presetId: {
      type: String,
      enum: TEMPLATE_PRESET_IDS,
      default: 'CUSTOM',
    },
    dimensions: {
      type: TemplateDimensionsSchema,
      required: true,
      default: () => ({ width: 1620, height: 2025 }),
    },
    backgroundStoragePath: {
      type: String,
      default: null,
      trim: true,
    },
    backgroundPublicUrl: {
      type: String,
      default: null,
      trim: true,
    },
    fields: {
      type: [TemplateFieldSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'event_credential_templates',
  }
);

// Indexes for fast lookup by event and default status
EventCredentialTemplateSchema.index({ eventId: 1, isDefault: 1 });
EventCredentialTemplateSchema.index({ eventId: 1, name: 1 });

export const EventCredentialTemplateModel: Model<IEventCredentialTemplateDocument> =
  mongoose.models.EventCredentialTemplate ||
  mongoose.model<IEventCredentialTemplateDocument>(
    'EventCredentialTemplate',
    EventCredentialTemplateSchema
  );
