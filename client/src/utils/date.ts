/**
 * Date Localization & Formatting Utilities
 *
 * Formats dates and timestamps in accordance with the authenticated user's
 * configured regional timezone and date display format preferences.
 * Scopes cached preferences strictly per authenticated user to prevent
 * cross-account leaks on shared browsers.
 */

import { getAuthenticatedUserIdFromToken } from '../api/client';

export type DateFormatOption = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface UserLocalizationPreferences {
  timezone?: string;
  dateFormat?: DateFormatOption;
}

const BASE_PREFERENCES_KEY_PREFIX = 'ticketification_user_preferences_';
const LEGACY_GLOBAL_KEY = 'ticketification_user_preferences';

/**
 * Resolves the user-specific storage key for localization preferences.
 * Returns null if no authenticated user session exists.
 */
export function getUserPreferencesStorageKey(userId?: string | null): string | null {
  const effectiveUserId = userId || getAuthenticatedUserIdFromToken();
  if (!effectiveUserId) return null;
  return `${BASE_PREFERENCES_KEY_PREFIX}${effectiveUserId}`;
}

/**
 * Retrieve cached user localization preferences from localStorage for the active user.
 * If unauthenticated or no preferences are cached for this user, returns clean system defaults.
 */
export function getStoredUserPreferences(userId?: string): UserLocalizationPreferences {
  const storageKey = getUserPreferencesStorageKey(userId);
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          dateFormat: parsed.dateFormat || 'YYYY-MM-DD',
        };
      }
    } catch {
      // Fallback to runtime defaults
    }
  }

  // Fallback defaults for unauthenticated users or users with no custom settings
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    dateFormat: 'YYYY-MM-DD',
  };
}

/**
 * Cache user localization preferences locally, scoped strictly to the authenticated user ID.
 */
export function setStoredUserPreferences(prefs: UserLocalizationPreferences, userId?: string): void {
  const storageKey = getUserPreferencesStorageKey(userId);
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    // Clean up any legacy un-scoped key to prevent cross-account leaks
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Clear cached localization preferences for a user (or clean up legacy keys).
 */
export function clearStoredUserPreferences(userId?: string): void {
  const storageKey = getUserPreferencesStorageKey(userId);
  if (storageKey) {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  }
  try {
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Format a date string, Date object, or timestamp into a localized date string
 * using the user's preferred format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
 * and target timezone.
 *
 * When dateInput is missing or invalid, returns "Date unavailable". Never returns the current time.
 */
export function formatLocalizedDate(
  dateInput: string | Date | number | null | undefined,
  overridePreferences?: UserLocalizationPreferences
): string {
  if (!dateInput) return 'Date unavailable';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Date unavailable';

  const prefs = overridePreferences || getStoredUserPreferences();
  const tz = prefs.timezone || 'UTC';
  const format = prefs.dateFormat || 'YYYY-MM-DD';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(d);
    let day = '01';
    let month = '01';
    let year = '1970';

    for (const part of parts) {
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
    }

    if (format === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    }
    if (format === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    }
    return `${year}-${month}-${day}`;
  } catch {
    return d.toISOString().split('T')[0];
  }
}

/**
 * Format a timestamp into a localized date and time string using the user's
 * preferred timezone.
 *
 * When dateInput is missing or invalid, returns "Date unavailable". Never returns the current time.
 */
export function formatLocalizedDateTime(
  dateInput: string | Date | number | null | undefined,
  overridePreferences?: UserLocalizationPreferences
): string {
  if (!dateInput) return 'Date unavailable';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Date unavailable';

  const prefs = overridePreferences || getStoredUserPreferences();
  const tz = prefs.timezone || 'UTC';
  const dateStr = formatLocalizedDate(d, prefs);

  try {
    const timeStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);

    return `${dateStr} • ${timeStr}`;
  } catch {
    return dateStr;
  }
}
