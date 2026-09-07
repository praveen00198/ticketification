import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { events } from './events';
import { users } from './users';

export const guestImports = pgTable('guest_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  totalRows: integer('total_rows').notNull().default(0),
  validRows: integer('valid_rows').notNull().default(0),
  invalidRows: integer('invalid_rows').notNull().default(0),
  skippedRows: integer('skipped_rows').notNull().default(0),
  columnMapping: jsonb('column_mapping').notNull().default({}),
  requiredFields: jsonb('required_fields').notNull().default([]),
  categoryMapping: jsonb('category_mapping').notNull().default({}),
  status: text('status').notNull().default('ANALYZING'),
  errorReport: jsonb('error_report').default([]),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_imports_event').on(table.eventId),
]);
