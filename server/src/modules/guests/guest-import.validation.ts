import { ValidationError } from '../../middlewares/error.middleware';
import { ValidateImportDTO, ConfirmImportDTO, TargetField } from './guest-import.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TARGET_FIELDS = new Set<TargetField>([
  'name',
  'email',
  'phone',
  'organization',
  'designation',
  'category',
  'count',
  'ignore',
]);

export function validateEventIdParam(eventId: unknown): string {
  if (typeof eventId !== 'string' || !eventId.trim()) {
    throw new ValidationError('Event ID is required', [{ field: 'eventId', message: 'Event ID must be a non-empty string' }]);
  }
  const cleanId = eventId.trim();
  if (!UUID_REGEX.test(cleanId)) {
    throw new ValidationError('Invalid Event ID format', [{ field: 'eventId', message: 'Event ID must be a valid UUID' }]);
  }
  return cleanId;
}

export function validateImportConfig(input: unknown): ValidateImportDTO {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Validation payload must be a JSON object');
  }

  const payload = input as Record<string, any>;
  const errors: Array<{ field: string; message: string }> = [];

  // Validate importId
  if (!payload.importId || typeof payload.importId !== 'string' || !payload.importId.trim()) {
    errors.push({ field: 'importId', message: 'Import ID is required' });
  } else if (!UUID_REGEX.test(payload.importId.trim())) {
    errors.push({ field: 'importId', message: 'Import ID must be a valid UUID' });
  }

  // Validate columnMapping
  if (!payload.columnMapping || typeof payload.columnMapping !== 'object' || Array.isArray(payload.columnMapping)) {
    errors.push({ field: 'columnMapping', message: 'Column mapping must be a non-empty object' });
  } else {
    const keys = Object.keys(payload.columnMapping);
    if (keys.length === 0) {
      errors.push({ field: 'columnMapping', message: 'Column mapping must contain at least one column' });
    } else {
      for (const [header, target] of Object.entries(payload.columnMapping)) {
        if (typeof target !== 'string' || !VALID_TARGET_FIELDS.has(target as TargetField)) {
          errors.push({
            field: `columnMapping.${header}`,
            message: `Invalid target field "${target}". Allowed fields: ${Array.from(VALID_TARGET_FIELDS).join(', ')}`,
          });
        }
      }
    }
  }

  // Validate requiredFields (optional array)
  let requiredFields: string[] | undefined;
  if (payload.requiredFields !== undefined) {
    if (!Array.isArray(payload.requiredFields)) {
      errors.push({ field: 'requiredFields', message: 'Required fields must be an array of strings' });
    } else {
      requiredFields = payload.requiredFields
        .filter((f) => typeof f === 'string' && f.trim().length > 0)
        .map((f) => f.trim().toLowerCase());
    }
  }

  // Validate categoryMapping (optional object)
  let categoryMapping: Record<string, string> | undefined;
  if (payload.categoryMapping !== undefined) {
    if (typeof payload.categoryMapping !== 'object' || Array.isArray(payload.categoryMapping) || payload.categoryMapping === null) {
      errors.push({ field: 'categoryMapping', message: 'Category mapping must be an object' });
    } else {
      categoryMapping = {};
      for (const [k, v] of Object.entries(payload.categoryMapping)) {
        if (typeof v === 'string') {
          categoryMapping[k] = v.trim();
        }
      }
    }
  }

  // Validate defaultCategory (optional string)
  let defaultCategory: string | undefined;
  if (payload.defaultCategory !== undefined) {
    if (typeof payload.defaultCategory !== 'string') {
      errors.push({ field: 'defaultCategory', message: 'Default category must be a string' });
    } else {
      defaultCategory = payload.defaultCategory.trim() || 'GENERAL';
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid import validation configuration', errors);
  }

  return {
    importId: payload.importId.trim(),
    columnMapping: payload.columnMapping,
    requiredFields,
    categoryMapping,
    defaultCategory: defaultCategory || 'GENERAL',
  };
}

export function validateConfirmConfig(input: unknown): ConfirmImportDTO {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('Confirm payload must be a JSON object');
  }

  const payload = input as Record<string, any>;
  const errors: Array<{ field: string; message: string }> = [];

  // Validate importId
  if (!payload.importId || typeof payload.importId !== 'string' || !payload.importId.trim()) {
    errors.push({ field: 'importId', message: 'Import ID is required' });
  } else if (!UUID_REGEX.test(payload.importId.trim())) {
    errors.push({ field: 'importId', message: 'Import ID must be a valid UUID' });
  }

  // Validate skipDuplicates (optional boolean)
  let skipDuplicates = false;
  if (payload.skipDuplicates !== undefined) {
    if (typeof payload.skipDuplicates !== 'boolean') {
      errors.push({ field: 'skipDuplicates', message: 'Skip duplicates must be a boolean' });
    } else {
      skipDuplicates = payload.skipDuplicates;
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid import confirmation payload', errors);
  }

  return {
    importId: payload.importId.trim(),
    skipDuplicates,
  };
}
