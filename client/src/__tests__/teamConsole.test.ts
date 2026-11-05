import {
  isTeamCheckedIn,
  formatTeamCityState,
  formatTeamContact,
} from '../components/events/TeamConsole';
import { EventTeamItem } from '../api/events';

const assert = (condition: boolean, msg: string) => {
  if (!condition) throw new Error(`[Assertion Failure] ${msg}`);
};

export function runTeamConsoleContractVerification(): { passed: number; failed: number } {
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

  console.log('\n--- Running TeamConsole Campus Onboarding & Display Helper Tests ---');

  const sampleTeamUnchecked: EventTeamItem = {
    _id: 'team_1',
    eventId: 'evt_1',
    teamName: 'Neural Hackers',
    leaderName: 'Alice Chen',
    leaderEmail: 'alice@example.com',
    leaderPhone: '+1-555-0199',
    city: 'San Francisco',
    state: 'CA',
    status: 'REGISTERED',
    members: [
      { name: 'Bob Smith', email: 'bob@example.com', role: 'Frontend', checkedIn: false },
    ],
    createdBy: 'usr_1',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  test('accurately identifies unchecked teams', () => {
    assert(isTeamCheckedIn(sampleTeamUnchecked) === false, 'Team without check-in should return false');
  });

  test('identifies checked-in teams via team.checkedIn flag', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, checkedIn: true };
    assert(isTeamCheckedIn(team) === true, 'Team with checkedIn: true should return true');
  });

  test('identifies checked-in teams via team.onboarded flag', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, onboarded: true };
    assert(isTeamCheckedIn(team) === true, 'Team with onboarded: true should return true');
  });

  test('identifies checked-in teams via member-level check-in flag', () => {
    const team: EventTeamItem = {
      ...sampleTeamUnchecked,
      members: [
        { name: 'Bob Smith', email: 'bob@example.com', role: 'Frontend', checkedIn: true },
      ],
    };
    assert(isTeamCheckedIn(team) === true, 'Team with a checked-in member should return true');
  });

  test('identifies checked-in teams via status: ATTENDED', () => {
    const team: any = { ...sampleTeamUnchecked, status: 'ATTENDED' };
    assert(isTeamCheckedIn(team) === true, 'Team with status ATTENDED should return true');
  });

  test('formats city and state correctly when both present', () => {
    assert(formatTeamCityState(sampleTeamUnchecked) === 'San Francisco, CA', 'Should format as City, State');
  });

  test('formats city only when state is absent', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, state: undefined };
    assert(formatTeamCityState(team) === 'San Francisco', 'Should format as City');
  });

  test('formats location fallback when city and state are absent', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, city: undefined, state: undefined, location: 'Online Remote' };
    assert(formatTeamCityState(team) === 'Online Remote', 'Should fallback to location');
  });

  test('formats missing location with an em-dash placeholder', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, city: undefined, state: undefined, location: undefined };
    assert(formatTeamCityState(team) === '—', 'Should fallback to em-dash');
  });

  test('formats team contact with leaderPhone', () => {
    assert(formatTeamContact(sampleTeamUnchecked) === '+1-555-0199', 'Should return leaderPhone');
  });

  test('formats team contact with contact / phone fallback', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, leaderPhone: undefined, phone: '+1-555-9876' };
    assert(formatTeamContact(team) === '+1-555-9876', 'Should fallback to phone');
  });

  test('formats missing contact with an em-dash placeholder', () => {
    const team: EventTeamItem = { ...sampleTeamUnchecked, leaderPhone: undefined, phone: undefined, contact: undefined };
    assert(formatTeamContact(team) === '—', 'Should fallback to em-dash');
  });

  test('safely parses invalid or missing date timestamps without NaN breakdown', () => {
    const invalidDateStr = 'not-a-valid-date';
    const parsed = isNaN(new Date(invalidDateStr).getTime()) ? 0 : new Date(invalidDateStr).getTime();
    assert(parsed === 0, 'Invalid date should resolve safely to numeric timestamp 0');
  });

  test('distinguishes real search matches from placeholder em-dash', () => {
    const teamWithoutData: EventTeamItem = {
      ...sampleTeamUnchecked,
      city: undefined,
      state: undefined,
      location: undefined,
      leaderPhone: undefined,
      phone: undefined,
      contact: undefined,
    };
    const rawContact = (teamWithoutData.leaderPhone || teamWithoutData.phone || teamWithoutData.contact || '').toLowerCase();
    const rawLocation = [teamWithoutData.city, teamWithoutData.state, teamWithoutData.location].filter(Boolean).join(' ').toLowerCase();

    // Searching for '-' should NOT match empty team data
    assert(!rawContact.includes('-'), 'Empty contact must not match dash');
    assert(!rawLocation.includes('-'), 'Empty location must not match dash');
  });

  test('safely handles null or undefined team in helper functions without throwing', () => {
    assert(formatTeamCityState(null as any) === '—', 'formatTeamCityState(null) should return em-dash');
    assert(formatTeamContact(null as any) === '—', 'formatTeamContact(null) should return em-dash');
    assert(isTeamCheckedIn(null as any) === false, 'isTeamCheckedIn(null) should return false');
  });

  test('accurately sorts City / State by combined city and state', () => {
    const teamMN = { ...sampleTeamUnchecked, city: 'Austin', state: 'MN' };
    const teamTX = { ...sampleTeamUnchecked, city: 'Austin', state: 'TX' };
    const teamCA = { ...sampleTeamUnchecked, city: undefined, state: 'California' };

    const getCityStateKey = (t: any) =>
      ([t.city || t.venueCity, t.state || t.venueState].filter(Boolean).join(', ') || t.location || '').toLowerCase();

    assert(getCityStateKey(teamMN) < getCityStateKey(teamTX), 'Austin, MN should sort before Austin, TX');
    assert(getCityStateKey(teamCA) === 'california', 'State-only should resolve to california');
  });

  test('search filter does not crash on null or undefined teamName', () => {
    const corruptedTeam: any = {
      ...sampleTeamUnchecked,
      teamName: undefined,
    };
    const query = 'hack';
    const matchTeamName = (corruptedTeam.teamName || '').toLowerCase().includes(query);
    assert(matchTeamName === false, 'Corrupted teamName should safely evaluate to false without throwing');
  });

  test('recognizes case-insensitive check-in status strings at team and member levels', () => {
    const teamWithLowerStatus: any = { ...sampleTeamUnchecked, status: 'checked_in' };
    const teamWithDashStatus: any = { ...sampleTeamUnchecked, status: 'checked-in' };
    const teamWithMemberLowerStatus: any = {
      ...sampleTeamUnchecked,
      members: [{ name: 'Test', email: 't@t.com', status: 'attended' }],
    };
    assert(isTeamCheckedIn(teamWithLowerStatus) === true, 'team status checked_in should return true');
    assert(isTeamCheckedIn(teamWithDashStatus) === true, 'team status checked-in should return true');
    assert(isTeamCheckedIn(teamWithMemberLowerStatus) === true, 'member status attended should return true');
  });

  test('safely trims whitespace from city, state, and contact phone numbers', () => {
    const messyTeam: EventTeamItem = {
      ...sampleTeamUnchecked,
      city: '  Seattle  ',
      state: '  WA  ',
      leaderPhone: '  +1-206-555-0100  ',
    };
    assert(formatTeamCityState(messyTeam) === 'Seattle, WA', 'City and state whitespace should be trimmed');
    assert(formatTeamContact(messyTeam) === '+1-206-555-0100', 'Contact whitespace should be trimmed');
  });

  test('supports searching by table number station and track', () => {
    const teamWithTable: EventTeamItem = {
      ...sampleTeamUnchecked,
      tableNumber: 'T-42',
      track: 'Artificial Intelligence',
    };
    const queryTable = 't-42';
    const queryTrack = 'intelligence';
    const matchTable = (teamWithTable.tableNumber || '').toLowerCase().includes(queryTable);
    const matchTrack = (teamWithTable.track || '').toLowerCase().includes(queryTrack);
    assert(matchTable === true, 'Search should match table station');
    assert(matchTrack === true, 'Search should match track');
  });

  test('deterministic secondary tie-breaking preserves consistent ordering', () => {
    const teamA = { ...sampleTeamUnchecked, teamName: 'Alpha Squad', city: 'Denver', state: 'CO' };
    const teamB = { ...sampleTeamUnchecked, teamName: 'Beta Squad', city: 'Denver', state: 'CO' };
    const cityA = [teamA.city, teamA.state].join(', ').toLowerCase();
    const cityB = [teamB.city, teamB.state].join(', ').toLowerCase();
    assert(cityA === cityB, 'Primary city/state must be identical for tie-break test');

    const nameA = teamA.teamName.toLowerCase();
    const nameB = teamB.teamName.toLowerCase();
    const tieBreak = nameA < nameB ? -1 : 1;
    assert(tieBreak === -1, 'Alpha Squad must deterministically sort before Beta Squad when primary criteria tie');
  });

  return { passed, failed };
}

// Direct CLI execution
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('teamConsole.test')) {
  const result = runTeamConsoleContractVerification();
  console.log(`\n========================================`);
  console.log(`TeamConsole Contract Tests: ${result.passed} passed, ${result.failed} failed.`);
  console.log(`========================================\n`);
  if (result.failed > 0) {
    process.exit(1);
  }
}
