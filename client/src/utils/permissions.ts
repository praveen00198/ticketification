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
 * Checks whether user has platform administrator privileges.
 */
export function isPlatformAdmin(user?: UserIdentity | null): boolean {
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

/**
 * Checks whether user has organizer/host privileges or manages any events.
 */
export function isHostOrOrganizer(user?: UserIdentity | null, hasEvents = false): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return Boolean(user.isOnboarded) || hasEvents;
}

/**
 * Resolves appropriate human-readable display role for the user.
 * Avoids false claims such as "Setup Pending" for regular attendees.
 */
export function getUserDisplayRole(user?: UserIdentity | null): string {
  if (!user) return 'Guest';
  if (user.role === 'SUPER_ADMIN') return 'Super Admin';
  if (user.role === 'ADMIN') return 'Admin';
  if (user.isOnboarded) return 'Host';
  return 'Attendee';
}

/**
 * Build centralized, role-filtered navigation structure based on user identity and context.
 */
export function getNavigationCategories({
  user,
  hasEvents,
  currentEvent,
}: {
  user: UserIdentity | null;
  hasEvents: boolean;
  currentEvent: { id: string; name: string } | null;
}): NavCategory[] {
  const isHost = isHostOrOrganizer(user, hasEvents);
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

  // 2. Event Operations (Strictly restricted to Hosts/Organizers and Platform Admins)
  if (isHost) {
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
    ];

    if (currentEvent) {
      operationalItems.push(
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
        }
      );
    }

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
  if (isHost) {
    const setupItems: NavItem[] = [];
    if (!user?.isOnboarded) {
      setupItems.push({
        label: 'Organizer Setup',
        path: '/onboarding',
        icon: Sparkles,
        badge: 'Optional',
        badgeColor: 'bg-stone-100 text-stone-700',
      });
    }
    setupItems.push({
      label: 'Organization Profile',
      path: '/settings/profile',
      icon: Building2,
    });

    categories.push({
      title: 'Workspace & Setup',
      items: setupItems,
    });
  } else {
    // Normal user: provide optional, non-intrusive way to host an event or become an organizer
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
