import { ValidationError } from '../../middlewares/error.middleware';
import { CreateSingleGuestDTO, UpdateGuestDTO, GuestFilterOptions } from './guest.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateGuestInput(body: any): CreateSingleGuestDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim().toUpperCase() : 'GENERAL';

  if (!name) {
    throw new ValidationError('Guest name is required.');
  }
  if (name.length < 1 || name.length > 200) {
    throw new ValidationError('Guest name must be between 1 and 200 characters.');
  }

  let email: string | null = null;
  if (body.email && typeof body.email === 'string' && body.email.trim()) {
    const cleanEmail = body.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      throw new ValidationError('Please provide a valid email address.');
    }
    email = cleanEmail;
  }

  return {
    name,
    category: category || 'GENERAL',
    email,
    phone: typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
    organization: typeof body.organization === 'string' && body.organization.trim() ? body.organization.trim() : null,
    designation: typeof body.designation === 'string' && body.designation.trim() ? body.designation.trim() : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  };
}

export function validateUpdateGuestInput(body: any): UpdateGuestDTO {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const result: UpdateGuestDTO = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('Guest name cannot be empty.');
    result.name = name;
  }

  if (body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category.trim().toUpperCase() : '';
    if (!category) throw new ValidationError('Category cannot be empty.');
    result.category = category;
  }

  if (body.email !== undefined) {
    if (body.email && typeof body.email === 'string' && body.email.trim()) {
      const cleanEmail = body.email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        throw new ValidationError('Please provide a valid email address.');
      }
      result.email = cleanEmail;
    } else {
      result.email = null;
    }
  }

  if (body.phone !== undefined) {
    result.phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
  }

  if (body.organization !== undefined) {
    result.organization = typeof body.organization === 'string' && body.organization.trim() ? body.organization.trim() : null;
  }

  if (body.designation !== undefined) {
    result.designation = typeof body.designation === 'string' && body.designation.trim() ? body.designation.trim() : null;
  }

  if (body.metadata !== undefined) {
    result.metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  }

  return result;
}

export function validateGuestQueryOptions(query: any): GuestFilterOptions {
  const limit = Math.min(Math.max(parseInt(query?.limit as string, 10) || 500, 1), 50000);
  const offset = Math.max(parseInt(query?.offset as string, 10) || 0, 0);
  const search = typeof query?.search === 'string' && query.search.trim() ? query.search.trim() : undefined;
  const category = typeof query?.category === 'string' && query.category.trim() ? query.category.trim().toUpperCase() : undefined;

  return { limit, offset, search, category };
}
