import { pgTable, uuid, text, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { events } from './events';
import { guests } from './guests';
import { ticketTypes } from './ticket-types';
import { users } from './users';

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
  ticketTypeId: uuid('ticket_type_id').notNull().references(() => ticketTypes.id),
  verificationToken: text('verification_token').notNull().unique(),
  status: text('status').notNull().default('ACTIVE'),
  usagePolicy: text('usage_policy').notNull().default('SINGLE_USE'),
  assetPath: text('asset_path'),
  assetUrl: text('asset_url'),
  sequenceNumber: integer('sequence_number').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_tickets_event_seq').on(table.eventId, table.sequenceNumber),
  index('idx_tickets_event').on(table.eventId),
  index('idx_tickets_verification_token').on(table.verificationToken),
  index('idx_tickets_guest').on(table.guestId),
  index('idx_tickets_status').on(table.status),
]);
