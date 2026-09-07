import fs from 'fs';
import config from '../../../config/env';
import { supabaseAdmin } from '../../../config/supabase';
import { StorageError } from '../../../middlewares/error.middleware';

export class SupabaseStorageService {
  private bucket: string;
  private bucketEnsured = false;

  constructor() {
    this.bucket = config.env.supabaseBucket || 'ticket-images';
  }

  public isConfigured(): boolean {
    return !!(supabaseAdmin && config.env.supabaseUrl);
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
    if (this.bucketEnsured || !supabaseAdmin) return;
    try {
      const { data: bucket, error } = await supabaseAdmin.storage.getBucket(this.bucket);
      if (error || !bucket) {
        const { error: createErr } = await supabaseAdmin.storage.createBucket(this.bucket, {
          public: true,
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
    if (!supabaseAdmin) {
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
      const { data, error } = await supabaseAdmin.storage
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

    const { data: urlData } = supabaseAdmin.storage
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
    if (!supabaseAdmin) {
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

    const { data, error } = await supabaseAdmin.storage.from(this.bucket).download(cleanPath);
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
    if (!supabaseAdmin) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    const cleanPath = storagePath.replace(/^\/+/, '');
    const { error } = await supabaseAdmin.storage.from(this.bucket).remove([cleanPath]);

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
    if (!supabaseAdmin) {
      throw new StorageError('Supabase Storage is not configured.');
    }

    if (storagePaths.length === 0) return 0;

    const cleanPaths = storagePaths.map((p) => p.replace(/^\/+/, ''));
    const { data, error } = await supabaseAdmin.storage.from(this.bucket).remove(cleanPaths);

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
      const { data, error } = await supabaseAdmin!.storage.getBucket(this.bucket);
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
}

export const supabaseStorageService = new SupabaseStorageService();
