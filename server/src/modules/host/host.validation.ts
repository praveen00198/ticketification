import { ValidationError } from '../../middlewares/error.middleware';
import { OnboardingInput, UpdateHostProfileInput, InstitutionType } from './host.types';

const VALID_INSTITUTION_TYPES: InstitutionType[] = [
  'COLLEGE_UNIVERSITY',
  'CORPORATE',
  'COMMUNITY_CLUB',
  'INDEPENDENT',
];

function parseAndValidateUrl(rawWeb: string): string {
  if (rawWeb.length > 255) {
    throw new ValidationError('Website URL cannot exceed 255 characters.');
  }

  let parsedUrl: URL;
  try {
    if (rawWeb.includes('://')) {
      parsedUrl = new URL(rawWeb);
    } else {
      parsedUrl = new URL(`https://${rawWeb}`);
    }
  } catch {
    throw new ValidationError('Invalid website URL format.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ValidationError('Website must use http:// or https:// protocol.');
  }

  return parsedUrl.toString();
}

export function validateOnboardingInput(body: any): OnboardingInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  // 1. Organization Name (Required)
  const organizationName = typeof body.organizationName === 'string' ? body.organizationName.trim() : '';
  if (!organizationName) {
    throw new ValidationError('Organization name is required and cannot be empty.');
  }
  if (organizationName.length < 2 || organizationName.length > 120) {
    throw new ValidationError('Organization name must be between 2 and 120 characters.');
  }

  // 2. Institution Type (Required)
  const institutionType = body.institutionType as InstitutionType;
  if (!institutionType || !VALID_INSTITUTION_TYPES.includes(institutionType)) {
    throw new ValidationError(
      `Invalid institution type: "${institutionType}". Allowed: ${VALID_INSTITUTION_TYPES.join(', ')}`
    );
  }

  // 3. Institution Name (Conditional / Optional)
  let institutionName: string | null = null;
  if (body.institutionName !== undefined && body.institutionName !== null) {
    const rawInst = String(body.institutionName).trim();
    if (rawInst.length > 150) {
      throw new ValidationError('Institution name cannot exceed 150 characters.');
    }
    institutionName = rawInst.length > 0 ? rawInst : null;
  }

  // If College/University is selected and institutionName is provided, validate length
  if (institutionType === 'COLLEGE_UNIVERSITY' && !institutionName) {
    // If not provided, we can allow null or require institutionName
    // Best practice: encourage but allow if unknown, or set default to organizationName
  }

  // 4. Website URL (Optional)
  let website: string | null = null;
  if (body.website !== undefined && body.website !== null) {
    const rawWeb = String(body.website).trim();
    if (rawWeb.length > 0) {
      website = parseAndValidateUrl(rawWeb);
    }
  }

  // 5. Phone Number (Optional)
  let phone: string | null = null;
  if (body.phone !== undefined && body.phone !== null) {
    const rawPhone = String(body.phone).trim();
    if (rawPhone.length > 0) {
      if (rawPhone.length > 30) {
        throw new ValidationError('Phone number cannot exceed 30 characters.');
      }
      // Support international phone with digits, +, spaces, hyphens, parentheses
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,20}$/;
      if (!phoneRegex.test(rawPhone)) {
        throw new ValidationError('Invalid phone number format.');
      }
      phone = rawPhone;
    }
  }

  // 6. Bio (Optional)
  let bio: string | null = null;
  if (body.bio !== undefined && body.bio !== null) {
    const rawBio = String(body.bio).trim();
    if (rawBio.length > 500) {
      throw new ValidationError('Bio cannot exceed 500 characters.');
    }
    bio = rawBio.length > 0 ? rawBio : null;
  }

  // 7. Logo URL (Optional)
  let logoUrl: string | null = null;
  if (body.logoUrl !== undefined && body.logoUrl !== null) {
    const rawLogo = String(body.logoUrl).trim();
    if (rawLogo.length > 0) {
      logoUrl = rawLogo;
    }
  }

  return {
    organizationName,
    institutionType,
    institutionName,
    website,
    phone,
    bio,
    logoUrl,
  };
}

export function validateUpdateHostProfileInput(body: any): UpdateHostProfileInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  const updates: UpdateHostProfileInput = {};

  if (body.organizationName !== undefined) {
    const org = String(body.organizationName).trim();
    if (!org) {
      throw new ValidationError('Organization name cannot be empty.');
    }
    if (org.length < 2 || org.length > 120) {
      throw new ValidationError('Organization name must be between 2 and 120 characters.');
    }
    updates.organizationName = org;
  }

  if (body.institutionType !== undefined) {
    const it = body.institutionType as InstitutionType;
    if (!VALID_INSTITUTION_TYPES.includes(it)) {
      throw new ValidationError(
        `Invalid institution type: "${it}". Allowed: ${VALID_INSTITUTION_TYPES.join(', ')}`
      );
    }
    updates.institutionType = it;
  }

  if (body.institutionName !== undefined) {
    const inst = body.institutionName ? String(body.institutionName).trim() : null;
    if (inst && inst.length > 150) {
      throw new ValidationError('Institution name cannot exceed 150 characters.');
    }
    updates.institutionName = inst;
  }

  if (body.website !== undefined) {
    const web = body.website ? String(body.website).trim() : null;
    if (web && web.length > 0) {
      updates.website = parseAndValidateUrl(web);
    } else {
      updates.website = null;
    }
  }

  if (body.phone !== undefined) {
    const ph = body.phone ? String(body.phone).trim() : null;
    if (ph && ph.length > 0) {
      if (ph.length > 30) {
        throw new ValidationError('Phone number cannot exceed 30 characters.');
      }
      const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{4,20}$/;
      if (!phoneRegex.test(ph)) {
        throw new ValidationError('Invalid phone number format.');
      }
      updates.phone = ph;
    } else {
      updates.phone = null;
    }
  }

  if (body.bio !== undefined) {
    const bio = body.bio ? String(body.bio).trim() : null;
    if (bio && bio.length > 500) {
      throw new ValidationError('Bio cannot exceed 500 characters.');
    }
    updates.bio = bio;
  }

  if (body.logoUrl !== undefined) {
    updates.logoUrl = body.logoUrl ? String(body.logoUrl).trim() : null;
  }

  return updates;
}
