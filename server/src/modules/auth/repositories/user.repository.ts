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
    const existing = await this.findById(data.id);
    const emailToUse = data.email?.trim() ? data.email.trim().toLowerCase() : `${data.id}@ticketification.internal`;
    const nameToUse = data.name?.trim() || 'Admin';
    const roleToUse = data.role || 'ADMIN';

    if (existing) {
      const result = await db.update(users)
        .set({ 
          name: nameToUse, 
          email: emailToUse, 
          role: roleToUse,
          updatedAt: new Date() 
        })
        .where(eq(users.id, data.id))
        .returning();
      return result[0];
    }

    const result = await db.insert(users).values({
      id: data.id,
      name: nameToUse,
      email: emailToUse,
      role: roleToUse,
    }).returning();
    return result[0];
  }
}

export const userRepository = new UserRepository();
