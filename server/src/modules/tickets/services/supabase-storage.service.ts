import fs from 'fs';
import config from '../../../config/env';
import { supabaseAdmin } from '../../../config/supabase';

export class SupabaseStorageService {
  private bucket: string;

  constructor() {
    this.bucket = config.env.supabaseBucket || 'ticket-images';
  }

  public isConfigured(): boolean {
    return !!(supabaseAdmin && config.env.supabaseUrl);
  }

  /**
   * Upload a generated ticket image (Buffer, File path, or Base64) to Supabase Storage bucket 'ticket-images'.
   * Returns the permanent public CDN URL.
   */
  async uploadTicketImage(
    fileName: string,
    fileData: Buffer | string,
    contentType: string = 'image/png'
  ): Promise<string | null> {
    if (!supabaseAdmin) {
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
        } else if (fs.existsSync(fileData)) {
          buffer = fs.readFileSync(fileData);
        } else {
          buffer = Buffer.from(fileData, 'utf-8');
        }
      } else {
        buffer = fileData;
      }

      // Ensure bucket exists (ignoring duplicate error if already exists)
      try {
        await supabaseAdmin.storage.createBucket(this.bucket, {
          public: true,
        });
      } catch (_bucketErr) {
        // Bucket already exists or handled
      }

      // Upload file to Supabase Storage with upsert
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucket)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.warn(`[SupabaseStorageService] Upload error for ${fileName}:`, error.message);
        return null;
      }

      // Retrieve public URL safely
      const { data: urlData } = supabaseAdmin.storage.from(this.bucket).getPublicUrl(data?.path || fileName);
      return urlData?.publicUrl || null;
    } catch (err: any) {
      console.warn(`[SupabaseStorageService] Exception during upload for ${fileName}:`, err.message);
      return null;
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
