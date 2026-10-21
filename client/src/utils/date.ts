/**
 * Date Localization & Formatting Utilities
 *
 * Formats dates and timestamps in accordance with the authenticated user's
 * configured regional timezone and date display format preferences.
 */

export type DateFormatOption = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';

export interface UserLocalizationPreferences {
  timezone?: string;
  dateFormat?: DateFormatOption;
}

const PREFERENCES_STORAGE_KEY = 'ticketification_user_preferences';

/**
 * Retrieve cached user localization preferences from localStorage.
 */
export function getStoredUserPreferences(): UserLocalizationPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        dateFormat: parsed.dateFormat || 'YYYY-MM-DD',
      };
    }
  } catch {
    // Fallback to runtime environment defaults
  }
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    dateFormat: 'YYYY-MM-DD',
  };
}

/**
 * Cache user localization preferences locally for immediate UI reactivity.
 */
export function setStoredUserPreferences(prefs: UserLocalizationPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or access errors
  }
}

/**
 * Format a date string, Date object, or timestamp into a localized date string
 * using the user's preferred format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
 * and target timezone.
 */
export function formatLocalizedDate(
  dateInput: string | Date | number | null | undefined,
  overridePreferences?: UserLocalizationPreferences
): string {
  if (!dateInput) return 'TBD';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

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
 */
export function formatLocalizedDateTime(
  dateInput: string | Date | number | null | undefined,
  overridePreferences?: UserLocalizationPreferences
): string {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

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
