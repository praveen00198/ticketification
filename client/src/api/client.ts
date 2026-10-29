import axios from 'axios';

/**
 * Resolves the backend API base URL.
 * Automatically handles all formats of VITE_API_URL:
 * - Empty / undefined (Local dev): defaults to '/api' (Vite proxy forwards to backend)
 * - 'https://ticketification.onrender.com'     -> 'https://ticketification.onrender.com/api'
 * - 'https://ticketification.onrender.com/'    -> 'https://ticketification.onrender.com/api'
 * - 'https://ticketification.onrender.com/api'  -> 'https://ticketification.onrender.com/api'
 * - 'https://ticketification.onrender.com/api/' -> 'https://ticketification.onrender.com/api'
 */
export const DEFAULT_PRODUCTION_API_URL = 'https://ticketification.onrender.com/api';

function resolveApiBaseUrl(): string {
  // In development, route through Vite's local proxy to reach the local backend
  if (import.meta.env.DEV && !import.meta.env.VITE_FORCE_REMOTE_API) {
    return '/api';
  }

  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    // Remove any trailing slashes
    const cleanUrl = envUrl.replace(/\/+$/, '');

    // If already ends with /api, use as is
    if (cleanUrl.endsWith('/api')) {
      return cleanUrl;
    }

    // Otherwise append /api
    return `${cleanUrl}/api`;
  }

  // If running in browser on localhost/127.0.0.1 (e.g. vite preview), route via local proxy
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/api';
  }

  // In production builds without explicit VITE_API_URL, default to the live backend API
  return DEFAULT_PRODUCTION_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Global authentication token helpers.
 * Reads canonical 'ticketification_token' with seamless one-time migration from legacy 'admin_token'.
 * Eliminates duplicate token exposure in browser storage.
 */
export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const token = localStorage.getItem('ticketification_refresh_token');
  if (token) return token;

  // Supabase localStorage session fallback
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        ((key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key === 'supabase.auth.token')
      ) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const sbRefreshToken =
            parsed?.refresh_token || parsed?.currentSession?.refresh_token;
          if (sbRefreshToken && typeof sbRefreshToken === 'string') {
            return sbRefreshToken;
          }
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return null;
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('ticketification_refresh_token', token);
  }
}

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const token = localStorage.getItem('ticketification_token');
  if (token) return token;

  // Seamless one-time migration from legacy storage key
  const legacyToken = localStorage.getItem('admin_token');
  if (legacyToken) {
    localStorage.setItem('ticketification_token', legacyToken);
    localStorage.removeItem('admin_token');
    return legacyToken;
  }

  // Supabase localStorage session fallback
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        ((key.startsWith('sb-') && key.endsWith('-auth-token')) ||
          key === 'supabase.auth.token')
      ) {
        const item = localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item);
          const sbAccessToken =
            parsed?.access_token || parsed?.currentSession?.access_token;
          if (sbAccessToken && typeof sbAccessToken === 'string') {
            return sbAccessToken;
          }
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }

  return null;
}

export function setStoredAuthToken(token: string, refreshToken?: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('ticketification_token', token);
    if (refreshToken) {
      setStoredRefreshToken(refreshToken);
    }
    // Remove legacy storage key to prevent duplicate credentials in storage
    localStorage.removeItem('admin_token');
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('ticketification_token');
    localStorage.removeItem('ticketification_refresh_token');
    localStorage.removeItem('admin_token');
    window.dispatchEvent(new CustomEvent('ticketification:auth-expired'));
  }
}

/**
 * Safely decodes the current authenticated user ID from the active JWT token.
 * Returns null if no token exists, or if token is invalid/unparseable.
 *
 * NOTE: This helper is used strictly for client-side localStorage preference namespacing
 * (e.g. ticketification_user_preferences_${userId}). It is NEVER used as proof of
 * authentication or authorization, which is enforced solely by backend middleware on every request.
 */
