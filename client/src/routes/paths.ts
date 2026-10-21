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

  // Authenticated Normal User Experience
  DASHBOARD: '/dashboard',
  EVENTS: '/events',
  CREATE_EVENT: '/events/create',
  EVENT_DETAIL: '/events/:eventId',
  WALLET: '/wallet',
  REGISTRATIONS: '/registrations',
  HISTORY: '/history',
  REPORTS: '/reports',
  ONBOARDING: '/onboarding',

  // Payments & Refunds (Planned)
  PAYMENT_HISTORY: '/payments/history',
  REFUNDS: '/payments/refunds',

  // Notifications
  NOTIFICATIONS: '/notifications',

  // Help & Support
  HELP_CENTER: '/support/help',
  REPORT_ISSUE: '/support/report',

  // Account & Profile Settings
  PROFILE: '/profile',
  PROFILE_SETTINGS: '/settings/profile',
  ACCOUNT_SETTINGS: '/settings/account',
  SECURITY_SETTINGS: '/settings/security',
  PRIVACY_SETTINGS: '/settings/privacy',

  // Organizer Event-Specific Operations
  IMPORT: '/import',
  TICKETS: '/tickets',
  SCAN: '/scan',
  STAFF_CONSOLE: '/events/:eventId/staff-console',
  REVIEW_WORKSPACE: '/events/:eventId/review-workspace',
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
