import { isPlatformAdmin, canManageEventOperations, isHostOrOrganizer, isHostWorkspaceMode } from '../utils/permissions';
import { formatVenueLabel } from '../utils/venue';

/**
 * Self-contained assertion harness for client-side type-checking & verification
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
    } catch (err) {
      failed++;
      console.error(`[FAIL] ${name}:`, err);
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

  return { passed, failed };
}
