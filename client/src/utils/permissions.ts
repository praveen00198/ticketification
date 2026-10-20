import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Calendar,
  Compass,
  FileSpreadsheet,
  Ticket,
  QrCode,
  Users,
  Award,
  Wallet,
  Sparkles,
  Building2,
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
 */
export function getNavigationCategories({
  user,
  currentEvent,
}: {
  user: UserIdentity | null;
  currentEvent?: { id: string; name: string; createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null;
}): NavCategory[] {
  const hasEventOps = canManageEventOperations(user, currentEvent);
  const categories: NavCategory[] = [];

  // 1. Core & Overview (Visible to all authenticated users)
  categories.push({
    title: 'Core & Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Events Catalog', path: '/events', icon: Calendar },
      { label: 'Explore Events', path: '/explore', icon: Compass },
    ],
  });

  // 2. Event Operations (Strictly restricted to verified event owners and platform admins with an active event)
  if (hasEventOps && currentEvent) {
    const operationalItems: NavItem[] = [
      { label: 'Import Guests', path: '/import', icon: FileSpreadsheet, requiresHost: true },
      { label: 'Issued Tickets', path: '/tickets', icon: Ticket, requiresHost: true },
      {
        label: 'Scan & Turnstiles',
        path: '/scan',
        icon: QrCode,
        badge: 'Live',
        badgeColor: 'bg-stone-100 text-stone-800 border border-stone-200',
        requiresHost: true,
      },
      {
        label: 'Staff Console',
        path: `/events/${currentEvent.id}/staff-console`,
        icon: Users,
        requiresEvent: true,
        requiresHost: true,
      },
      {
        label: 'Judging & Mentors',
        path: `/events/${currentEvent.id}/review-workspace`,
        icon: Award,
        requiresEvent: true,
        requiresHost: true,
      },
    ];

    categories.push({
      title: 'Event Operations',
      items: operationalItems,
    });
  }

  // 3. Attendee & Wallet (Universal for all attendees and organizers)
  categories.push({
    title: 'Attendee & Wallet',
    items: [{ label: 'My Pass Wallet', path: '/wallet', icon: Wallet }],
  });

  // 4. Host & Workspace Management
  if (hasOrganizerProfile(user)) {
    categories.push({
      title: 'Workspace & Setup',
      items: [
        {
          label: 'Organization Profile',
          path: '/settings/profile',
          icon: Building2,
        },
      ],
    });
  } else {
    // Normal attendee: non-intrusive option to start organizing
    categories.push({
      title: 'Host an Event',
      items: [
        {
          label: 'Become an Organizer',
          path: '/onboarding',
          icon: Sparkles,
        },
      ],
    });
  }

  return categories;
}
