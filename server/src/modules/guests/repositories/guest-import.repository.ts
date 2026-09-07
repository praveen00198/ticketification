import { db } from '../../../db';
import { guestImports } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface CreateGuestImportInput {
  eventId: string;
  fileName: string;
  totalRows: number;
  validRows?: number;
  invalidRows?: number;
  skippedRows?: number;
  columnMapping?: Record<string, string>;
  requiredFields?: string[];
  categoryMapping?: Record<string, string>;
  status?: string;
  errorReport?: any[];
  createdBy: string;
}

export interface UpdateGuestImportInput {
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  skippedRows?: number;
  columnMapping?: Record<string, string>;
  requiredFields?: string[];
  categoryMapping?: Record<string, string>;
  status?: string;
  errorReport?: any[];
}

export class GuestImportRepository {
  /**
   * Find all imports for an event, explicitly ordered by createdAt DESC.
   */
  async findByEventId(eventId: string) {
    return await db
      .select()
      .from(guestImports)
      .where(eq(guestImports.eventId, eventId))
      .orderBy(desc(guestImports.createdAt));
  }

  /**
   * Find a specific import by ID.
   */
  async findById(id: string) {
    const result = await db
      .select()
      .from(guestImports)
      .where(eq(guestImports.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a specific import scoped to an event (IDOR prevention).
   */
  async findByIdAndEventId(id: string, eventId: string) {
    const result = await db
      .select()
      .from(guestImports)
      .where(and(eq(guestImports.id, id), eq(guestImports.eventId, eventId)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create a new guest import record.
   */
  async create(data: CreateGuestImportInput) {
    const result = await db
      .insert(guestImports)
      .values({
        eventId: data.eventId,
        fileName: data.fileName,
        totalRows: data.totalRows || 0,
        validRows: data.validRows || 0,
        invalidRows: data.invalidRows || 0,
        skippedRows: data.skippedRows || 0,
        columnMapping: data.columnMapping || {},
        requiredFields: data.requiredFields || [],
        categoryMapping: data.categoryMapping || {},
        status: data.status || 'ANALYZING',
        errorReport: data.errorReport || [],
        createdBy: data.createdBy,
      })
      .returning();

    return result[0];
  }

  /**
   * Update an existing guest import session.
   */
  async update(id: string, data: UpdateGuestImportInput) {
    const result = await db
      .update(guestImports)
      .set(data)
      .where(eq(guestImports.id, id))
      .returning();

    return result[0] || null;
  }

  /**
   * Delete an import session.
   */
  async delete(id: string) {
    const result = await db
      .delete(guestImports)
      .where(eq(guestImports.id, id))
      .returning();

    return result[0] || null;
  }
}

export const guestImportRepository = new GuestImportRepository();
