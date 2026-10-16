import fs from 'fs';
import config from '../../../config/env';
import { supabaseStorageAdmin, supabaseAdmin } from '../../../config/supabase';
import { StorageError } from '../../../middlewares/error.middleware';

export class SupabaseStorageService {
  private bucket: string;
  private bucketEnsured = false;

  private get client() {
    return supabaseStorageAdmin || supabaseAdmin;
  }

  constructor() {
    this.bucket = config.env.supabaseBucket || 'ticket-images';
  }

  public isConfigured(): boolean {
    return !!(this.client && config.env.supabaseUrl);
  }

  public getBucketName(): string {
    return this.bucket;
  }

  /**
   * Constructs the canonical storage path hierarchy: events/{eventId}/tickets/{filename}
   */
  public buildTicketStoragePath(eventId: string, filename: string): string {
    const cleanEventId = (eventId || '').trim().replace(/^\/+|\/+$/g, '');
    const cleanFilename = (filename || '').trim().replace(/^\/+|\/+$/g, '');
    return `events/${cleanEventId}/tickets/${cleanFilename}`;
  }

  /**
   * Parses a canonical storage path into eventId and filename.
   */
  public parseTicketStoragePath(storagePath: string): { eventId: string; filename: string } | null {
    const clean = (storagePath || '').trim().replace(/^\/+|\/+$/g, '');
    const match = clean.match(/^events\/([^/]+)\/tickets\/([^/]+)$/);
    if (!match) return null;
    return {
      eventId: match[1],
      filename: match[2],
    };
  }

  /**
   * Ensures the target bucket exists and is configured for public access.
   */
  public async ensureBucket(): Promise<void> {
    if (this.bucketEnsured || !this.client) return;
    try {
      const { data: bucket, error } = await this.client.storage.getBucket(this.bucket);
      if (error || !bucket) {
        const { error: createErr } = await this.client.storage.createBucket(this.bucket, {
          public: false,
        });
        if (createErr && !createErr.message.includes('already exists')) {
          console.warn('[SupabaseStorageService] Bucket creation note:', createErr.message);
        }
      }
      this.bucketEnsured = true;
    } catch (bucketErr: any) {
      console.warn('[SupabaseStorageService] Bucket check exception:', bucketErr?.message || bucketErr);
      this.bucketEnsured = true;
    }
  }

  /**
   * Upload a generated ticket image to Supabase Storage.
   * Format is strictly image/png by default.
   * Throws StorageError on failure to ensure zero silent fallbacks.
   */
  async uploadTicketImage(
    storagePath: string,
    fileData: Buffer | string,
    contentType: string = 'image/png'
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!this.client) {
      throw new StorageError(
        'Supabase Storage is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in environment variables.'
      );
    }

    await this.ensureBucket();

    let buffer: Buffer;
    let mimeType = contentType;

