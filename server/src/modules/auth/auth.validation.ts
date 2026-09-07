import { ValidationError } from '../../middlewares/error.middleware';
import { RegisterInput, LoginInput, ChangePasswordInput } from './auth.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(body: any): RegisterInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) {
    throw new ValidationError('Full name is required.');
  }
  if (name.length < 2 || name.length > 100) {
    throw new ValidationError('Name must be between 2 and 100 characters.');
  }

  if (!email) {
    throw new ValidationError('Email address is required.');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError('Please provide a valid email address.');
  }

  if (!password) {
    throw new ValidationError('Password is required.');
  }
  if (password.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long.');
  }

  return { name, email, password };
}

export function validateLoginInput(body: any): LoginInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    throw new ValidationError('Email address is required.');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError('Please provide a valid email address.');
  }

  if (!password) {
    throw new ValidationError('Password is required.');
  }

  return { email, password };
}

export function validateChangePasswordInput(body: any): ChangePasswordInput {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body is required.');
  }

  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!newPassword) {
    throw new ValidationError('New password is required.');
  }
  if (newPassword.length < 6) {
    throw new ValidationError('Password must be at least 6 characters long.');
  }

  return { newPassword };
}
