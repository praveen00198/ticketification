import { LucideIcon } from 'lucide-react';
import {
  Compass,
  CheckCircle2,
  Wallet,
  History,
  Sparkles,
  Calendar,
  BarChart3,
  Receipt,
  RefreshCcw,
  Bell,
  HelpCircle,
  AlertTriangle,
  User,
  Settings,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  Ticket,
  QrCode,
} from 'lucide-react';

export interface UserIdentity {
  id?: string;
  name: string;
  email: string;
  role?: string;
  isOnboarded?: boolean;
  organizationName?: string;
}

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  requiresEvent?: boolean;
  requiresHost?: boolean;
  requiresAdmin?: boolean;
}

export interface NavCategory {
  title: string;
  items: NavItem[];
}

/**
 * Checks whether user has platform administrator privileges (ADMIN or SUPER_ADMIN).
 */
export function isPlatformAdmin(user?: UserIdentity | null): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

/**
 * Checks whether user has completed organizer onboarding and created an organization profile.
 * Note: Having an organizer profile is an identity attribute; it does NOT automatically
 * grant operational management capabilities over an event unless the user also owns that event.
 */
export function hasOrganizerProfile(user?: UserIdentity | null): boolean {
  return Boolean(user?.isOnboarded);
}

/**
 * Checks whether user is the verified creator/owner of the specified event.
 */
export function isEventOwner(
  user?: UserIdentity | null,
  event?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null
): boolean {
  if (!user || !user.id || !event) return false;
  return (
    event.createdBy === user.id ||
    (event as any).ownerSupabaseId === user.id ||
    (event as any).ownerId === user.id
  );
}

/**
 * Checks whether user has operational management permissions over the active event.
 * Follows least privilege:
 * 1. Platform admins have global management capability.
 * 2. Event-scoped operational modules (Import, Issued Passes, Turnstiles, Staff Console)
 *    strictly require verified event ownership.
 * 3. Mere onboarding completion or non-empty event arrays NEVER grant operational access.
 */
export function canManageEventOperations(
  user?: UserIdentity | null,
  currentEvent?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (currentEvent && isEventOwner(user, currentEvent)) return true;
  return false;
}

/**
 * Backwards-compatible alias for operational host authorization.
 */
export function isHostOrOrganizer(
  user?: UserIdentity | null,
  currentEvent?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null
): boolean {
  return canManageEventOperations(user, currentEvent);
}

/**
 * Resolves human-readable display role for the user.
 * Avoids misleading claims: regular users are 'Attendee', onboarded organizers are 'Host', admins are 'Admin'/'Super Admin'.
 */
export function getUserDisplayRole(user?: UserIdentity | null): string {
  if (!user) return 'Guest';
  if (user.role === 'SUPER_ADMIN') return 'Super Admin';
  if (user.role === 'ADMIN') return 'Admin';
  if (user.isOnboarded) return 'Host';
  return 'Attendee';
}

/**
 * Build centralized, role-filtered navigation structure based on verified capabilities.
 * Implements the exact 8-group Normal User sidebar hierarchy.
 */
export function getNavigationCategories({
  user,
  currentEvent,
}: {
  user: UserIdentity | null;
  currentEvent?: { id: string; name: string; createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null;
}): NavCategory[] {
  const categories: NavCategory[] = [];

  // 1. Event Discovery
  categories.push({
    title: 'Event Discovery',
    items: [
      { label: 'Explore Events', path: '/explore', icon: Compass },
      { label: 'My Registrations', path: '/registrations', icon: CheckCircle2 },
    ],
  });

  // 2. Attendee Wallet
  categories.push({
    title: 'Attendee Wallet',
    items: [
      { label: 'My Passes', path: '/wallet', icon: Wallet },
    ],
  });

  // 3. My Activity
  categories.push({
    title: 'My Activity',
    items: [
      { label: 'Event History', path: '/history', icon: History },
    ],
  });

  // 4. Event Hosting (Strict boundary: only Create Event, My Events, Reports & Analytics)
  categories.push({
    title: 'Event Hosting',
    items: [
      { label: 'Create Event', path: '/events/create', icon: Sparkles },
      { label: 'My Events', path: '/events', icon: Calendar },
      { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
    ],
  });

  // 5. Payment & Refund (Planned)
  categories.push({
    title: 'Payment & Refund',
    items: [
      {
        label: 'Payment History',
        path: '/payments/history',
        icon: Receipt,
        badge: 'Planned',
        badgeColor: 'bg-stone-100 text-stone-500 border border-stone-200/80',
      },
      {
        label: 'Refunds History & Status',
        path: '/payments/refunds',
        icon: RefreshCcw,
        badge: 'Planned',
        badgeColor: 'bg-stone-100 text-stone-500 border border-stone-200/80',
      },
    ],
  });

  // 6. Notifications
  categories.push({
    title: 'Notifications',
    items: [
      { label: 'Notifications', path: '/notifications', icon: Bell },
    ],
  });

  // 7. Help & Support
  categories.push({
    title: 'Help & Support',
    items: [
      { label: 'Help Center / FAQs', path: '/support/help', icon: HelpCircle },
      { label: 'Report an Issue', path: '/support/report', icon: AlertTriangle },
    ],
  });

  // 8. Account & Profile
  categories.push({
    title: 'Account & Profile',
    items: [
      { label: 'My Profile', path: '/settings/profile', icon: User },
      { label: 'Account Settings', path: '/settings/account', icon: Settings },
      { label: 'Security & Password', path: '/settings/security', icon: ShieldCheck },
      { label: 'Privacy Settings', path: '/settings/privacy', icon: Lock },
    ],
  });

  // If user is authorized to manage the active event, include operational controls for the host workflow
  if (canManageEventOperations(user, currentEvent)) {
    categories.push({
      title: 'Event Operations',
      items: [
        { label: 'Import Guests', path: '/import', icon: FileSpreadsheet, requiresEvent: true, requiresHost: true },
        { label: 'Issued Tickets', path: '/tickets', icon: Ticket, requiresEvent: true, requiresHost: true },
        { label: 'Scan & Turnstiles', path: '/scan', icon: QrCode, requiresEvent: true, requiresHost: true },
      ],
    });
  }

  return categories;
}