export function getAuthenticatedUserIdFromToken(): string | null {
  const token = getStoredAuthToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonString = '';
    if (typeof atob === 'function') {
      jsonString = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } else if (typeof Buffer !== 'undefined') {
      jsonString = Buffer.from(base64, 'base64').toString('utf-8');
    }
    if (!jsonString) return null;
    const parsed = JSON.parse(jsonString);
    const resolvedId = parsed.id || parsed.sub || parsed.userId || parsed._id;
    return resolvedId ? String(resolvedId) : null;
  } catch {
    return null;
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    const cleanToken = token.trim();
    if (config.headers && typeof (config.headers as any).set === 'function') {
      (config.headers as any).set('Authorization', `Bearer ${cleanToken}`);
    } else if (config.headers) {
      config.headers.Authorization = `Bearer ${cleanToken}`;
    } else {
      config.headers = { Authorization: `Bearer ${cleanToken}` } as any;
    }
  } else {
    // If request requires authentication (not a public or auth endpoint), fail-fast client-side
    const url = config.url || '';
    const isPublic =
      url.startsWith('/public/') ||
      url.startsWith('/auth/login') ||
      url.startsWith('/auth/register') ||
      url.startsWith('/auth/refresh') ||
      url.startsWith('/health');
    if (!isPublic) {
      return Promise.reject({
        response: {
          status: 401,
          data: {
            error: {
              message: 'Your session has expired or you are not signed in. Please sign in again.',
              code: 'SESSION_EXPIRED',
            },
          },
        },
        message: 'Your session has expired or you are not signed in. Please sign in again.',
      });
    }
  }
  return config;
});

// Shared in-flight refresh promise mutex to eliminate concurrent refresh races
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // Attempt token refresh on 401 if a refresh token is present (and not already retrying / auth endpoint)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const storedRefreshToken = getStoredRefreshToken();

      if (storedRefreshToken) {
        originalRequest._retry = true;

        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken: storedRefreshToken,
              });

              if (res.data?.success && res.data?.data?.token) {
                const newToken = res.data.data.token;
                const newRefreshToken = res.data.data.refreshToken;
                setStoredAuthToken(newToken, newRefreshToken);
                return newToken;
              }
              throw new Error('Refresh endpoint returned unsuccessful payload');
            } catch (refreshErr: any) {
              const status = refreshErr.response?.status;
              // Only clear stored tokens on explicit authentication rejection (401 or 403)
              if (status === 401 || status === 403) {
                clearStoredAuthToken();
              }
              throw refreshErr;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        try {
          const newToken = await refreshPromise;
          if (originalRequest.headers && typeof (originalRequest.headers as any).set === 'function') {
            (originalRequest.headers as any).set('Authorization', `Bearer ${newToken}`);
          } else if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          } else {
            originalRequest.headers = { Authorization: `Bearer ${newToken}` } as any;
          }
          return apiClient(originalRequest);
        } catch (retryErr) {
          return Promise.reject(retryErr);
        }
      } else {
        clearStoredAuthToken();
      }
    } else if (error.response?.status === 401) {
      clearStoredAuthToken();
    }

    let message = error.response?.data?.error?.message;
    if (
      error.response?.status === 401 ||
      (message && /bearer.*token|token.*missing|authentication required/i.test(message))
    ) {
      message = 'Your session has expired or you are not signed in. Please sign in again.';
    } else if (!message) {
      if (error.response?.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        message = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        message = 'The server took too long to respond. Please try again.';
      } else {
        message = error.message || 'An unexpected network error occurred.';
      }
    }

    // Clean up any residual low-level networking strings
    if (
      message.includes('ENETUNREACH') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNRESET')
    ) {
      message = 'The service is temporarily unreachable. Please try again in a few moments.';
    }

    error.message = message;
    return Promise.reject(error);
  }
);

/**
 * Resolves the public URL for a ticket image.
 * Safely converts legacy localhost URLs (e.g. http://localhost:10000/uploads/...)
 * to the actual active production backend domain.
 */
export function getTicketPreviewUrl(ticketImageUrl?: string): string {
  if (!ticketImageUrl) return '';
  const uploadsIndex = ticketImageUrl.indexOf('/uploads/');
  if (uploadsIndex !== -1) {
    const relativePath = ticketImageUrl.substring(uploadsIndex);
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${backendRoot}${relativePath}`;
  }
  return ticketImageUrl;
}

/**
 * Safely extracts a user-readable error message string from any API error.
 * Guarantees that a raw object (e.g., { message, code, details }) is never returned,
 * preventing "Objects are not valid as a React child" crashes.
 */
export function extractErrorMessage(error: any, fallbackMessage: string = 'An unexpected error occurred'): string {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;

  let message = '';
  // Check structured backend error response: { error: { message, code, details } }
  if (typeof error.response?.data?.error?.message === 'string') {
    message = error.response.data.error.message;
  } else if (typeof error.response?.data?.error === 'string') {
    message = error.response.data.error;
  } else if (typeof error.response?.data?.message === 'string') {
    message = error.response.data.message;
  } else if (typeof error.message === 'string' && error.message) {
    message = error.message;
  }

  if (message) {
    if (/bearer.*token|token.*missing|authentication required|invalid or expired authentication/i.test(message)) {
      return 'Your session has expired or you are not signed in. Please sign in again.';
    }
    return message;
  }

  return fallbackMessage;
}


