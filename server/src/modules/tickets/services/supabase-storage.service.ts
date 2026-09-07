import fs from 'fs';
import config from '../../../config/env';
import { supabaseAdmin } from '../../../config/supabase';
import { AppError } from '../../../middlewares/error.middleware';

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

  private async ensureBucket(): Promise<void> {
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
   * Upload a generated ticket image (Buffer, File path, SVG string, or Base64) to Supabase Storage.
   * Returns the permanent public CDN URL and canonical storage path.
   * Throws AppError on failure to ensure zero silent corruptions.
   */
  async uploadTicketImage(
    storagePath: string,
    fileData: Buffer | string,
    contentType: string = 'image/svg+xml'
  ): Promise<{ publicUrl: string; storagePath: string }> {
    if (!supabaseAdmin) {
      throw new AppError(
        'Supabase Storage is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be provided in environment variables.',
        500
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
      } else if (fileData.startsWith('<svg') || fileData.includes('<svg')) {
        mimeType = 'image/svg+xml';
        buffer = Buffer.from(fileData, 'utf-8');
      } else if (fs.existsSync(fileData)) {
        if (fileData.endsWith('.svg')) mimeType = 'image/svg+xml';
        else if (fileData.endsWith('.png')) mimeType = 'image/png';
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
      throw new AppError(
        `Failed to upload ticket image to Supabase Storage (${cleanPath}): ${lastError.message}`,
        500
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(this.bucket)
      .getPublicUrl(uploadData?.path || cleanPath);

    if (!urlData?.publicUrl) {
      throw new AppError(
        `Failed to obtain public URL for uploaded ticket (${cleanPath}) from Supabase Storage`,
        500
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
      throw new AppError('Supabase Storage is not configured.', 500);
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
      throw new AppError(
        `Failed to download ticket asset from Supabase Storage (${cleanPath}): ${error?.message || 'Not found'}`,
        404
      );
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export const supabaseStorageService = new SupabaseStorageService();
