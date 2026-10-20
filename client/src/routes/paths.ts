/**
 * Canonical Application Route Paths
 * Centralized, typed route-path definitions across Ticketification.
 */
export const ROUTES = {
  // Public
  HOME: '/',
  EXPLORE: '/explore',
  PRICING: '/pricing',
  PUBLIC_EVENT_DETAIL: '/events/:eventId/public',
  VERIFY_TICKET: '/verify/:token',
  INVITE_ACCEPT: '/invite/accept',

  // Authentication
  LOGIN: '/login',
  REGISTER: '/register',

  // Authenticated Dashboard & Attendee
  DASHBOARD: '/dashboard',
  EVENTS: '/events',
  CREATE_EVENT: '/events/create',
  EVENT_DETAIL: '/events/:eventId',
  WALLET: '/wallet',
  ONBOARDING: '/onboarding',
  PROFILE_SETTINGS: '/settings/profile',

  // Organizer Operations
  IMPORT: '/import',
  TICKETS: '/tickets',
  SCAN: '/scan',
  STAFF_CONSOLE: '/events/:eventId/staff-console',
  REVIEW_WORKSPACE: '/events/:eventId/review-workspace',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
