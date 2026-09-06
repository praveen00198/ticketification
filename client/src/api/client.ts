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

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'An unexpected network or server error occurred.';
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

