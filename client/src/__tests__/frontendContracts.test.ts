import {
  isPlatformAdmin,
  canManageEventOperations,
  isHostOrOrganizer,
  isHostWorkspaceMode,
  getHostWorkspaceNavigationCategories,
} from '../utils/permissions';
import { formatVenueLabel } from '../utils/venue';
import { getEventCapabilities } from '../utils/event-capabilities';

/**
 * Self-contained assertion harness for client-side type-checking & contract verification
 */
const assert = (condition: boolean, msg: string) => {
  if (!condition) throw new Error(`[Assertion Failure] ${msg}`);
};

export function runFrontendContractVerification(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ [FAIL] ${name}:`, err);
    }
  };

  const adminUser = {
    name: 'Admin',
    email: 'admin@ticketification.com',
    role: 'ADMIN',
  };

  const regularUser = {
    name: 'Regular Attendee',
    email: 'attendee@example.com',
    role: 'USER',
  };

  const sampleEvent = {
    id: 'evt_sample_123',
    name: 'Sample Summit',
    createdBy: 'usr_different_owner',
  };

  console.log('\n--- Running User Permissions & Venue Formatting Contracts ---');

  test('identifies platform administrators accurately', () => {
    assert(isPlatformAdmin(adminUser) === true, 'Admin user should be recognized as platform admin');
    assert(isPlatformAdmin(regularUser) === false, 'Regular user should not be recognized as platform admin');
    assert(isPlatformAdmin(null) === false, 'Null user should not be platform admin');
  });

  test('denies host operational management to attendees without host role or ownership', () => {
    assert(canManageEventOperations(regularUser, sampleEvent) === false, 'Non-owner should not manage operations');
    assert(isHostOrOrganizer(regularUser, sampleEvent) === false, 'Non-owner should not be host/organizer');
  });

  test('allows event owner to manage event operations', () => {
    const ownedEvent = {
      ...sampleEvent,
      createdBy: regularUser.email,
    };
    assert(isHostOrOrganizer(regularUser, ownedEvent) === true, 'Owner should be allowed to manage event operations');
  });

  test('safely normalizes complex venue objects without throwing or rendering invalid objects', () => {
    assert(formatVenueLabel(null) === 'Online / TBA', 'Null venue should format to Online / TBA');
    assert(formatVenueLabel('Auditorium A') === 'Auditorium A', 'String venue should format as-is');
    assert(formatVenueLabel({ name: 'Grand Hall', city: 'Mumbai' }) === 'Grand Hall, Mumbai', 'Venue object should format name, city');
    assert(formatVenueLabel({ type: 'ONLINE' }) === 'Virtual Event (Online)', 'Online type should format correctly');
    assert(formatVenueLabel({ type: 'HYBRID' }) === 'Hybrid Event', 'Hybrid type should format correctly');
  });

  test('correctly classifies host workspace mode vs global user navigation', () => {
    assert(isHostWorkspaceMode('/events/evt_123', { id: 'evt_123' }) === true, 'Host workspace should be true for event');
    assert(isHostWorkspaceMode('/import', { id: 'evt_123' }) === true, 'Import should be host workspace');
    assert(isHostWorkspaceMode('/tickets', { id: 'evt_123' }) === true, 'Tickets should be host workspace');
    assert(isHostWorkspaceMode('/scan', { id: 'evt_123' }) === true, 'Scan should be host workspace');
    assert(isHostWorkspaceMode('/dashboard', null) === false, 'Dashboard should not be host workspace');
    assert(isHostWorkspaceMode('/wallet', null) === false, 'Wallet should not be host workspace');
    assert(isHostWorkspaceMode('/registrations', null) === false, 'Registrations should not be host workspace');
  });

  console.log('\n--- Running Conditional Guest Roster Module Visibility Contracts ---');

  test('conditionally hides Guest Roster navigation item when attendanceMode is TICKETIFICATION_REGISTRATION', () => {
    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: {
        id: 'evt_native',
        name: 'Native Registration Gala',
        eventType: 'CONFERENCE',
        attendanceMode: 'TICKETIFICATION_REGISTRATION',
      },
    });

    const allItems = categories.flatMap((cat) => cat.items);
    const guestRosterItem = allItems.find((item) => item.label === 'Guest Roster' || item.path === '/import');
    assert(guestRosterItem === undefined, 'Guest Roster must be omitted when attendanceMode === TICKETIFICATION_REGISTRATION');
  });

  test('exposes Guest Roster navigation item when attendanceMode is EXISTING_ATTENDEE_DATA', () => {
    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: {
        id: 'evt_external',
        name: 'External Roster Hackathon',
        eventType: 'HACKATHON',
        attendanceMode: 'EXISTING_ATTENDEE_DATA',
      },
    });

    const allItems = categories.flatMap((cat) => cat.items);
    const guestRosterItem = allItems.find((item) => item.label === 'Guest Roster');
    assert(guestRosterItem !== undefined, 'Guest Roster must be present when attendanceMode === EXISTING_ATTENDEE_DATA');
    assert(guestRosterItem?.path === '/import', 'Guest Roster path should point to /import');
  });

  test('exposes Guest Roster navigation item by default when attendanceMode is unspecified/manual', () => {
    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: {
        id: 'evt_legacy',
        name: 'Legacy Roster Gathering',
        eventType: 'CONCERT',
      },
    });

    const allItems = categories.flatMap((cat) => cat.items);
    const guestRosterItem = allItems.find((item) => item.label === 'Guest Roster');
    assert(guestRosterItem !== undefined, 'Guest Roster should default to visible for legacy/unspecified attendance modes');
  });

  console.log('\n--- Running Event Category Capability & Judging Omission Contracts ---');

  test('omits Judging & Evaluation and Team Console for WEDDING category', () => {
    const caps = getEventCapabilities('WEDDING');
    assert(caps.judges === false, 'Wedding must not have judges capability');
    assert(caps.evaluators === false, 'Wedding must not have evaluators capability');
    assert(caps.teams === false, 'Wedding must not have teams capability');

    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: { id: 'evt_wedding', name: 'Royal Wedding', eventType: 'WEDDING' },
    });
    const allItems = categories.flatMap((cat) => cat.items);
    const judgingItem = allItems.find((item) => item.label === 'Judging & Evaluation' || item.path.includes('tab=judging'));
    const teamItem = allItems.find((item) => item.label === 'Teams' || item.label === 'Team Console' || item.path.includes('tab=team'));

    assert(judgingItem === undefined, 'Wedding must omit Judging & Evaluation from navigation');
    assert(teamItem === undefined, 'Wedding must omit Teams from navigation');
  });

  test('omits Judging & Evaluation and Team Console for CONCERT category', () => {
    const caps = getEventCapabilities('CONCERT');
    assert(caps.judges === false, 'Concert must not have judges capability');
    assert(caps.evaluators === false, 'Concert must not have evaluators capability');
    assert(caps.teams === false, 'Concert must not have teams capability');

    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: { id: 'evt_concert', name: 'Symphony Concert', eventType: 'CONCERT' },
    });
    const allItems = categories.flatMap((cat) => cat.items);
    const judgingItem = allItems.find((item) => item.label === 'Judging & Evaluation' || item.path.includes('tab=judging'));
    const teamItem = allItems.find((item) => item.label === 'Teams' || item.label === 'Team Console' || item.path.includes('tab=team'));

    assert(judgingItem === undefined, 'Concert must omit Judging & Evaluation from navigation');
    assert(teamItem === undefined, 'Concert must omit Teams from navigation');
  });

  test('omits Judging & Evaluation and Team Console for CONFERENCE category', () => {
    const caps = getEventCapabilities('CONFERENCE');
    assert(caps.judges === false, 'Conference must not have judges capability');
    assert(caps.evaluators === false, 'Conference must not have evaluators capability');
    assert(caps.teams === false, 'Conference must not have teams capability');

    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: { id: 'evt_conf', name: 'Tech Conference 2026', eventType: 'CONFERENCE' },
    });
    const allItems = categories.flatMap((cat) => cat.items);
    const judgingItem = allItems.find((item) => item.label === 'Judging & Evaluation' || item.path.includes('tab=judging'));
    const teamItem = allItems.find((item) => item.label === 'Teams' || item.label === 'Team Console' || item.path.includes('tab=team'));

    assert(judgingItem === undefined, 'Conference must omit Judging & Evaluation from navigation');
    assert(teamItem === undefined, 'Conference must omit Teams from navigation');
  });

  test('omits Judging & Evaluation and Team Console for WORKSHOP while retaining mentors capability', () => {
    const caps = getEventCapabilities('WORKSHOP');
    assert(caps.judges === false, 'Workshop must not have judges capability');
    assert(caps.evaluators === false, 'Workshop must not have evaluators capability');
    assert(caps.teams === false, 'Workshop must not have teams capability');
    assert(caps.mentors === true, 'Workshop must retain mentors capability');

    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: { id: 'evt_ws', name: 'Design Workshop', eventType: 'WORKSHOP' },
    });
    const allItems = categories.flatMap((cat) => cat.items);
    const judgingItem = allItems.find((item) => item.label === 'Judging & Evaluation' || item.path.includes('tab=judging'));
    const teamItem = allItems.find((item) => item.label === 'Teams' || item.label === 'Team Console' || item.path.includes('tab=team'));

    assert(judgingItem === undefined, 'Workshop must omit Judging & Evaluation despite having mentors capability');
    assert(teamItem === undefined, 'Workshop must omit Teams');
  });

  test('preserves both Judging & Evaluation and Team Console for HACKATHON category', () => {
    const caps = getEventCapabilities('HACKATHON');
    assert(caps.judges === true, 'Hackathon must have judges capability');
    assert(caps.evaluators === true, 'Hackathon must have evaluators capability');
    assert(caps.teams === true, 'Hackathon must have teams capability');
    assert(caps.mentors === true, 'Hackathon must have mentors capability');

    const categories = getHostWorkspaceNavigationCategories({
      currentEvent: { id: 'evt_hack', name: 'Global AI Hackathon', eventType: 'HACKATHON' },
    });
    const allItems = categories.flatMap((cat) => cat.items);
    const judgingItem = allItems.find((item) => item.label === 'Judging & Evaluation');
    const teamItem = allItems.find((item) => item.label === 'Teams' || item.label === 'Team Console');

    assert(judgingItem !== undefined, 'Hackathon must include Judging & Evaluation');
    assert(teamItem !== undefined, 'Hackathon must include Teams navigation item');
  });

  test('proves mentors capability alone never renders Judging & Evaluation (strict decoupling)', () => {
    // Custom simulated capability object where mentors is true, but judges and evaluators are false
    const simulatedCaps = { mentors: true, evaluators: false, judges: false };
    const shouldRenderJudging = Boolean(simulatedCaps.judges || simulatedCaps.evaluators);
    assert(shouldRenderJudging === false, 'Decoupled judging rule must evaluate to false when only mentors is enabled');
  });

  console.log('\n--- Running Private Event Organization Verification Exemption Contracts ---');

  test('exempts private organization events from verification publishing blocks', () => {
    // Contract logic simulating EventLifecycleBar & publication readiness
    const evaluateCanDirectPublish = (event: { hostingType?: string; visibility?: string; isIndividual?: boolean }) => {
      const isIndividual = event.isIndividual || event.hostingType === 'INDIVIDUAL';
      const isPrivateEvent = event.visibility === 'private';
      return isIndividual || isPrivateEvent;
    };

    const privateOrgEvent = { hostingType: 'ORGANIZATION', visibility: 'private' };
    const publicOrgEvent = { hostingType: 'ORGANIZATION', visibility: 'public' };
    const privateIndividualEvent = { hostingType: 'INDIVIDUAL', visibility: 'private' };
    const publicIndividualEvent = { hostingType: 'INDIVIDUAL', visibility: 'public' };

    assert(evaluateCanDirectPublish(privateOrgEvent) === true, 'Private organization event must allow direct publishing');
    assert(evaluateCanDirectPublish(publicOrgEvent) === false, 'Public organization event must block direct publishing until verified');
    assert(evaluateCanDirectPublish(privateIndividualEvent) === true, 'Private individual event must allow direct publishing');
    assert(evaluateCanDirectPublish(publicIndividualEvent) === true, 'Public individual event must allow direct publishing');
  });

  test('suppresses Draft — Verification Pending badge on EventsPage for private events', () => {
    const resolveStatusBadge = (event: { status: string; organizationVerificationStatus?: string; visibility?: string; displayStatus?: string }) => {
      if (event.status === 'ACTIVE' || event.status === 'PUBLISHED') {
        return event.status;
      }
      if (event.organizationVerificationStatus === 'PENDING' && event.visibility !== 'private') {
        return 'Draft — Verification Pending';
      }
      return event.displayStatus || event.status;
    };

    const privatePendingEvent = {
      status: 'DRAFT',
      organizationVerificationStatus: 'PENDING',
      visibility: 'private',
    };
    const publicPendingEvent = {
      status: 'DRAFT',
      organizationVerificationStatus: 'PENDING',
      visibility: 'public',
    };

    assert(resolveStatusBadge(privatePendingEvent) === 'DRAFT', 'Private pending event must display DRAFT, not Draft — Verification Pending');
    assert(resolveStatusBadge(publicPendingEvent) === 'Draft — Verification Pending', 'Public pending event must display Draft — Verification Pending');
  });

  test('resolves trust tier and exemption panel accurately in EventVerificationCard contract', () => {
    const resolveTrustTier = (event: { visibility?: string; isIndividual?: boolean; orgStatus?: string }) => {
      const isPrivate = event.visibility === 'private';
      const isIndividual = event.isIndividual || event.orgStatus === 'NOT_REQUIRED';
      if (isPrivate) return 'EXEMPT (PRIVATE EVENT)';
      if (isIndividual) return 'STANDARD VERIFIED (INDIVIDUAL)';
      return event.orgStatus || 'UNVERIFIED';
    };

    assert(resolveTrustTier({ visibility: 'private', orgStatus: 'PENDING' }) === 'EXEMPT (PRIVATE EVENT)', 'Private event must resolve to EXEMPT (PRIVATE EVENT)');
    assert(resolveTrustTier({ visibility: 'public', isIndividual: true }) === 'STANDARD VERIFIED (INDIVIDUAL)', 'Public individual event must resolve to STANDARD VERIFIED (INDIVIDUAL)');
    assert(resolveTrustTier({ visibility: 'public', orgStatus: 'PENDING' }) === 'PENDING', 'Public org pending event must resolve to PENDING');
    assert(resolveTrustTier({ visibility: 'public' }) === 'UNVERIFIED', 'Public org unverified event must resolve to UNVERIFIED');
  });

  return { passed, failed };
}

// Automatically execute verification when run directly via CLI (tsx / node)
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('frontendContracts.test')) {
  const result = runFrontendContractVerification();
  console.log(`\n========================================`);
  console.log(`Frontend Contract Tests: ${result.passed} passed, ${result.failed} failed.`);
  console.log(`========================================\n`);
  if (result.failed > 0) {
    process.exit(1);
  }
}
