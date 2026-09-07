import { db } from '../../../db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export class UserRepository {
  async findById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return result[0] || null;
  }

  async upsert(data: { id: string; name: string; email: string; role?: string }) {
    const emailToUse = data.email?.trim() ? data.email.trim().toLowerCase() : `${data.id}@ticketification.internal`;
    const nameToUse = data.name?.trim() || 'Admin';
    const roleToUse = data.role || 'ADMIN';

    const result = await db
      .insert(users)
      .values({
        id: data.id,
        name: nameToUse,
        email: emailToUse,
        role: roleToUse,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: nameToUse,
          email: emailToUse,
          role: roleToUse,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  }
}

export const userRepository = new UserRepository();
