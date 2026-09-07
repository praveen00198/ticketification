export type TargetField =
  | 'name'
  | 'email'
  | 'phone'
  | 'organization'
  | 'designation'
  | 'category'
  | 'count'
  | 'ignore';

export interface HeaderAnalysisResult {
  importId: string;
  fileName: string;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, any>[];
  detectedMappings: Record<string, string>;
  detectedCategories: string[];
  confidenceScores: Record<string, number>;
}

export interface ValidateImportDTO {
  importId: string;
  columnMapping: Record<string, string>;
  requiredFields?: string[];
  categoryMapping?: Record<string, string>;
  defaultCategory?: string;
}

export interface RowError {
  rowNumber: number;
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface SampleValidRow {
  rowNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  designation: string | null;
  category: string;
  count: number;
}

export interface ValidationResult {
  importId: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  warningRowsCount: number;
  duplicateRowsCount: number;
  errors: RowError[];
  sampleValidRows: SampleValidRow[];
}

export interface ConfirmImportDTO {
  importId: string;
  skipDuplicates?: boolean;
}

export interface ConfirmImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  importId: string;
}
