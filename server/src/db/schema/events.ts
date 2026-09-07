import { pgTable, uuid, text, date, time, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  date: date('date').notNull(),
  time: time('time'),
  venue: text('venue'),
  description: text('description'),
  organizerName: text('organizer_name'),
  logoUrl: text('logo_url'),
  ticketTemplateUrl: text('ticket_template_url'),
  status: text('status').notNull().default('UPCOMING'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_events_created_by').on(table.createdBy),
  index('idx_events_status').on(table.status),
]);
