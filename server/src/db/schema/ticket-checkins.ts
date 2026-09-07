import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tickets } from './tickets';
import { events } from './events';

export const ticketCheckins = pgTable('ticket_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  verifiedBy: text('verified_by').notNull().default('Admin Scanner'),
  workerNameAssigned: text('worker_name_assigned'),
  metadata: jsonb('metadata').default({}),
}, (table) => [
  index('idx_checkins_ticket').on(table.ticketId),
  index('idx_checkins_event').on(table.eventId),
  index('idx_checkins_time').on(table.checkedInAt),
]);
