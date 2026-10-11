import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export type PlatformRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('USER'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
