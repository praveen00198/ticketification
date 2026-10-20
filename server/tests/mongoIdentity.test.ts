import { UserModel, IUser, PlatformRole } from '../src/db/mongo/models/user.model';
import { MongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { IdentitySyncService } from '../src/modules/auth/services/identity-sync.service';
import * as mongoDbModule from '../src/db/mongodb';

describe('Phase 2: MongoDB Application Identity & Coexistence Architecture', () => {
  describe('1. Mongoose User Model Schema Validation', () => {
    it('should validate and create a valid User document with least-privileged role USER', async () => {
      const user = new UserModel({
        supabaseUserId: 'sub-user-uuid-001',
        email: 'TEST.USER@EXAMPLE.COM',
        name: 'Test Attendee',
      });

      await expect(user.validate()).resolves.toBeUndefined();
      expect(user.email).toBe('test.user@example.com'); // Lowercase normalization
      expect(user.platformRole).toBe('USER'); // Least-privileged default
      expect(user.status).toBe('ACTIVE');
    });

    it('should fail validation when required fields are missing', async () => {
      const missingId = new UserModel({
        email: 'user@example.com',
        name: 'No Supabase ID',
      });
      await expect(missingId.validate()).rejects.toThrow();

      const missingEmail = new UserModel({
        supabaseUserId: 'some-id',
        name: 'No Email',
      });
      await expect(missingEmail.validate()).rejects.toThrow();
    });

    it('should fail validation when email format is invalid', async () => {
      const invalidEmailUser = new UserModel({
        supabaseUserId: 'uuid-123',
        email: 'not-an-email',
        name: 'Invalid Email User',
      });
      await expect(invalidEmailUser.validate()).rejects.toThrow();
    });

    it('should fail validation when platformRole is not in the allowed enum', async () => {
      const invalidRoleUser = new UserModel({
        supabaseUserId: 'uuid-123',
        email: 'user@example.com',
        name: 'Invalid Role User',
        platformRole: 'ORGANIZER_ROOT' as any,
      });
      await expect(invalidRoleUser.validate()).rejects.toThrow();
    });

    it('should allow valid platformRole: USER, ADMIN, SUPER_ADMIN', async () => {
      const roles: PlatformRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];
      for (const role of roles) {
        const user = new UserModel({
          supabaseUserId: `uuid-${role}`,
          email: `${role.toLowerCase()}@example.com`,
          name: `${role} User`,
          platformRole: role,
        });
        await expect(user.validate()).resolves.toBeUndefined();
        expect(user.platformRole).toBe(role);
      }
    });

    it('should fail validation when status is not ACTIVE or SUSPENDED', async () => {
      const invalidStatusUser = new UserModel({
        supabaseUserId: 'uuid-123',
        email: 'user@example.com',
        name: 'User',
        status: 'BANNED' as any,
      });
      await expect(invalidStatusUser.validate()).rejects.toThrow();
    });
  });

  describe('2. MongoUserRepository Layered Boundary', () => {
    let repo: MongoUserRepository;

    beforeEach(() => {
      repo = new MongoUserRepository();
    });

    it('should query by supabaseUserId via UserModel.findOne', async () => {
      const mockExec = jest.fn().mockResolvedValue({ supabaseUserId: 'sub-1', email: 'a@b.com' });
      const findOneSpy = jest.spyOn(UserModel, 'findOne').mockReturnValue({ exec: mockExec } as any);

      const result = await repo.findBySupabaseId('sub-1');
      expect(findOneSpy).toHaveBeenCalledWith({ supabaseUserId: 'sub-1' });
      expect(result).toEqual({ supabaseUserId: 'sub-1', email: 'a@b.com' });

      findOneSpy.mockRestore();
    });

    it('should query by canonical lowercase email', async () => {
      const mockExec = jest.fn().mockResolvedValue({ email: 'john@example.com' });
      const findOneSpy = jest.spyOn(UserModel, 'findOne').mockReturnValue({ exec: mockExec } as any);

      const result = await repo.findByEmail('  JOHN@Example.COM  ');
      expect(findOneSpy).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(result).toEqual({ email: 'john@example.com' });

      findOneSpy.mockRestore();
    });

    it('should query by MongoDB ObjectId via UserModel.findById', async () => {
      const mockExec = jest.fn().mockResolvedValue({ _id: 'mongo-id-123' });
      const findByIdSpy = jest.spyOn(UserModel, 'findById').mockReturnValue({ exec: mockExec } as any);

      const result = await repo.findById('mongo-id-123');
      expect(findByIdSpy).toHaveBeenCalledWith('mongo-id-123');
      expect(result).toEqual({ _id: 'mongo-id-123' });

      findByIdSpy.mockRestore();
    });

    it('should update platform role using findOneAndUpdate', async () => {
      const mockExec = jest.fn().mockResolvedValue({ supabaseUserId: 'sub-1', platformRole: 'ADMIN' });
      const updateSpy = jest.spyOn(UserModel, 'findOneAndUpdate').mockReturnValue({ exec: mockExec } as any);

      const result = await repo.updateRole('sub-1', 'ADMIN');
      expect(updateSpy).toHaveBeenCalledWith(
        { supabaseUserId: 'sub-1' },
        { $set: { platformRole: 'ADMIN' } },
        { returnDocument: 'after' }
      );
      expect(result?.platformRole).toBe('ADMIN');

      updateSpy.mockRestore();
    });

    it('should list users with explicit sort { createdAt: -1 }', async () => {
      const mockExec = jest.fn().mockResolvedValue([{ email: 'user1@example.com' }]);
      const mockLimit = jest.fn().mockReturnValue({ exec: mockExec });
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      const findSpy = jest.spyOn(UserModel, 'find').mockReturnValue({ sort: mockSort } as any);

      const result = await repo.listUsers({}, 20, 10);
      expect(findSpy).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(10);
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(result).toHaveLength(1);

      findSpy.mockRestore();
    });
  });

  describe('3. Dual-Database Identity Synchronization Service', () => {
    let mockMongoRepo: any;
    let mockPgRepo: any;
    let syncService: IdentitySyncService;

    beforeEach(() => {
      mockMongoRepo = {
        upsert: jest.fn(),
      };
      mockPgRepo = {
        findAll: jest.fn(),
      };
      syncService = new IdentitySyncService(mockMongoRepo, mockPgRepo);
    });

    it('should return null and not throw if MongoDB is not connected', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(false);

      const result = await syncService.syncUserToMongo({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User 1',
        role: 'USER',
      });

      expect(result).toBeNull();
      expect(mockMongoRepo.upsert).not.toHaveBeenCalled();
    });

    it('should sync PostgreSQL user to MongoDB with least-privileged role when connected', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(true);
      mockMongoRepo.upsert.mockResolvedValue({
        supabaseUserId: 'pg-user-1',
        email: 'attendee@event.com',
        platformRole: 'USER',
      });

      const result = await syncService.syncUserToMongo({
        id: 'pg-user-1',
        email: 'attendee@event.com',
        name: 'Attendee One',
        role: 'USER',
      });

      expect(mockMongoRepo.upsert).toHaveBeenCalledWith({
        supabaseUserId: 'pg-user-1',
        email: 'attendee@event.com',
        name: 'Attendee One',
        platformRole: 'USER',
      });
      expect(result?.platformRole).toBe('USER');
    });

    it('should correctly preserve verified ADMIN or SUPER_ADMIN roles when syncing', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(true);
      mockMongoRepo.upsert.mockResolvedValue({
        supabaseUserId: 'pg-admin-1',
        email: 'admin@event.com',
        platformRole: 'ADMIN',
      });

      await syncService.syncUserToMongo({
        id: 'pg-admin-1',
        email: 'admin@event.com',
        name: 'Platform Admin',
        role: 'ADMIN',
      });

      expect(mockMongoRepo.upsert).toHaveBeenCalledWith({
        supabaseUserId: 'pg-admin-1',
        email: 'admin@event.com',
        name: 'Platform Admin',
        platformRole: 'ADMIN',
      });
    });

    it('should downgrade arbitrary/unrecognized PostgreSQL role strings to USER in MongoDB', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(true);
      mockMongoRepo.upsert.mockResolvedValue({
        supabaseUserId: 'pg-user-bad-role',
        email: 'bad@event.com',
        platformRole: 'USER',
      });

      await syncService.syncUserToMongo({
        id: 'pg-user-bad-role',
        email: 'bad@event.com',
        name: 'Bad Role User',
        role: 'SUPER_HOST_ROOT' as any,
      });

      expect(mockMongoRepo.upsert).toHaveBeenCalledWith({
        supabaseUserId: 'pg-user-bad-role',
        email: 'bad@event.com',
        name: 'Bad Role User',
        platformRole: 'USER',
      });
    });

    it('should bulk synchronize all existing PostgreSQL users to MongoDB', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(true);
      mockPgRepo.findAll.mockResolvedValue([
        { id: 'u1', email: 'u1@test.com', name: 'User 1', role: 'USER' },
        { id: 'u2', email: 'u2@test.com', name: 'User 2', role: 'ADMIN' },
      ]);
      mockMongoRepo.upsert.mockResolvedValue({ status: 'ok' });

      const syncStats = await syncService.syncAllPostgresUsersToMongo();

      expect(syncStats.total).toBe(2);
      expect(syncStats.synced).toBe(2);
      expect(syncStats.errors).toBe(0);
      expect(mockMongoRepo.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle MongoDB upsert errors in bulk sync without halting subsequent users', async () => {
      jest.spyOn(mongoDbModule, 'isMongoConnected').mockReturnValue(true);
      mockPgRepo.findAll.mockResolvedValue([
        { id: 'u1', email: 'u1@test.com', name: 'User 1', role: 'USER' },
        { id: 'u2', email: 'u2@test.com', name: 'User 2', role: 'USER' },
      ]);
      mockMongoRepo.upsert
        .mockRejectedValueOnce(new Error('Duplicate key on u1'))
        .mockResolvedValueOnce({ status: 'ok' });

      const syncStats = await syncService.syncAllPostgresUsersToMongo();

      expect(syncStats.total).toBe(2);
      expect(syncStats.synced).toBe(1);
      expect(syncStats.errors).toBe(1);
    });
  });

  describe('4. MongoDB Connection Resilience & Standby Mode', () => {
    it('should return null cleanly when MONGODB_URI is not provided', async () => {
      const conn = await mongoDbModule.connectMongoDB({ uri: '' });
      expect(conn).toBeNull();
      expect(mongoDbModule.isMongoConnected()).toBe(false);
    });
  });
});
