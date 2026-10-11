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
function resolveApiBaseUrl(): string {
  // In development, route through Vite's local proxy to reach the local backend
  if (import.meta.env.DEV && !import.meta.env.VITE_FORCE_REMOTE_API) {
    return '/api';
  }

  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (!envUrl) {
    return '/api';
  }

  // Remove any trailing slashes
  const cleanUrl = envUrl.replace(/\/+$/, '');

  // If already ends with /api, use as is
  if (cleanUrl.endsWith('/api')) {
    return cleanUrl;
  }

  // Otherwise append /api
  return `${cleanUrl}/api`;
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
 * Reads canonical 'ticketification_token' with seamless backward-compatible fallback to legacy 'admin_token'.
 */
export function getStoredAuthToken(): string | null {
  return localStorage.getItem('ticketification_token') || localStorage.getItem('admin_token');
}

export function setStoredAuthToken(token: string): void {
  localStorage.setItem('ticketification_token', token);
  // Maintain backward compatibility for legacy callers
  localStorage.setItem('admin_token', token);
}

export function clearStoredAuthToken(): void {
  localStorage.removeItem('ticketification_token');
  localStorage.removeItem('admin_token');
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Cleanly evict expired authentication token from browser storage
      clearStoredAuthToken();
    }

    let message = error.response?.data?.error?.message;
    if (!message) {
      if (error.response?.status === 401) {
        message = 'Your session has expired. Please sign in again.';
      } else if (error.response?.status === 403) {
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

    return Promise.reject(new Error(message));
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