    if (typeof fileData === 'string') {
      if (fileData.startsWith('data:')) {
        const match = fileData.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          buffer = Buffer.from(match[2], 'base64');
        } else {
          const rawBase64 = fileData.replace(/^data:[^;]+;base64,/, '');
          buffer = Buffer.from(rawBase64, 'base64');
        }
      } else if (fs.existsSync(fileData)) {
        if (fileData.endsWith('.png')) mimeType = 'image/png';
        buffer = fs.readFileSync(fileData);
      } else {
        buffer = Buffer.from(fileData, 'utf-8');
      }
    } else {
      buffer = fileData;
    }

    const cleanPath = storagePath.replace(/^\/+/, '');

    let uploadData: any = null;
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .upload(cleanPath, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error) {
        uploadData = data;
        lastError = null;
        break;
      }

      lastError = error;
      console.warn(
        `[SupabaseStorageService] Upload attempt ${attempt}/${maxRetries} failed for ${cleanPath}: ${error.message}`
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }

    if (lastError) {
      console.error(`[SupabaseStorageService] Upload permanently failed for ${cleanPath}:`, lastError);
      throw new StorageError(
        `Failed to upload ticket image to Supabase Storage (${cleanPath}): ${lastError.message}`
      );
    }

    const { data: urlData } = this.client.storage
      .from(this.bucket)
      .getPublicUrl(uploadData?.path || cleanPath);

    if (!urlData?.publicUrl) {
      throw new StorageError(
        `Failed to obtain public URL for uploaded ticket (${cleanPath}) from Supabase Storage`
      );
    }

    return {
      publicUrl: urlData.publicUrl,
      storagePath: cleanPath,
    };
  }

  /**
   * Download a ticket asset buffer from Supabase Storage.
   */
  async downloadTicketImage(storagePath: string): Promise<Buffer> {
    if (!this.client) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    let cleanPath = storagePath.replace(/^\/+/, '');
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const marker = `/storage/v1/object/public/${this.bucket}/`;
      const idx = cleanPath.indexOf(marker);
      if (idx !== -1) {
        cleanPath = cleanPath.substring(idx + marker.length);
      }
    }
    if (cleanPath.startsWith(`${this.bucket}/`)) {
      cleanPath = cleanPath.substring(this.bucket.length + 1);
    }

    const { data, error } = await this.client.storage.from(this.bucket).download(cleanPath);
    if (error || !data) {
      throw new StorageError(
        `Failed to download ticket asset from Supabase Storage (${cleanPath}): ${error?.message || 'Not found'}`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Delete a single ticket asset from Supabase Storage.
   */
  async deleteTicketImage(storagePath: string): Promise<boolean> {
    if (!this.client) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    const cleanPath = storagePath.replace(/^\/+/, '');
    const { error } = await this.client.storage.from(this.bucket).remove([cleanPath]);

    if (error) {
      throw new StorageError(
        `Failed to delete ticket asset from Supabase Storage (${cleanPath}): ${error.message}`
      );
    }

    return true;
  }

  /**
   * Batch delete multiple ticket assets from Supabase Storage.
   */
  async deleteTicketImages(storagePaths: string[]): Promise<number> {
    if (!this.client) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    if (storagePaths.length === 0) return 0;

    const cleanPaths = storagePaths.map((p) => p.replace(/^\/+/, ''));
    const { data, error } = await this.client.storage.from(this.bucket).remove(cleanPaths);

    if (error) {
      throw new StorageError(
        `Failed to batch delete ticket assets from Supabase Storage: ${error.message}`
      );
    }

    return data?.length || cleanPaths.length;
  }

  /**
   * Storage service health check.
   */
  async checkHealth(): Promise<{ configured: boolean; bucket: string; ready: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        bucket: this.bucket,
        ready: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      };
    }

    try {
      const { data, error } = await this.client!.storage.getBucket(this.bucket);
      if (error) {
        return {
          configured: true,
          bucket: this.bucket,
          ready: false,
          error: error.message,
        };
      }
      return {
        configured: true,
        bucket: this.bucket,
        ready: !!data,
      };
    } catch (err: any) {
      return {
        configured: true,
        bucket: this.bucket,
        ready: false,
        error: err?.message || 'Health check error',
      };
    }
  }

  /**
   * Constructs the canonical storage path for host assets: hosts/{userId}/assets/{filename}
   */
  public buildHostAssetStoragePath(userId: string, filename: string): string {
    const cleanUserId = (userId || '').trim().replace(/^\/+|\/+$/g, '');
    const cleanFilename = (filename || '').trim().replace(/^\/+|\/+$/g, '');
    return `hosts/${cleanUserId}/assets/${cleanFilename}`;
  }

  /**
   * Upload an organizer asset (e.g. logo or banner) to Supabase Storage.
   */
  async uploadHostAsset(
    userId: string,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!this.client) {
      throw new StorageError(
        'Supabase Storage is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
      );
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new StorageError(`Unsupported asset type: ${mimeType}. Allowed: PNG, JPEG, WEBP, SVG`);
    }

    if (fileData.length > 2 * 1024 * 1024) {
      throw new StorageError('Asset size exceeds the 2MB limit.');
    }

    await this.ensureBucket();

    const ext = filename.split('.').pop() || 'png';
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
    const safeFilename = `logo-${Date.now()}.${sanitizedExt}`;
    const storagePath = this.buildHostAssetStoragePath(userId, safeFilename);

    const { error: uploadError } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new StorageError(`Failed to upload host asset to Supabase Storage: ${uploadError.message}`);
    }

    const { data: urlData } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);
    return {
      publicUrl: urlData.publicUrl,
      storagePath,
    };
  }

  /**
   * Constructs the canonical storage path for event banners: events/banners/{userId}/{filename}
   */
  public buildEventBannerStoragePath(userId: string, filename: string): string {
    const cleanUserId = (userId || '').trim().replace(/^\/+|\/+$/g, '');
    const cleanFilename = (filename || '').trim().replace(/^\/+|\/+$/g, '');
    return `events/banners/${cleanUserId}/${cleanFilename}`;
  }

  /**
   * Upload an event banner asset to Supabase Storage.
   */
  async uploadEventBanner(
    userId: string,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!this.client) {
      throw new StorageError(
        'Supabase Storage is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
      );
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new StorageError(`Unsupported banner image type: ${mimeType}. Allowed: PNG, JPEG, WEBP`);
    }

    if (fileData.length > 5 * 1024 * 1024) {
      throw new StorageError('Banner image size exceeds the 5MB limit.');
    }

    await this.ensureBucket();

    const ext = filename.split('.').pop() || 'png';
    const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
    const safeFilename = `banner-${Date.now()}.${sanitizedExt}`;
    const storagePath = this.buildEventBannerStoragePath(userId, safeFilename);

    const { error: uploadError } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new StorageError(`Failed to upload event banner to Supabase Storage: ${uploadError.message}`);
    }

    const { data: urlData } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);
    return {
      publicUrl: urlData.publicUrl,
      storagePath,
    };
  }

  /**
   * Remove a host asset by storage path.
   */
  async removeHostAsset(storagePath: string): Promise<void> {
    if (!this.client || !storagePath) return;
    try {
      await this.client.storage.from(this.bucket).remove([storagePath]);
    } catch (err: any) {
      console.warn('[SupabaseStorageService] Could not remove old host asset:', err.message);
    }
  }

  /**
   * Upload an official verification document (PDF, PNG, JPEG, WEBP) for an event.
   * Path: events/{eventId}/verification/{timestamp}_{filename}
   */
  async uploadVerificationDocument(
    eventId: string,
    fileData: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!this.client) {
      throw new StorageError(
        'Supabase Storage is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
      );
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];

    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new StorageError(
        `Unsupported document type: ${mimeType}. Allowed: PDF, PNG, JPEG, WEBP`
      );
    }

    if (fileData.length > 10 * 1024 * 1024) {
      throw new StorageError('Verification document size exceeds the 10MB limit.');
    }

    await this.ensureBucket();

    const sanitizedBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFilename = `${Date.now()}_${sanitizedBase}`;
    const storagePath = `events/${eventId}/verification/${safeFilename}`;

    const { error: uploadError } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw new StorageError(
        `Failed to upload verification document to Supabase Storage: ${uploadError.message}`
      );
    }

    const { data: urlData } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);
    return {
      publicUrl: urlData.publicUrl,
      storagePath,
    };
  }

  /**
   * Upload an export file (ZIP, XLSX, CSV) to Supabase Storage: events/{eventId}/exports/{filename}
   */
  async uploadExportFile(
    eventId: string,
    fileData: Buffer | fs.ReadStream | NodeJS.ReadableStream | any,
    filename: string,
    mimeType: string
  ): Promise<{ storagePath: string; publicUrl?: string; signedUrl?: string }> {
    if (!this.client) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    await this.ensureBucket();
    const sanitizedBase = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `events/${eventId}/exports/${sanitizedBase}`;

    const uploadOptions: any = {
      contentType: mimeType,
      upsert: true,
    };
    if (fileData && typeof (fileData as any).pipe === 'function') {
      uploadOptions.duplex = 'half';
    }

    const { error: uploadError } = await this.client.storage
      .from(this.bucket)
      .upload(storagePath, fileData, uploadOptions);

    if (uploadError) {
      throw new StorageError(`Failed to upload export file to Supabase Storage: ${uploadError.message}`);
    }

    // Generate signed download URL valid for 24 hours (86400s) with attachment content-disposition
    let signedUrl: string | undefined;
    const { data: signedData, error: signedErr } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, 86400, { download: sanitizedBase } as any);

    if (signedErr || !signedData?.signedUrl) {
      throw new StorageError(
        `Failed to generate signed download URL for export: ${signedErr?.message || 'Unknown error'}`
      );
    }
    signedUrl = signedData.signedUrl;

    return {
      storagePath,
      signedUrl,
      publicUrl: signedUrl,
    };
  }

  /**
   * Create a presigned download URL for a stored asset.
   * Enforces private storage access; never falls back to public URLs.
   */
  async createPresignedDownloadUrl(
    storagePath: string,
    expiresInSeconds: number = 900,
    options?: { download?: string | boolean }
  ): Promise<string> {
    if (!this.client) {
      throw new StorageError('Supabase Storage is not configured.');
    }
    const cleanPath = storagePath.replace(/^\/+/, '');

    const signedOptions: any = {};
    if (options?.download) {
      signedOptions.download = options.download;
    }

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(
        cleanPath,
        expiresInSeconds,
        Object.keys(signedOptions).length > 0 ? signedOptions : undefined
      );

    if (error || !data?.signedUrl) {
      throw new StorageError(
        `Failed to generate signed download URL for private asset (${cleanPath}): ${error?.message || 'Unknown error'}`
      );
    }
    return data.signedUrl;
  }

  /**
   * Lists files in a given storage folder prefix.
   */
  async listFolder(
    folderPath: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Array<{ name: string; id?: string; sizeBytes: number; createdAt: string; storagePath: string }>> {
    if (!this.client) return [];
    await this.ensureBucket();
    const cleanFolder = (folderPath || '').trim().replace(/^\/+|\/+$/g, '');
    try {
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .list(cleanFolder, {
          limit: options?.limit || 1000,
          offset: options?.offset || 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error || !data) {
        return [];
      }

      return data
        .filter((item: any) => item.name && item.name !== '.emptyFolderPlaceholder')
        .map((item: any) => {
          const sizeBytes = item.metadata?.size || item.size || 0;
          return {
            name: item.name,
            id: item.id,
            sizeBytes,
            createdAt: item.created_at || item.updated_at || new Date().toISOString(),
            storagePath: cleanFolder ? `${cleanFolder}/${item.name}` : item.name,
          };
        });
    } catch (err: any) {
      console.warn(`[SupabaseStorageService] listFolder error for (${folderPath}):`, err?.message);
      return [];
    }
  }

  /**
   * Deletes one or more files from Supabase Storage by paths.
   */
  async deleteFiles(storagePaths: string[]): Promise<{ deletedCount: number; errors?: string[] }> {
    if (!this.client || !storagePaths.length) {
      return { deletedCount: 0 };
    }
    await this.ensureBucket();
    const cleanPaths = storagePaths.map((p) => (p || '').trim().replace(/^\/+/, '')).filter(Boolean);
    if (!cleanPaths.length) return { deletedCount: 0 };

    try {
      const { data, error } = await this.client.storage.from(this.bucket).remove(cleanPaths);
      if (error) {
        console.warn('[SupabaseStorageService] deleteFiles error:', error.message);
        return { deletedCount: 0, errors: [error.message] };
      }
      return { deletedCount: Array.isArray(data) ? data.length : cleanPaths.length };
    } catch (err: any) {
      console.warn('[SupabaseStorageService] deleteFiles exception:', err?.message);
      return { deletedCount: 0, errors: [err?.message] };
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
