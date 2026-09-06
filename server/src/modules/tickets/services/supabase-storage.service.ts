import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../../../config/env';

export class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucket: string;

  constructor() {
    this.bucket = config.env.supabaseBucket || 'ticket-images';
    if (config.env.supabaseUrl && config.env.supabaseKey) {
      try {
        this.client = createClient(config.env.supabaseUrl, config.env.supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      } catch (err) {
        console.warn('[SupabaseStorageService] Failed to initialize Supabase client:', err);
      }
    }
  }

  public isConfigured(): boolean {
    return !!(this.client && config.env.supabaseUrl && config.env.supabaseKey);
  }

  /**
   * Upload a generated ticket image (Buffer or Base64) to Supabase Storage bucket 'ticket-images'.
   * Returns the permanent public CDN URL.
   */
  async uploadTicketImage(
    fileName: string,
    fileData: Buffer | string,
    contentType: string = 'image/png'
  ): Promise<string | null> {
    if (!this.client) {
      return null;
    }

    try {
      let buffer: Buffer;
      let mimeType = contentType;

      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const match = fileData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            buffer = Buffer.from(match[2], 'base64');
          } else {
            const rawBase64 = fileData.replace(/^data:[^;]+;base64,/, '');
            buffer = Buffer.from(rawBase64, 'base64');
          }
        } else {
          buffer = Buffer.from(fileData, 'utf-8');
        }
      } else {
        buffer = fileData;
      }

      // Ensure bucket exists (ignoring duplicate error if already exists)
      try {
        await this.client.storage.createBucket(this.bucket, {
          public: true,
        });
      } catch (_bucketErr) {
        // Bucket already exists or insufficient permission to create
      }

      // Upload file to Supabase Storage with upsert
      const { data, error } = await this.client.storage
        .from(this.bucket)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn(`[SupabaseStorageService] Upload error for ${fileName}:`, error.message);
        return null;
      }

      // Retrieve public URL
      const { data: urlData } = this.client.storage.from(this.bucket).getPublicUrl(data.path);
      return urlData.publicUrl || null;
    } catch (err: any) {
      console.warn(`[SupabaseStorageService] Exception during upload for ${fileName}:`, err.message);
      return null;
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
