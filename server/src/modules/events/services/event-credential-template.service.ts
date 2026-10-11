import mongoose from 'mongoose';
import {
  mongoEventCredentialTemplateRepository,
  MongoEventCredentialTemplateRepository,
} from '../repositories/mongo-event-credential-template.repository';
import {
  eventCredentialRenderingService,
  EventCredentialRenderingService,
  CredentialRenderData,
} from './event-credential-rendering.service';
import {
  mongoEventCredentialRepository,
  MongoEventCredentialRepository,
} from '../repositories/mongo-event-credential.repository';
import {
  mongoEventRepository,
  MongoEventRepository,
} from '../repositories/mongo-event.repository';
import {
  mongoEventMemberRepository,
  MongoEventMemberRepository,
} from '../repositories/mongo-event-member.repository';
import {
  mongoUserRepository,
  MongoUserRepository,
} from '../../auth/repositories/mongo-user.repository';
import {
  IEventCredentialTemplateDocument,
  ITemplateField,
  ITemplateDimensions,
  TemplatePresetId,
} from '../../../db/mongo/models/event-credential-template.model';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../../middlewares/error.middleware';

export interface CreateTemplateInput {
  name: string;
  description?: string;
  presetId?: TemplatePresetId;
  dimensions?: ITemplateDimensions;
  backgroundStoragePath?: string;
  backgroundPublicUrl?: string;
  fields?: ITemplateField[];
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  dimensions?: ITemplateDimensions;
  backgroundStoragePath?: string;
  backgroundPublicUrl?: string;
  fields?: ITemplateField[];
}

export class EventCredentialTemplateService {
  constructor(
    private templateRepo: MongoEventCredentialTemplateRepository = mongoEventCredentialTemplateRepository,
    private renderingService: EventCredentialRenderingService = eventCredentialRenderingService,
    private credentialRepo: MongoEventCredentialRepository = mongoEventCredentialRepository,
    private eventRepo: MongoEventRepository = mongoEventRepository,
    private memberRepo: MongoEventMemberRepository = mongoEventMemberRepository,
    private userRepo: MongoUserRepository = mongoUserRepository
  ) {}

  /**
   * Authorize caller as Host or Coordinator for the event.
   */
  private async authorizeHostOrCoordinator(
    eventId: string,
    callerSupabaseId: string,
    callerPlatformRole?: string
  ): Promise<{ event: any; callerUser: any }> {
    const event = await this.eventRepo.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    const callerUser = await this.userRepo.findBySupabaseId(callerSupabaseId);
    if (!callerUser) {
      throw new AuthorizationError('Caller user profile not found');
    }

    if (callerPlatformRole === 'SUPER_ADMIN' || callerUser.platformRole === 'SUPER_ADMIN') {
      return { event, callerUser };
    }

    const isOwner =
      event.ownerSupabaseId === callerSupabaseId ||
      (event.ownerId && event.ownerId.toString() === callerUser._id.toString());

    if (isOwner) {
      return { event, callerUser };
    }

    const member = await this.memberRepo.findByEventAndUser(eventId, callerUser._id);
    if (!member || !['HOST', 'COORDINATOR'].includes(member.role)) {
      throw new AuthorizationError(
        'Only event Hosts and Coordinators can manage credential templates'
      );
    }

    return { event, callerUser };
  }

  /**
   * Retrieves all templates available for this event (event-specific + global presets).
   */
  async getTemplates(
    eventId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<{
    templates: IEventCredentialTemplateDocument[];
    defaultTemplate: IEventCredentialTemplateDocument | null;
  }> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);
    await this.templateRepo.seedGlobalPresetsIfEmpty();

    const templates = await this.templateRepo.findByEventId(eventId);
    const defaultTemplate = await this.templateRepo.findDefaultByEventId(eventId);

