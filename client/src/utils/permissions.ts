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
  LayoutDashboard,
  Users,
  Award,
} from 'lucide-react';
import { getEventCapabilities } from './event-capabilities';

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
 * 2. Event owner and authorized operational collaborators (HOST, COORDINATOR) have operational capability.
 * 3. Evaluators, Judges, Mentors, and Volunteers only possess scoped capabilities and are NOT granted host-level operational access.
 * 4. Mere onboarding completion or non-empty event arrays NEVER grant operational access.
 */
export function canManageEventOperations(
  user?: UserIdentity | null,
  currentEvent?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string; userRole?: string; role?: string } | null
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (!currentEvent) return false;
  if (isEventOwner(user, currentEvent)) return true;

  const role = (currentEvent as any).userRole || (currentEvent as any).role;
  if (role === 'HOST' || role === 'COORDINATOR') {
    return true;
  }

  return false;
}

/**
 * Backwards-compatible alias for operational host authorization.
 */
export function isHostOrOrganizer(
  user?: UserIdentity | null,
  currentEvent?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string; userRole?: string; role?: string } | null
): boolean {
  return canManageEventOperations(user, currentEvent);
}

/**
 * Resolves human-readable display role for the user.
 * Strictly adheres to single global user identity:
 * - A user is globally an 'Attendee' (or 'Admin' / 'Super Admin' for platform operators).
 * - Contextual event roles ('Host', 'Coordinator', 'Judge', 'Mentor', 'Evaluator', 'Volunteer')
 *   are displayed only within the context of an authorized event.
 * - isOnboarded is a legacy profile completion flag and NEVER misidentifies a user globally as 'Host'.
 */
export function getUserDisplayRole(
  user?: UserIdentity | null,
  currentEvent?: { createdBy?: string; ownerId?: string; ownerSupabaseId?: string; userRole?: string; role?: string } | null
): string {
  if (!user) return 'Guest';
  if (user.role === 'SUPER_ADMIN') return 'Super Admin';
  if (user.role === 'ADMIN') return 'Admin';

  if (currentEvent) {
    if (isEventOwner(user, currentEvent)) return 'Host';
    const role = (currentEvent as any).userRole || (currentEvent as any).role;
    if (role === 'HOST') return 'Host';
    if (role === 'COORDINATOR') return 'Coordinator';
    if (role === 'VOLUNTEER') return 'Volunteer';
    if (role === 'MENTOR') return 'Mentor';
    if (role === 'EVALUATOR') return 'Evaluator';
    if (role === 'JUDGE') return 'Judge';
  }

  return 'Attendee';
}

/**
 * Determines whether the current view is inside the Event-Specific Host Workspace.
 */
export function isHostWorkspaceMode(
  pathname: string,
  currentEvent?: { id?: string } | null
): boolean {
  if (!currentEvent) return false;
  if (pathname.startsWith('/events/') && !pathname.startsWith('/events/create')) {
    return true;
  }
  if (['/import', '/tickets', '/scan', '/reports'].includes(pathname)) {
    return true;
  }
  return false;
}

/**
 * Global User Navigation (Discovery, Wallet, History, Hosting, Settings)
 * Dedicated user-level modules, strictly separate from event operations.
 */
