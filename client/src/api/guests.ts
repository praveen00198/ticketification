import { apiClient } from './client';

export interface HeaderAnalysisData {
  importId: string;
  fileName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, any>[];
  detectedMappings: Record<string, string>;
  detectedCategories: string[];
  confidenceScores: Record<string, number>;
}

export interface RowErrorDetail {
  rowNumber: number;
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface ValidationSummaryData {
  importId: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  warningRowsCount: number;
  duplicateRowsCount: number;
  errors: RowErrorDetail[];
  sampleValidRows: Array<{
    rowNumber: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    organization: string | null;
    designation: string | null;
    category: string;
    count: number;
  }>;
}

export interface ImportConfirmationResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  importId: string;
}

export const guestsApi = {
  async uploadFile(eventId: string, file: File): Promise<HeaderAnalysisData> {
    const formData = new FormData();
    formData.append('file', file);

    const res: any = await apiClient.post(`/guests/events/${eventId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  async validateImport(
    eventId: string,
    payload: {
      importId: string;
      columnMapping: Record<string, string>;
      requiredFields: string[];
      categoryMapping: Record<string, string>;
      defaultCategory?: string;
    }
  ): Promise<ValidationSummaryData> {
    const res: any = await apiClient.post(`/guests/events/${eventId}/validate`, payload);
    return res.data;
  },

  async confirmImport(
    eventId: string,
    payload: {
      importId: string;
      skipDuplicates?: boolean;
    }
  ): Promise<ImportConfirmationResult> {
    const res: any = await apiClient.post(`/guests/events/${eventId}/confirm`, payload);
    return res.data;
  },

  async getGuests(eventId: string, limit = 500, offset = 0) {
    const res: any = await apiClient.get(`/guests/events/${eventId}`, {
      params: { limit, offset },
    });
    return res.data;
  },

  async getImportHistory(eventId: string) {
    const res: any = await apiClient.get(`/guests/events/${eventId}/imports`);
    return res.data;
  },
};
