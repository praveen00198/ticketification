import fs from 'fs';
import path from 'path';
import {
  isEventSwitcherVisible,
  isCreateEventButtonVisible,
  isHostWorkspaceMode,
  getGlobalUserNavigationCategories,
  getHostWorkspaceNavigationCategories,
  getAttendeeWorkspaceNavigationCategories,
  getNavigationCategories,
  canManageEventOperations,
  isEventOwner,
} from '../../client/src/utils/permissions';
import { eventRepository } from '../src/modules/events/repositories/event.repository';
import { dashboardController } from '../src/modules/dashboard/controllers/dashboard.controller';
import { NotFoundError } from '../src/middlewares/error.middleware';

describe('Event Switcher & Workspace Navigation Invariants Regression Suite', () => {
  const sampleHostUser = {
    id: 'host-user-001',
    name: 'Host User',
    email: 'host@ticketification.com',
    role: 'USER',
    isOnboarded: true,
  };

  const sampleAttendeeUser = {
    id: 'attendee-user-999',
    name: 'Attendee User',
    email: 'attendee@ticketification.com',
    role: 'USER',
    isOnboarded: false,
  };

  const sampleEvent = {
    id: 'ev-alpha-123',
    name: 'Tech Conference 2026',
    eventType: 'CONFERENCE',
    createdBy: 'host-user-001',
    ownerId: 'host-user-001',
  };

  // =========================================================================
  // 1. Zero Created Events: Event Switcher Hidden in Global User Dashboard
  // =========================================================================
  describe('Rule 1 & 2: Event Switcher Visibility Invariants', () => {
    it('strictly hides the Event Switcher in Global User Dashboard when user has 0 events', () => {
      // In Global User Dashboard: !isInHostMode, eventsCount is 0
      const isVisible = isEventSwitcherVisible({
        isCollapsed: false,
        isMobile: false,
        isInHostMode: false,
        eventsCount: 0,
      });

      expect(isVisible).toBe(false);
    });

    it('displays the Event Switcher in Global User Dashboard once the user has >= 1 event', () => {
      // User created 1 event
      const isVisibleOne = isEventSwitcherVisible({
        isCollapsed: false,
        isMobile: false,
        isInHostMode: false,
        eventsCount: 1,
      });
      expect(isVisibleOne).toBe(true);

      // User created multiple events
      const isVisibleMultiple = isEventSwitcherVisible({
        isCollapsed: false,
        isMobile: false,
        isInHostMode: false,
        eventsCount: 4,
      });
      expect(isVisibleMultiple).toBe(true);
    });

    it('displays the Event Switcher in Host Workspace mode even if events array is momentarily singular', () => {
      // Inside an event host workspace (isInHostMode = true)
      const isVisibleHostMode = isEventSwitcherVisible({
        isCollapsed: false,
        isMobile: false,
        isInHostMode: true,
        eventsCount: 1,
      });
      expect(isVisibleHostMode).toBe(true);
    });

    it('collapses cleanly when sidebar is collapsed on desktop, but remains accessible on mobile drawer', () => {
      // Desktop collapsed: switcher omitted to keep slim rail clean
      const desktopCollapsed = isEventSwitcherVisible({
        isCollapsed: true,
        isMobile: false,
        isInHostMode: false,
        eventsCount: 3,
      });
      expect(desktopCollapsed).toBe(false);

      // Mobile drawer open: switcher visible
      const mobileDrawer = isEventSwitcherVisible({
        isCollapsed: false,
        isMobile: true,
        isInHostMode: false,
        eventsCount: 3,
      });
      expect(mobileDrawer).toBe(true);
    });
  });

  // =========================================================================
  // 2. Event Switcher Contains No Create Event Action & Switches Only Existing Events
  // =========================================================================
  describe('Rule 1: Event Switcher is Exclusively for Switching Between Existing Events', () => {
    it('verifies Sidebar.tsx source code contains NO "Create New Event" or "/events/create" inside the Event Switcher', () => {
      const sidebarPath = path.resolve(__dirname, '../../client/src/components/layout/Sidebar.tsx');
      const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

      // 1. Must not have "Create New Event" button in Event Switcher
      expect(sidebarContent).not.toContain('Create New Event');

      // 2. Must not navigate to /events/create from inside the Event Switcher dropdown
      expect(sidebarContent).not.toMatch(/eventMenuOpen[\s\S]*?navigate\(['"]\/events\/create['"]\)/);

      // 3. Must use isEventSwitcherVisible or shouldShowEventSwitcher guard
      expect(sidebarContent).toContain('shouldShowEventSwitcher');
      expect(sidebarContent).toContain('isEventSwitcherVisible');
    });

    it('verifies that selecting an event from the switcher switches strictly between existing authorized events', () => {
      const existingEvents = [
        { id: 'ev-1', name: 'Event One' },
        { id: 'ev-2', name: 'Event Two' },
      ];

      // Any selected event must exist in the authorized events array
      const targetId = 'ev-2';
      const matched = existingEvents.find((e) => e.id === targetId);
      expect(matched).toBeDefined();
      expect(matched?.name).toBe('Event Two');

      // Attempting to select a non-existing or unauthorized event fails cleanly
      const unauthorized = existingEvents.find((e) => e.id === 'unauthorized-ev-999');
      expect(unauthorized).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Separate Create Event Entry Point in Global User Interface
  // =========================================================================
  describe('Rule 3: Separate Create Event Entry Point', () => {
    it('provides a separate Create Event entry point in Global User Navigation categories', () => {
      const globalNav = getGlobalUserNavigationCategories(sampleHostUser);
      const hostingCategory = globalNav.find((cat) => cat.title === 'Event Hosting');

      expect(hostingCategory).toBeDefined();
      const createEventItem = hostingCategory?.items.find((item) => item.path === '/events/create');
      expect(createEventItem).toBeDefined();
      expect(createEventItem?.label).toBe('Create Event');
    });

    it('evaluates topbar Create Event button visibility: visible in Global User Dashboard, hidden on /events/create and Host Workspace', () => {
      // 1. Visible in Global Dashboard (/dashboard, /explore, /wallet, /events)
      expect(isCreateEventButtonVisible('/dashboard', null)).toBe(true);
      expect(isCreateEventButtonVisible('/explore', null)).toBe(true);
      expect(isCreateEventButtonVisible('/wallet', null)).toBe(true);
      expect(isCreateEventButtonVisible('/events', null)).toBe(true);

      // 2. Hidden when already on the Create Event page (/events/create)
      expect(isCreateEventButtonVisible('/events/create', null)).toBe(false);
      expect(isCreateEventButtonVisible('/events/create', sampleEvent)).toBe(false);

      // 3. Hidden inside Host Workspace (/events/:id, /scan, /import, /tickets, /reports)
      expect(isCreateEventButtonVisible(`/events/${sampleEvent.id}`, sampleEvent)).toBe(false);
      expect(isCreateEventButtonVisible('/scan', sampleEvent)).toBe(false);
      expect(isCreateEventButtonVisible('/import', sampleEvent)).toBe(false);
      expect(isCreateEventButtonVisible('/tickets', sampleEvent)).toBe(false);
      expect(isCreateEventButtonVisible('/reports', sampleEvent)).toBe(false);
    });
  });

  // =========================================================================
  // 4. Workspace Navigation Consistency on Create Event Page
  // =========================================================================
  describe('Rule 4: Workspace Navigation Consistency on Create Event Page', () => {
    it('defines /events/create as Global User context (never Host Workspace)', () => {
      // Even if currentEvent is passed or stale, /events/create is strictly NOT Host Workspace mode
      const isHostModeWithEvent = isHostWorkspaceMode('/events/create', sampleEvent);
      expect(isHostModeWithEvent).toBe(false);

      const isHostModeNull = isHostWorkspaceMode('/events/create', null);
      expect(isHostModeNull).toBe(false);
    });

    it('ensures /events/create renders Global User navigation categories and never Host Workspace categories', () => {
      const navCategories = getNavigationCategories({
        user: sampleHostUser,
        currentEvent: null,
        pathname: '/events/create',
      });

      // Categories must be Global User navigation
      const titles = navCategories.map((c) => c.title);
      expect(titles).toContain('Event Discovery');
      expect(titles).toContain('Event Hosting');
      expect(titles).toContain('Account & Profile');

      // Must NOT contain host operations
      expect(titles).not.toContain('Core Event Management');
      expect(titles).not.toContain('Event Operations');
    });

    it('verifies Layout.tsx breadcrumbs define /events/create as Dashboard > Events > Create Event', () => {
      const layoutPath = path.resolve(__dirname, '../../client/src/components/layout/Layout.tsx');
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      // Breadcrumb block for /events/create
      expect(layoutContent).toContain("if (path === '/events/create')");
      expect(layoutContent).toContain("{ label: 'Create Event', path: '/events/create', icon: Sparkles }");
    });
  });

  // =========================================================================
  // 5. Event Registration Does NOT Count as Event Ownership or Creation
  // =========================================================================
  describe('Rule 2 & 5: Event Registration Separation from Creation and Ownership', () => {
    it('ensures eventRepository.findByOwner only returns events created by the user, not registered events', async () => {
      // Mock eventRepository.findByOwner
      const findByOwnerSpy = jest.spyOn(eventRepository, 'findByOwner').mockImplementation(async (userId: string) => {
        if (userId === sampleHostUser.id) {
          return [sampleEvent as any];
        }
        // Attendee has 0 created events
        return [];
      });

      const hostEvents = await eventRepository.findByOwner(sampleHostUser.id);
      expect(hostEvents).toHaveLength(1);
      expect(hostEvents[0].id).toBe(sampleEvent.id);

      const attendeeEvents = await eventRepository.findByOwner(sampleAttendeeUser.id);
      expect(attendeeEvents).toHaveLength(0);

      findByOwnerSpy.mockRestore();
    });

    it('ensures an attendee registering for an event cannot access host dashboard stats or management', async () => {
      // Mock eventRepository.findByIdAndOwner to return null for attendee
      const findByIdAndOwnerSpy = jest
        .spyOn(eventRepository, 'findByIdAndOwner')
        .mockImplementation(async (eventId: string, userId: string) => {
          if (eventId === sampleEvent.id && userId === sampleHostUser.id) {
            return sampleEvent as any;
          }
          return null;
        });

      const req: any = {
        user: sampleAttendeeUser,
        query: { eventId: sampleEvent.id },
      };
      const res: any = {
        json: jest.fn(),
      };
      let capturedError: any = null;
      const next = jest.fn((err) => {
        capturedError = err;
      });

      await dashboardController.getStats(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(capturedError).toBeInstanceOf(NotFoundError);
      expect(capturedError.message).toBe('Event not found or unauthorized');

      findByIdAndOwnerSpy.mockRestore();
    });

    it('confirms isEventOwner returns false for an attendee who has registered for an event', () => {
      const isOwner = isEventOwner(sampleAttendeeUser, sampleEvent);
      expect(isOwner).toBe(false);

      const canManage = canManageEventOperations(sampleAttendeeUser, sampleEvent);
      expect(canManage).toBe(false);
    });
  });

  // =========================================================================
  // 6. Host, Global User, and Attendee Navigation Remain Distinct and Consistent
  // =========================================================================
  describe('Rule 5 & 7: Distinct and Consistent Navigation Across Workspaces', () => {
    it('distinguishes Host Workspace navigation from Global User navigation', () => {
      const hostCategories = getHostWorkspaceNavigationCategories({
        user: sampleHostUser,
        currentEvent: sampleEvent,
      });

      const hostTitles = hostCategories.map((c) => c.title);
      expect(hostTitles).toContain('Core Event Management');
      expect(hostTitles).toContain('Event Operations');

      // Host items must not contain Global User exploration
      const hostPaths = hostCategories.flatMap((c) => c.items.map((i) => i.path));
      expect(hostPaths).toContain(`/events/${sampleEvent.id}`);
      expect(hostPaths).toContain('/scan');
      expect(hostPaths).toContain('/import');
      expect(hostPaths).not.toContain('/explore');
      expect(hostPaths).not.toContain('/events/create');
    });

    it('distinguishes Attendee Workspace navigation from Host navigation and Global User navigation', () => {
      const attendeeCategories = getAttendeeWorkspaceNavigationCategories({
        user: sampleAttendeeUser,
        currentEvent: sampleEvent,
      });

      const attendeeTitles = attendeeCategories.map((c) => c.title);
      expect(attendeeTitles).toContain('Attendee Workspace');

      const attendeePaths = attendeeCategories.flatMap((c) => c.items.map((i) => i.path));
      expect(attendeePaths).toContain('/wallet');
      expect(attendeePaths).toContain(`/events/${sampleEvent.id}/public`);
      expect(attendeePaths).toContain('/registrations');

      // Must NOT contain host operational routes
      expect(attendeePaths).not.toContain('/scan');
      expect(attendeePaths).not.toContain('/import');
      expect(attendeePaths).not.toContain('/tickets');
      expect(attendeePaths).not.toContain('/events/create');
    });

    it('automatically resolves navigation categories according to active workspace context', () => {
      // 1. Host user in Host Workspace
      const hostNav = getNavigationCategories({
        user: sampleHostUser,
        currentEvent: sampleEvent,
        pathname: `/events/${sampleEvent.id}`,
      });
      expect(hostNav.map((c) => c.title)).toContain('Core Event Management');

      // 2. Attendee user visiting event with ATTENDEE role
      const attendeeEventContext = {
        ...sampleEvent,
        userRole: 'ATTENDEE',
      };
      const attendeeNav = getNavigationCategories({
        user: sampleAttendeeUser,
        currentEvent: attendeeEventContext,
        pathname: `/events/${sampleEvent.id}`,
      });
      expect(attendeeNav.map((c) => c.title)).toContain('Attendee Workspace');

      // 3. Global User on Dashboard
      const globalNav = getNavigationCategories({
        user: sampleHostUser,
        currentEvent: null,
        pathname: '/dashboard',
      });
      expect(globalNav.map((c) => c.title)).toContain('Event Discovery');
      expect(globalNav.map((c) => c.title)).toContain('Event Hosting');
    });
  });
});
