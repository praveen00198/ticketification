import { Schema, model, Document } from 'mongoose';

export interface IUserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  eventName?: string;
  role: 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    eventName: { type: String, trim: true },
    role: { type: String, enum: ['ADMIN'], default: 'ADMIN' },
  },
  { timestamps: true }
);

export const User = model<IUserDocument>('User', userSchema);