export function getGlobalUserNavigationCategories(_user?: UserIdentity | null): NavCategory[] {
  return [
    {
      title: 'Event Discovery',
      items: [
        { label: 'Explore Events', path: '/explore', icon: Compass },
        { label: 'My Registrations', path: '/registrations', icon: CheckCircle2 },
      ],
    },
    {
      title: 'Attendee Wallet',
      items: [
        { label: 'My Passes', path: '/wallet', icon: Wallet },
      ],
    },
    {
      title: 'My Activity',
      items: [
        { label: 'Event History', path: '/history', icon: History },
      ],
    },
    {
      title: 'Event Hosting',
      items: [
        { label: 'My Events', path: '/events', icon: Calendar },
        { label: 'Create Event', path: '/events/create', icon: Sparkles },
      ],
    },
    {
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
    },
    {
      title: 'Notifications',
      items: [
        { label: 'Notifications', path: '/notifications', icon: Bell },
      ],
    },
    {
      title: 'Help & Support',
      items: [
        { label: 'Help Center / FAQs', path: '/support/help', icon: HelpCircle },
        { label: 'Report an Issue', path: '/support/report', icon: AlertTriangle },
      ],
    },
    {
      title: 'Account & Profile',
      items: [
        { label: 'My Profile', path: '/settings/profile', icon: User },
        { label: 'Account Settings', path: '/settings/account', icon: Settings },
        { label: 'Security & Password', path: '/settings/security', icon: ShieldCheck },
        { label: 'Privacy Settings', path: '/settings/privacy', icon: Lock },
      ],
    },
  ];
}

/**
 * Event-Specific Host Workspace Navigation
 * Dynamic categories derived from selected event capabilities.
 * "Create New Event" is NEVER shown here — it lives strictly in the Event Switcher.
 */
export function getHostWorkspaceNavigationCategories({
  user: _user,
  currentEvent,
}: {
  user?: UserIdentity | null;
  currentEvent: { id: string; name: string; eventType?: string };
}): NavCategory[] {
  const caps = getEventCapabilities(currentEvent.eventType);
  const eventId = currentEvent.id;

  const categories: NavCategory[] = [
    {
      title: 'Core Event Management',
      items: [
        { label: 'Event Console', path: `/events/${eventId}`, icon: LayoutDashboard },
        { label: 'Verification & Org', path: `/events/${eventId}#verification`, icon: ShieldCheck },
        { label: 'Operations & Settings', path: `/events/${eventId}#settings`, icon: Settings },
      ],
    },
    {
      title: 'Event Operations',
      items: [
        { label: 'Guest Roster', path: `/import`, icon: FileSpreadsheet, requiresEvent: true, requiresHost: true },
        { label: 'Issued Tickets', path: `/tickets`, icon: Ticket, requiresEvent: true, requiresHost: true },
        { label: 'Scan & Turnstiles', path: `/scan`, icon: QrCode, requiresEvent: true, requiresHost: true },
        ...(caps.analytics ? [{ label: 'Reports & Analytics', path: `/reports`, icon: BarChart3, requiresEvent: true, requiresHost: true }] : []),
      ],
    },
  ];

  // Personnel & Scoring capabilities (Hackathons, Competitions, Workshops, etc.)
  const personnelItems: NavItem[] = [
    { label: 'Staff Console', path: `/events/${eventId}/staff-console`, icon: Users },
  ];

  if (caps.mentors || caps.evaluators || caps.judges) {
    personnelItems.push({
      label: 'Judging & Evaluation',
      path: `/events/${eventId}/review-workspace`,
      icon: Award,
    });
  }

  if (personnelItems.length > 0) {
    categories.push({
      title: 'Personnel & Evaluation',
      items: personnelItems,
    });
  }

  return categories;
}

/**
 * Build centralized, context-aware navigation structure.
 * Automatically resolves between Global User Dashboard and Event-Specific Host Workspace.
 */
export function getNavigationCategories({
  user,
  currentEvent,
  pathname,
}: {
  user: UserIdentity | null;
  currentEvent?: { id: string; name: string; eventType?: string; createdBy?: string; ownerId?: string; ownerSupabaseId?: string } | null;
  pathname?: string;
}): NavCategory[] {
  const isHostMode = pathname ? isHostWorkspaceMode(pathname, currentEvent) : Boolean(currentEvent);

  if (isHostMode && currentEvent && canManageEventOperations(user, currentEvent)) {
    return getHostWorkspaceNavigationCategories({ user, currentEvent });
  }

  return getGlobalUserNavigationCategories(user);
}
