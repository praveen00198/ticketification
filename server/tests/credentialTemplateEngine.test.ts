const mockGetUser = jest.fn();

jest.mock('../src/config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
  },
  supabaseStorageAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
  supabasePublic: null,
}));

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { userRepository } from '../src/modules/auth/repositories/user.repository';
import { mongoUserRepository } from '../src/modules/auth/repositories/mongo-user.repository';
import { mongoEventRepository } from '../src/modules/events/repositories/mongo-event.repository';
import { mongoEventMemberRepository } from '../src/modules/events/repositories/mongo-event-member.repository';
import { mongoEventCredentialRepository } from '../src/modules/events/repositories/mongo-event-credential.repository';
import {
  mongoEventCredentialTemplateRepository,
  GLOBAL_PRESET_DEFINITIONS,
} from '../src/modules/events/repositories/mongo-event-credential-template.repository';
import { eventCredentialRenderingService } from '../src/modules/events/services/event-credential-rendering.service';
import { supabaseStorageService } from '../src/modules/tickets/services/supabase-storage.service';

describe('Phase 13: Credential Templates & Sharp Rendering Engine', () => {
  jest.setTimeout(30000);

  const hostUser = { id: 'mock-host-uuid-phase13', email: 'host.phase13@conference.org' };
  const coordinatorUser = { id: 'mock-coord-uuid-phase13', email: 'coord.phase13@conference.org' };
  const outsiderUser = { id: 'mock-out-uuid-phase13', email: 'outsider.phase13@random.org' };

  const hostToken = 'valid-host-token-phase13';
  const coordinatorToken = 'valid-coord-token-phase13';
  const outsiderToken = 'valid-out-token-phase13';

  const hostMongoId = new mongoose.Types.ObjectId();
  const coordinatorMongoId = new mongoose.Types.ObjectId();
  const outsiderMongoId = new mongoose.Types.ObjectId();

  const testEventId = new mongoose.Types.ObjectId();
  const coordinatorMemberId = new mongoose.Types.ObjectId();

  let mockEvents: Map<string, any>;
  let mockMembers: Map<string, any>;
  let mockCredentials: Map<string, any>;
  let mockTemplates: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvents = new Map();
    mockMembers = new Map();
    mockCredentials = new Map();
    mockTemplates = new Map();

    const baseEvent: any = {
      _id: testEventId,
      ownerId: hostMongoId,
      ownerSupabaseId: hostUser.id,
      name: 'Global Tech Summit 2026',
      eventType: 'CONFERENCE',
      credentialTerminology: 'Delegate Badge',
      venue: { type: 'PHYSICAL', name: 'Convention Hall A' },
      schedule: {
        startAt: new Date('2026-11-15T09:00:00Z'),
        endAt: new Date('2026-11-16T18:00:00Z'),
        timezone: 'UTC',
      },
      status: 'PUBLISHED',
      verificationStatus: 'VERIFIED',
    };
    mockEvents.set(testEventId.toString(), baseEvent);

    mockMembers.set(coordinatorMemberId.toString(), {
      _id: coordinatorMemberId,
      eventId: testEventId,
      userId: coordinatorMongoId,
      userEmail: coordinatorUser.email,
      role: 'COORDINATOR',
      permissions: ['MANAGE_ATTENDEES'],
      status: 'ACTIVE',
    });

    // Seed in-memory templates with the global presets
    GLOBAL_PRESET_DEFINITIONS.forEach((def, index) => {
      const id = new mongoose.Types.ObjectId();
      mockTemplates.set(id.toString(), {
        _id: id,
        eventId: null,
        name: def.name,
        description: def.description,
        presetId: def.presetId,
        isDefault: index === 0,
        dimensions: def.dimensions,
        fields: JSON.parse(JSON.stringify(def.fields)),
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Mock Supabase Auth
    mockGetUser.mockImplementation(async (token: string) => {
      if (token === hostToken) return { data: { user: hostUser }, error: null };
      if (token === coordinatorToken) return { data: { user: coordinatorUser }, error: null };
      if (token === outsiderToken) return { data: { user: outsiderUser }, error: null };
      return { data: { user: null }, error: new Error('Invalid token') };
    });

    // Mock PG User Repository
    jest.spyOn(userRepository, 'findById').mockImplementation(async (id: string) => {
      if (id === hostUser.id) return { id: hostUser.id, email: hostUser.email, role: 'HOST' } as any;
      if (id === coordinatorUser.id) return { id: coordinatorUser.id, email: coordinatorUser.email, role: 'COORDINATOR' } as any;
      if (id === outsiderUser.id) return { id: outsiderUser.id, email: outsiderUser.email, role: 'ATTENDEE' } as any;
      return null;
    });

    // Mock Mongo User Repository
    jest.spyOn(mongoUserRepository, 'findBySupabaseId').mockImplementation(async (supabaseId: string) => {
      if (supabaseId === hostUser.id) {
        return { _id: hostMongoId, supabaseId: hostUser.id, email: hostUser.email, platformRole: 'HOST' } as any;
      }
      if (supabaseId === coordinatorUser.id) {
        return { _id: coordinatorMongoId, supabaseId: coordinatorUser.id, email: coordinatorUser.email, platformRole: 'COORDINATOR' } as any;
      }
      if (supabaseId === outsiderUser.id) {
        return { _id: outsiderMongoId, supabaseId: outsiderUser.id, email: outsiderUser.email, platformRole: 'ATTENDEE' } as any;
      }
      return null;
    });

    // Mock Mongo Event Repository
    jest.spyOn(mongoEventRepository, 'findById').mockImplementation(async (id: any): Promise<any> => {
      return mockEvents.get(id.toString()) || null;
    });

    // Mock Mongo Member Repository
    jest.spyOn(mongoEventMemberRepository, 'findByEventAndUser').mockImplementation(async (eId: any, uId: any): Promise<any> => {
      for (const m of mockMembers.values()) {
        if (m.eventId.toString() === eId.toString() && m.userId.toString() === uId.toString()) {
          return m;
        }
      }
      return null;
    });

    // Mock Template Repository
    jest.spyOn(mongoEventCredentialTemplateRepository, 'seedGlobalPresetsIfEmpty').mockResolvedValue(0);

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findGlobalPresets').mockImplementation(async () => {
      return Array.from(mockTemplates.values()).filter((t) => !t.eventId);
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findByEventId').mockImplementation(async (eId: string) => {
      return Array.from(mockTemplates.values()).filter(
        (t) => !t.eventId || t.eventId.toString() === eId
      );
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findDefaultByEventId').mockImplementation(async (eId: string) => {
      const eventDef = Array.from(mockTemplates.values()).find(
        (t) => t.eventId && t.eventId.toString() === eId && t.isDefault
      );
      if (eventDef) return eventDef;
      return (
        Array.from(mockTemplates.values()).find(
          (t) => !t.eventId && t.presetId === 'CONFERENCE_BADGE'
        ) || null
      );
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'findById').mockImplementation(async (id: any) => {
      return mockTemplates.get(id.toString()) || null;
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'create').mockImplementation(async (data: any) => {
      const docId = new mongoose.Types.ObjectId();
      const newDoc = {
        _id: docId,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTemplates.set(docId.toString(), newDoc);
      return newDoc as any;
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'update').mockImplementation(async (id: any, data: any) => {
      const existing = mockTemplates.get(id.toString());
      if (!existing) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      mockTemplates.set(id.toString(), updated);
      return updated as any;
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'setDefault').mockImplementation(async (eId: any, tId: any) => {
      for (const [k, v] of mockTemplates.entries()) {
        if (v.eventId && v.eventId.toString() === eId.toString()) {
          mockTemplates.set(k, { ...v, isDefault: false });
        }
      }
      const target = mockTemplates.get(tId.toString());
      if (target) {
        const updated = { ...target, isDefault: true };
        mockTemplates.set(tId.toString(), updated);
        return updated as any;
      }
      return null;
    });

    jest.spyOn(mongoEventCredentialTemplateRepository, 'delete').mockImplementation(async (id: any) => {
      const target = mockTemplates.get(id.toString());
      if (target && target.eventId) {
        mockTemplates.delete(id.toString());
        return true;
      }
      return false;
    });

    // Mock Credential Repository for asset rendering
    jest.spyOn(mongoEventCredentialRepository, 'findById').mockImplementation(async (eId: any, cId?: any) => {
      const targetId = cId ? cId.toString() : eId.toString();
      return mockCredentials.get(targetId) || null;
    });

    // Mock Supabase Storage
    jest.spyOn(supabaseStorageService, 'isConfigured').mockReturnValue(false);
    jest.spyOn(supabaseStorageService, 'downloadTicketImage').mockResolvedValue(Buffer.from('mock'));
    jest.spyOn(supabaseStorageService, 'uploadTicketImage').mockImplementation(async (storagePath: string) => {
      return {
        storagePath,
        publicUrl: `https://mock.storage.supabase.co/ticket-images/${storagePath}`,
      };
    });
  });

  describe('1. Global Preset Seeding & Listing', () => {
    it('returns the 4 canonical platform presets with dimensions and fields', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/credential-templates`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const presets = res.body.data.map((t: any) => t.presetId);
      expect(presets).toContain('CONFERENCE_BADGE');
      expect(presets).toContain('CONCERT_TICKET');
      expect(presets).toContain('HACKATHON_PASS');
      expect(presets).toContain('WORKER_PASS');

      // Verify default template is present
      expect(res.body.defaultTemplate).toBeDefined();
      expect(res.body.defaultTemplate.presetId).toBe('CONFERENCE_BADGE');
    });

    it('coordinator can also list credential templates', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/credential-templates`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects unauthorized users without event staff roles', async () => {
      const res = await request(app)
        .get(`/api/events/${testEventId}/credential-templates`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Custom Template Creation & Preset Cloning', () => {
    it('creates a custom event template with customized dimensions and field layout', async () => {
      const payload = {
        name: 'VIP Executive Pass 2026',
        description: 'Gold tier lanyard pass with prominent company logo overlay',
        dimensions: { width: 1620, height: 2025 },
        presetId: 'CUSTOM',
        fields: [
          { key: 'name', label: 'VIP Full Name', x: 810, y: 800, fontSize: 60, color: '#F59E0B', visible: true },
          { key: 'role', label: 'VIP Status', x: 810, y: 920, fontSize: 40, color: '#F59E0B', visible: true },
          { key: 'qr', label: 'VIP Entry QR', x: 620, y: 1100, width: 380, height: 380, visible: true },
        ],
        isDefault: false,
      };

      const res = await request(app)
        .post(`/api/events/${testEventId}/credential-templates`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('VIP Executive Pass 2026');
      expect(res.body.data.fields).toHaveLength(3);
      expect(res.body.data.eventId.toString()).toBe(testEventId.toString());
    });

    it('clones a global preset into an event-specific template', async () => {
      const res = await request(app)
        .post(`/api/events/${testEventId}/credential-templates/clone-preset`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          presetId: 'HACKATHON_PASS',
          name: 'HackNova Hacker Pass (Custom)',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('HackNova Hacker Pass (Custom)');
      expect(res.body.data.presetId).toBe('HACKATHON_PASS');
      expect(res.body.data.fields.length).toBeGreaterThan(0);
    });
  });

  describe('3. Template Updates, Default Selection & Deletion', () => {
    let customTemplateId: string;

    beforeEach(async () => {
      const created = await mongoEventCredentialTemplateRepository.create({
        eventId: testEventId,
        name: 'Custom Stage Pass',
        presetId: 'CUSTOM',
        dimensions: { width: 1620, height: 2025 },
        fields: [{ key: 'name', label: 'Name', x: 810, y: 850, visible: true }],
        isDefault: false,
      });
      customTemplateId = created._id.toString();
    });

    it('updates fields and layout of a custom event template', async () => {
      const res = await request(app)
        .put(`/api/events/${testEventId}/credential-templates/${customTemplateId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: 'Updated Stage Pass',
          fields: [
            { key: 'name', label: 'Name', x: 810, y: 900, fontSize: 72, color: '#10B981', visible: true },
            { key: 'role', label: 'Role', x: 810, y: 1000, fontSize: 36, color: '#FFFFFF', visible: true },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Stage Pass');
      expect(res.body.data.fields).toHaveLength(2);
    });

    it('sets a custom template as the active default for the event', async () => {
      const res = await request(app)
        .put(`/api/events/${testEventId}/credential-templates/${customTemplateId}/set-default`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isDefault).toBe(true);
    });

    it('deletes a custom event template', async () => {
      const res = await request(app)
        .delete(`/api/events/${testEventId}/credential-templates/${customTemplateId}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('protects global system presets from direct mutation or deletion', async () => {
      const globalPreset = Array.from(mockTemplates.values()).find((t) => !t.eventId);
      expect(globalPreset).toBeDefined();

      const updateRes = await request(app)
        .put(`/api/events/${testEventId}/credential-templates/${globalPreset._id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Tampered Global Preset' });

      expect(updateRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/events/${testEventId}/credential-templates/${globalPreset._id}`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });

  describe('4. Sharp Rasterization & Binary PNG Invariants', () => {
    it('renders a genuine PNG buffer matching 0x89504E47 magic bytes', async () => {
      const template = Array.from(mockTemplates.values())[0];
      const buffer = await eventCredentialRenderingService.renderCredentialBuffer(template, {
        name: 'Devika Sharma',
        sequence: 'BDG-00042',
        role: 'KEYNOTE SPEAKER',
        eventName: 'Global Tech Summit 2026',
        date: 'November 15, 2026',
        verificationToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(eventCredentialRenderingService.isPngBuffer(buffer)).toBe(true);

      // Assert PNG magic header 0x89504E47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });

    it('generates a real-time preview data URL via HTTP endpoint', async () => {
      const template = Array.from(mockTemplates.values())[0];

      const res = await request(app)
        .post(`/api/events/${testEventId}/credential-templates/${template._id}/preview`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          name: 'Jane Doe',
          role: 'VIP PARTICIPANT',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.previewUrl).toBeDefined();
      expect(res.body.data.previewUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('5. Credential Asset Generation & Supabase Storage Binding', () => {
    it('renders genuine PNG asset for an issued credential and commits storage path', async () => {
      const credId = new mongoose.Types.ObjectId();
      const mockCred: any = {
        _id: credId,
        eventId: testEventId,
        sequenceNumber: 1,
        formattedId: 'BDG-00001',
        verificationToken: 'c7a31f9b4e820d65a192837465abcdeffedcba5674839201a5b6c7d8e9f01234',
        status: 'ACTIVE',
        holder: { name: 'Aarav Patel', category: 'DELEGATE' },
        save: jest.fn().mockResolvedValue(true),
      };
      mockCredentials.set(credId.toString(), mockCred);

      const res = await request(app)
        .post(`/api/events/${testEventId}/credentials/${credId}/render`)
        .set('Authorization', `Bearer ${hostToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockCred.asset).toBeDefined();
      expect(mockCred.asset.storagePath).toBe(`events/${testEventId}/credentials/${credId}.png`);
      expect(mockCred.asset.mimeType).toBe('image/png');
      expect(mockCred.save).toHaveBeenCalled();
    });
  });
});
