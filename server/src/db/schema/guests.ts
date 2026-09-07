import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { events } from './events';
import { guestImports } from './guest-imports';

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  organization: text('organization'),
  designation: text('designation'),
  category: text('category').notNull(),
  metadata: jsonb('metadata').default({}),
  importId: uuid('import_id').references(() => guestImports.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_guests_event').on(table.eventId),
  index('idx_guests_import').on(table.importId),
  index('idx_guests_event_category').on(table.eventId, table.category),
]);
