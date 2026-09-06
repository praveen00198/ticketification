import { Schema, model, Document, Types } from 'mongoose';

export type DeliveryProvider = 'WHATSAPP' | 'EMAIL';
export type DeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';

export type TicketStatus = 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';
// Kept for backward compatibility with existing email-based queries
export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface ITicketDocument extends Document {
  ticketId: string;
  verificationToken: string;
  name: string;
  email?: string;
  phone?: string;
  event: string;
  eventDate: Date;
  ticketType: string;
  organization?: string;
  designation?: string;
  status: TicketStatus;
  emailStatus: EmailStatus;
  deliveryProvider: DeliveryProvider;
  deliveryStatus: DeliveryStatus;
  providerMessageId?: string;
  ticketImageUrl?: string;
  pdfPath?: string;
  usedAt?: Date;
  verifiedBy?: string;
  createdBy?: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicketDocument>(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    verificationToken: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, index: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, index: true },
    event: { type: String, required: true, default: 'Ticketification 2026' },
    eventDate: { type: Date, required: true, default: () => new Date('2026-08-25') },
    ticketType: { type: String, required: true, default: 'VIP Pass' },
    organization: { type: String, trim: true },
    designation: { type: String, trim: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'USED', 'CANCELLED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    emailStatus: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    deliveryProvider: {
      type: String,
      enum: ['WHATSAPP', 'EMAIL'],
      default: 'WHATSAPP',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: ['PENDING', 'SENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    providerMessageId: { type: String },
    ticketImageUrl: { type: String },
    pdfPath: { type: String },
    usedAt: { type: Date },
    verifiedBy: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

export const Ticket = model<ITicketDocument>('Ticket', ticketSchema);
