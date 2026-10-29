import crypto from 'crypto';
import config from '../config/env';
import { AppError } from '../middlewares/error.middleware';

/**
 * Derives a secure password hash using PBKDF2 (SHA-512 with 10,000 iterations).
 * Uses pure Node.js native crypto standard library — zero external dependencies.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Validates a plaintext password against a stored PBKDF2 hash using timing-safe comparison.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const verifyBuf = Buffer.from(verifyHash, 'hex');
    if (hashBuf.length !== verifyBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, verifyBuf);
  } catch {
    return false;
  }
}

export const LOCAL_JWT_ISSUER = 'ticketification-auth';
export const TRUSTED_JWT_ISSUERS = ['ticketification-auth', 'ticketification-local'];
export const LOCAL_JWT_AUDIENCE = 'ticketification-api';

function getEffectiveSecret(customSecret?: string): string {
  if (customSecret) return customSecret;
  if (config.env.jwtSecret && config.env.jwtSecret !== 'Ticketification_Default_Secret_2026') {
    return config.env.jwtSecret;
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'Ticketification_Default_Secret_2026') {
    return process.env.JWT_SECRET;
  }
  if (config.env.isProduction) {
    throw new AppError(
      '[Security Invariant] JWT_SECRET must be configured with a secure value in production environment.',
      500,
      undefined,
      'AUTH_CONFIG_ERROR'
    );
  }
  return 'Ticketification_Default_Secret_2026';
}

/**
 * Generates an opaque, cryptographically secure 96-character hex refresh token.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Hashes an opaque token using SHA-256 for secure persistence.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a signed HS256 JWT access token using Node.js native HMAC.
 * Default access token lifespan: 1 hour (3600 seconds) or configurable.
 */
export function createJwtToken(
  payload: Record<string, any>,
  secretOrExpiresIn?: string | number,
  expiresInSeconds?: number
): string {
  let customSecret: string | undefined;
  let customExpiry: number | undefined;

  if (typeof secretOrExpiresIn === 'number') {
    customExpiry = secretOrExpiresIn;
  } else if (typeof secretOrExpiresIn === 'string') {
    customSecret = secretOrExpiresIn;
    customExpiry = expiresInSeconds;
  } else if (expiresInSeconds !== undefined) {
    customExpiry = expiresInSeconds;
  }

  const signingSecret = getEffectiveSecret(customSecret);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const defaultLifespan = parseInt(process.env.JWT_ACCESS_EXPIRATION || '3600', 10);
  const exp = now + (customExpiry !== undefined ? customExpiry : defaultLifespan);
  const tokenPayload = {
    iss: LOCAL_JWT_ISSUER,
    aud: LOCAL_JWT_AUDIENCE,
    iat: now,
    exp,
    type: 'access',
    ...payload,
  };
  const body = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Decodes and cryptographically verifies an HS256 JWT access token.
 * Returns decoded payload if valid and non-expired; null otherwise.
 */
export function verifyJwtToken(
  token: string,
  secret?: string
): Record<string, any> | null {
  try {
    const signingSecret = getEffectiveSecret(secret);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', signingSecret).update(`${header}.${body}`).digest('base64url');
    
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired or missing expiry
    }
    // Strictly verify trusted issuer and audience claims
    if (!payload.iss || !TRUSTED_JWT_ISSUERS.includes(payload.iss)) {
      return null; // Untrusted or missing issuer
    }
    if (!payload.aud || payload.aud !== LOCAL_JWT_AUDIENCE) {
      return null; // Invalid or missing audience
    }
    return payload;
  } catch {
    return null;
  }
}