    return { templates, defaultTemplate };
  }

  /**
   * Retrieves a single template by ID.
   */
  async getTemplateById(
    eventId: string,
    templateId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<IEventCredentialTemplateDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new NotFoundError('Credential template not found');
    }

    // Verify template belongs to this event or is a global preset
    if (template.eventId && template.eventId.toString() !== eventId) {
      throw new AuthorizationError('Template does not belong to this event');
    }

    return template;
  }

  /**
   * Creates a custom template for an event.
   */
  async createTemplate(
    eventId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    input: CreateTemplateInput
  ): Promise<IEventCredentialTemplateDocument> {
    const { callerUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    if (!input.name || !input.name.trim()) {
      throw new ValidationError('Template name is required');
    }

    const doc = await this.templateRepo.create({
      eventId: new mongoose.Types.ObjectId(eventId),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      presetId: input.presetId || 'CUSTOM',
      dimensions: input.dimensions || { width: 1620, height: 2025 },
      backgroundStoragePath: input.backgroundStoragePath || null,
      backgroundPublicUrl: input.backgroundPublicUrl || null,
      fields: input.fields || [],
      isDefault: !!input.isDefault,
      createdBy: callerUser._id,
    });

    if (input.isDefault) {
      await this.templateRepo.setDefault(eventId, doc._id.toString());
    }

    return doc;
  }

  /**
   * Clones an existing global preset into a custom event-specific template.
   */
  async cloneFromPreset(
    eventId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    presetId: TemplatePresetId,
    customName?: string
  ): Promise<IEventCredentialTemplateDocument> {
    const { callerUser } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    await this.templateRepo.seedGlobalPresetsIfEmpty();
    const globalPresets = await this.templateRepo.findGlobalPresets();
    const sourcePreset = globalPresets.find((p) => p.presetId === presetId);

    if (!sourcePreset) {
      throw new NotFoundError(`Global preset '${presetId}' not found`);
    }

    const name = customName?.trim() || `${sourcePreset.name} (Custom)`;

    return this.templateRepo.create({
      eventId: new mongoose.Types.ObjectId(eventId),
      name,
      description: sourcePreset.description,
      presetId: sourcePreset.presetId,
      dimensions: sourcePreset.dimensions,
      backgroundStoragePath: sourcePreset.backgroundStoragePath,
      backgroundPublicUrl: sourcePreset.backgroundPublicUrl,
      fields: JSON.parse(JSON.stringify(sourcePreset.fields)),
      isDefault: false,
      createdBy: callerUser._id,
    });
  }

  /**
   * Updates a custom event template.
   */
  async updateTemplate(
    eventId: string,
    templateId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    input: UpdateTemplateInput
  ): Promise<IEventCredentialTemplateDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const existing = await this.templateRepo.findById(templateId);
    if (!existing) {
      throw new NotFoundError('Credential template not found');
    }

    if (!existing.eventId || existing.eventId.toString() !== eventId) {
      throw new AuthorizationError('Global system presets cannot be directly modified');
    }

    const updated = await this.templateRepo.update(templateId, {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dimensions ? { dimensions: input.dimensions } : {}),
      ...(input.backgroundStoragePath !== undefined
        ? { backgroundStoragePath: input.backgroundStoragePath }
        : {}),
      ...(input.backgroundPublicUrl !== undefined
        ? { backgroundPublicUrl: input.backgroundPublicUrl }
        : {}),
      ...(input.fields ? { fields: input.fields } : {}),
    });

    if (!updated) {
      throw new NotFoundError('Template update failed');
    }

    return updated;
  }

  /**
   * Sets a template as the active default for the event.
   */
  async setDefaultTemplate(
    eventId: string,
    templateId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<IEventCredentialTemplateDocument> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const target = await this.templateRepo.findById(templateId);
    if (!target) {
      throw new NotFoundError('Template not found');
    }

    // If target is a global preset, clone it first so the event has an active custom default
    if (!target.eventId) {
      const cloned = await this.cloneFromPreset(
        eventId,
        callerUserId,
        callerPlatformRole,
        target.presetId,
        `${target.name} (Active)`
      );
      const res = await this.templateRepo.setDefault(eventId, cloned._id.toString());
      return res || cloned;
    }

    if (target.eventId.toString() !== eventId) {
      throw new AuthorizationError('Template does not belong to this event');
    }

    const updated = await this.templateRepo.setDefault(eventId, templateId);
    if (!updated) {
      throw new NotFoundError('Failed to set default template');
    }

    return updated;
  }

  /**
   * Deletes a custom event template.
   */
  async deleteTemplate(
    eventId: string,
    templateId: string,
    callerUserId: string,
    callerPlatformRole?: string
  ): Promise<void> {
    await this.authorizeHostOrCoordinator(eventId, callerUserId, callerPlatformRole);

    const existing = await this.templateRepo.findById(templateId);
    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    if (!existing.eventId || existing.eventId.toString() !== eventId) {
      throw new AuthorizationError('Global system presets cannot be deleted');
    }

    await this.templateRepo.delete(templateId);
  }

  /**
   * Generates a simulated preview rendered with Sharp as a Base64 PNG.
   */
  async generatePreview(
    eventId: string,
    templateId: string,
    callerUserId: string,
    callerPlatformRole: string | undefined,
    mockData?: Partial<CredentialRenderData>
  ): Promise<{ previewUrl: string }> {
    const { event } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    const template = await this.getTemplateById(
      eventId,
      templateId,
      callerUserId,
      callerPlatformRole
    );

    const data: Partial<CredentialRenderData> = {
      eventName: mockData?.eventName || event.name || 'Sample Event',
      date: mockData?.date || event.schedule?.startAt
        ? new Date(event.schedule?.startAt).toLocaleDateString()
        : 'October 10, 2026',
      venue: mockData?.venue || event.venue?.name || 'Main Hall',
      name: mockData?.name || 'Rahul Sharma',
      sequence: mockData?.sequence || 'BDG-00001',
      role: mockData?.role || 'PARTICIPANT',
      ...mockData,
    };

    const previewUrl = await this.renderingService.renderPreviewDataUrl(template, data);
    return { previewUrl };
  }

  /**
   * Renders the genuine PNG asset for an issued credential, uploads to Supabase Storage,
   * and updates credential.asset.
   */
  async renderCredentialAsset(
    eventId: string,
    credentialId: string,
    callerUserId: string,
    callerPlatformRole?: string,
    templateId?: string
  ): Promise<any> {
    const { event } = await this.authorizeHostOrCoordinator(
      eventId,
      callerUserId,
      callerPlatformRole
    );

    const credential = await this.credentialRepo.findById(eventId, credentialId);
    if (!credential) {
      throw new NotFoundError('Credential not found');
    }

    let template: IEventCredentialTemplateDocument | null = null;
    if (templateId) {
      template = await this.getTemplateById(
        eventId,
        templateId,
        callerUserId,
        callerPlatformRole
      );
    } else {
      template = await this.templateRepo.findDefaultByEventId(eventId);
    }

    if (!template) {
      await this.templateRepo.seedGlobalPresetsIfEmpty();
      template = await this.templateRepo.findDefaultByEventId(eventId);
    }

    if (!template) {
      throw new NotFoundError('No template available for rendering');
    }

    const renderData: CredentialRenderData = {
      name: credential.holder?.name || 'Unassigned Staff',
      sequence: credential.formattedId,
      verificationToken: credential.verificationToken,
      qrPayload: `https://ticketification.app/verify/${credential.verificationToken}`,
      role: credential.holder?.category || 'PARTICIPANT',
      eventName: event.name,
      date: event.schedule?.startAt
        ? new Date(event.schedule.startAt).toLocaleDateString()
        : '2026-10-10',
      venue: event.venue?.name || 'Main Venue',
    };

    const { storagePath, publicUrl } = await this.renderingService.renderAndUploadAsset(
      eventId,
      credential._id.toString(),
      template,
      renderData
    );

    // Update credential record with asset metadata
    credential.asset = {
      storagePath,
      publicUrl,
      renderedAt: new Date(),
      mimeType: 'image/png',
    };

    await credential.save();

    return credential;
  }
}

export const eventCredentialTemplateService =
  new EventCredentialTemplateService();
