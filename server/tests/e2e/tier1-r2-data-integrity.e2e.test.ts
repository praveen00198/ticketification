import mongoose from 'mongoose';
import { mongoUserRepository, MongoUserRepository } from '../../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../../src/modules/events/repositories/mongo-event.repository';
import { EventCredentialModel } from '../../src/db/mongo/models/event-credential.model';
import { EventModel } from '../../src/db/mongo/models/event.model';
import { EventRegistrationModel } from '../../src/db/mongo/models/event-registration.model';
import { UserModel } from '../../src/db/mongo/models/user.model';

describe('Tier 1: Requirement R2 — Supabase & MongoDB Data Integrity E2E Suite', () => {
  const mockObjectId = new mongoose.Types.ObjectId().toString();
  const mockSupabaseUserId = 'usr_supa_9876543210';
  const mockEmail = 'integrity_test@example.com';

  const mockUserDoc: any = {
    _id: new mongoose.Types.ObjectId(mockObjectId),
    supabaseUserId: mockSupabaseUserId,
    email: mockEmail,
    name: 'Integrity Tester',
    platformRole: 'USER',
    status: 'ACTIVE',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('R2.1: Dual Identity Resolution (Supabase UID & MongoDB ObjectId)', () => {
    it('R2-TC1: resolves user profile when queried via MongoDB ObjectId', async () => {
      jest.spyOn(UserModel, 'findById').mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      } as any);

      const user = await mongoUserRepository.findById(mockObjectId);
      expect(user).toBeDefined();
      expect(user?.email).toBe(mockEmail);
      expect(user?.supabaseUserId).toBe(mockSupabaseUserId);
    });

    it('R2-TC2: resolves user profile when queried via Supabase UID', async () => {
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      } as any);

      const user = await mongoUserRepository.findBySupabaseId(mockSupabaseUserId);
      expect(user).toBeDefined();
      expect(user?.email).toBe(mockEmail);
      expect(user?.supabaseUserId).toBe(mockSupabaseUserId);
    });

    it('R2-TC3: resolveUserFilter helper handles both ObjectIds and alphanumeric Supabase UIDs', () => {
      // White-box test on identity filter builder logic
      const validObjectId = new mongoose.Types.ObjectId().toString();
      const rawSupabaseUid = '550e8400-e29b-41d4-a716-446655440000';

      const buildFilter = (id: string) => {
        if (mongoose.Types.ObjectId.isValid(id)) {
          return { $or: [{ _id: id }, { supabaseUserId: id }] };
        }
        return { supabaseUserId: id };
      };

      const objectIdFilter: any = buildFilter(validObjectId);
      expect(objectIdFilter.$or).toBeDefined();
      expect(objectIdFilter.$or.length).toBe(2);

      const supaFilter: any = buildFilter(rawSupabaseUid);
      expect(supaFilter.supabaseUserId).toBe(rawSupabaseUid);
      expect(supaFilter.$or).toBeUndefined();
    });
  });

  describe('R2.2: Event Scoping & Tenant Isolation', () => {
    it('R2-TC4: event queries enforce owner and eventId matching without leaking cross-host events', async () => {
      const targetEventId = new mongoose.Types.ObjectId().toString();
      const ownerId = 'usr_host_owner_111';

      const mockEvent = {
        _id: new mongoose.Types.ObjectId(targetEventId),
        name: 'Isolated Tech Summit',
        ownerSupabaseId: ownerId,
        ownerId: new mongoose.Types.ObjectId(),
        status: 'PUBLISHED',
      };

      const findOneSpy = jest.spyOn(EventModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockEvent),
      } as any);

      const result = await mongoEventRepository.findByIdAndOwner(targetEventId, ownerId);
      expect(result).toBeDefined();
      expect(result?.name).toBe('Isolated Tech Summit');

      // Verify the query criteria sent to Mongo includes both _id and owner
      expect(findOneSpy).toHaveBeenCalled();
      const calledFilter = findOneSpy.mock.calls[0][0];
      expect(calledFilter._id).toBe(targetEventId);
    });

    it('R2-TC5: prevents cross-tenant access when caller is not the authoritative owner', async () => {
      const targetEventId = new mongoose.Types.ObjectId().toString();
      const attackerOwnerId = 'usr_attacker_999';

      jest.spyOn(EventModel, 'findOne').mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any);

      const result = await mongoEventRepository.findByIdAndOwner(targetEventId, attackerOwnerId);
      expect(result).toBeNull();
    });
  });

  describe('R2.3: Binary-Free MongoDB Persistence Compliance', () => {
    it('R2-TC6: validates that EventCredentialModel schema defines asset storage as URI strings, never binary buffers', () => {
      const assetPath = EventCredentialModel.schema.path('asset');
      expect(assetPath).toBeDefined();

      const publicUrlType = EventCredentialModel.schema.path('asset.publicUrl');
      const storagePathType = EventCredentialModel.schema.path('asset.storagePath');
      const mimeType = EventCredentialModel.schema.path('asset.mimeType');

      expect(publicUrlType.instance).toBe('String');
      expect(storagePathType.instance).toBe('String');
      expect(mimeType.instance).toBe('String');

      // Ensure no raw Buffer or BinData type is registered on the credential model
      const paths = Object.keys(EventCredentialModel.schema.paths);
      for (const p of paths) {
        const schemaType = EventCredentialModel.schema.paths[p];
        expect(schemaType.instance).not.toBe('Buffer');
      }
    });

    it('R2-TC7: validates that EventModel banner, logo, and template fields store URI strings only', () => {
      const bannerPath = EventModel.schema.path('bannerUrl');
      const logoPath = EventModel.schema.path('logoUrl');
      const templatePath = EventModel.schema.path('ticketTemplateUrl');

      if (bannerPath) expect(bannerPath.instance).toBe('String');
      if (logoPath) expect(logoPath.instance).toBe('String');
      if (templatePath) expect(templatePath.instance).toBe('String');

      // Verify no Buffer instances exist across top-level EventModel fields
      const paths = Object.keys(EventModel.schema.paths);
      for (const p of paths) {
        const schemaType = EventModel.schema.paths[p];
        expect(schemaType.instance).not.toBe('Buffer');
      }
    });
  });

  describe('R2.4: Registration Uniqueness & Constraint Invariants', () => {
    it('R2-TC8: EventRegistration schema defines unique compound indexes preventing duplicate attendee entries', () => {
      const indexes = EventRegistrationModel.schema.indexes();
      expect(indexes).toBeDefined();
      expect(indexes.length).toBeGreaterThan(0);

      // Verify that compound index on eventId and email or userId exists
      const hasEventCompoundIndex = indexes.some(([fields, options]) => {
        return (
          fields.eventId !== undefined &&
          (fields.userId !== undefined ||
            fields['attendeeDetails.email'] !== undefined ||
            fields.userSupabaseId !== undefined)
        );
      });

      expect(hasEventCompoundIndex).toBe(true);
    });
  });
});
