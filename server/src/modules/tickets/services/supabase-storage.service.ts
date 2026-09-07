import fs from 'fs';
import config from '../../../config/env';
import { supabaseAdmin } from '../../../config/supabase';

export class SupabaseStorageService {
  private bucket: string;
  private bucketEnsured = false;

  constructor() {
    this.bucket = config.env.supabaseBucket || 'ticket-images';
  }

  public isConfigured(): boolean {
    return !!(supabaseAdmin && config.env.supabaseUrl);
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured || !supabaseAdmin) return;
    try {
      await supabaseAdmin.storage.createBucket(this.bucket, {
        public: true,
      });
      this.bucketEnsured = true;
    } catch (_bucketErr) {
      this.bucketEnsured = true;
    }
  }

  /**
   * Upload a generated ticket image (Buffer, File path, SVG string, or Base64) to Supabase Storage.
   * Returns the permanent public CDN URL.
   */
  async uploadTicketImage(
    fileName: string,
    fileData: Buffer | string,
    contentType: string = 'image/svg+xml'
  ): Promise<string | null> {
    if (!supabaseAdmin) {
      return null;
    }

    try {
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
