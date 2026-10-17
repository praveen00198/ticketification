import { db } from '../../../db';
import { users, PlatformRole } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export class UserRepository {
  async findById(id: string) {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] || null;
    } catch {
      return null;
    }
  }

  async findByEmail(email: string) {
    try {
      const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      return result[0] || null;
    } catch {
      return null;
    }
  }

  async upsert(data: { id: string; name: string; email: string; role?: string }) {
    const emailToUse = data.email?.trim() ? data.email.trim().toLowerCase() : `${data.id}@ticketification.internal`;
    const nameToUse = data.name?.trim() || 'User';
    const roleToUse = data.role || 'USER';

    const updateFields: Record<string, any> = {
      name: nameToUse,
      email: emailToUse,
      updatedAt: new Date(),
    };

    if (data.role) {
      updateFields.role = data.role;
    }

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
        set: updateFields,
      })
      .returning();

    return result[0];
  }

  async updateRole(id: string, role: PlatformRole) {
    const result = await db
      .update(users)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return result[0] || null;
  }

  async findAll() {
    return db.select().from(users).orderBy(users.createdAt);
  }
}

export const userRepository = new UserRepository();
