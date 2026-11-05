import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  X,
  ExternalLink,
  Github,
  UserCheck,
  Mail,
  Tag,
  MapPin,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Clock,
  UserPlus,
  Phone,
} from 'lucide-react';
import {
  eventsApi,
  EventTeamItem,
  TeamStatus,
  AddTeamMemberPayload,
} from '../../api/events';

interface TeamConsoleProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

/**
 * Resolves whether a team or any of its members has completed campus arrival onboarding / QR scan check-in.
 */
export const isTeamCheckedIn = (team: EventTeamItem): boolean => {
  if (!team) return false;
  if (team.checkedIn === true || team.onboarded === true) return true;
  const teamStatus = typeof (team as any).status === 'string' ? (team as any).status.toUpperCase().trim() : '';
  if (teamStatus === 'ATTENDED' || teamStatus === 'CHECKED_IN' || teamStatus === 'CHECKED-IN') return true;
  if (
    team.members &&
    Array.isArray(team.members) &&
    team.members.some((m) => {
      if (!m) return false;
      if (m.checkedIn === true || (m as any).onboarded === true) return true;
      const memberStatus = typeof (m as any).status === 'string' ? (m as any).status.toUpperCase().trim() : '';
      return memberStatus === 'ATTENDED' || memberStatus === 'CHECKED_IN' || memberStatus === 'CHECKED-IN';
    })
  ) {
    return true;
  }
  return false;
};

/**
 * Normalizes city/state representation for table and drawer display.
 */
export const formatTeamCityState = (team: EventTeamItem): string => {
  if (!team) return '—';
  const city = typeof team.city === 'string' ? team.city.trim() : typeof (team as any).venueCity === 'string' ? (team as any).venueCity.trim() : '';
  const state = typeof team.state === 'string' ? team.state.trim() : typeof (team as any).venueState === 'string' ? (team as any).venueState.trim() : '';
  if (city && state) return `${city}, ${state}`;
  if (city) return city;
  if (state) return state;
  if (team.location && typeof team.location === 'string' && team.location.trim()) {
    return team.location.trim();
  }
  return '—';
};

/**
 * Normalizes contact/phone number representation for table and drawer display.
 */
export const formatTeamContact = (team: EventTeamItem): string => {
  if (!team) return '—';
  const raw = team.leaderPhone || team.phone || team.contact;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return '—';
};

export const TeamConsole: React.FC<TeamConsoleProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [teams, setTeams] = useState<EventTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHECKED_IN' | 'NOT_CHECKED_IN'>('ALL');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<
    'createdAt' | 'teamName' | 'leaderName' | 'contact' | 'email' | 'cityState' | 'checkedIn' | 'membersCount'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected Team Drawer
  const [selectedTeam, setSelectedTeam] = useState<EventTeamItem | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Add Member State inside Drawer
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberFormName, setMemberFormName] = useState('');
  const [memberFormEmail, setMemberFormEmail] = useState('');
  const [memberFormRole, setMemberFormRole] = useState('Developer');
  const [submittingMember, setSubmittingMember] = useState(false);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getTeams(eventId);
      const safeData = Array.isArray(data) ? data : [];
      setTeams(safeData);
      // Keep selected team in sync if open
      if (selectedTeam) {
        const refreshed = safeData.find((t) => t._id === selectedTeam._id);
        if (refreshed) {
          setSelectedTeam((prev) => (prev ? { ...prev, ...refreshed } : refreshed));
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load event teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchTeams();
    }
  }, [eventId]);

  // Lock body scroll and set focus when drawer is open; restore on close
  useEffect(() => {
    if (selectedTeam) {
      setDrawerError(null);
      lastActiveElementRef.current = document.activeElement as HTMLElement;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      closeButtonRef.current?.focus();
      return () => {
        document.body.style.overflow = originalOverflow;
        lastActiveElementRef.current?.focus?.();
      };
    }
  }, [selectedTeam ? selectedTeam._id : null]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTeam) {
          setSelectedTeam(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTeam]);

  // Accessible focus trap inside drawer modal
  const handleDrawerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  // Available tracks extracted from existing data
  const availableTracks = useMemo(() => {
    const tracks = new Set<string>();
    teams.forEach((t) => {
      if (t.track) tracks.add(t.track);
    });
    return Array.from(tracks);
  }, [teams]);

  // Filtered & Sorted Teams
  const filteredTeams = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return teams
      .filter((t) => {
        if (!t) return false;
        // Search filter across Team Name, Leader Name, Contact, Email, City/State, Table, Track, Members, Project Title
        if (query) {
          const matchTeamName = (t.teamName || '').toLowerCase().includes(query);
          const rawContact = (t.leaderPhone || t.phone || t.contact || '').toLowerCase();
          const matchLeader =
            (t.leaderName || '').toLowerCase().includes(query) ||
            (t.leaderEmail || '').toLowerCase().includes(query) ||
            rawContact.includes(query);
          const rawLocation = [t.city, t.state, (t as any).venueCity, (t as any).venueState, t.location]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          const matchLocation = rawLocation.includes(query);
          const matchTable = (t.tableNumber || '').toLowerCase().includes(query);
          const matchTrack = (t.track || '').toLowerCase().includes(query);
          const matchProject = (t.projectTitle || '').toLowerCase().includes(query);
          const matchMembers = (t.members || []).some(
            (m) =>
              m &&
              ((m.name || '').toLowerCase().includes(query) ||
                (m.email || '').toLowerCase().includes(query) ||
                (m.role || '').toLowerCase().includes(query))
          );

          if (!matchTeamName && !matchLeader && !matchLocation && !matchTable && !matchTrack && !matchProject && !matchMembers) {
            return false;
          }
        }

        // Campus Onboarding Status filter (QR scan check-in state)
        if (statusFilter === 'CHECKED_IN' && !isTeamCheckedIn(t)) {
          return false;
        }
        if (statusFilter === 'NOT_CHECKED_IN' && isTeamCheckedIn(t)) {
          return false;
        }

        // Track filter
        if (trackFilter !== 'ALL' && t.track !== trackFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortField === 'membersCount') {
          valA = (a.members || []).length + 1;
          valB = (b.members || []).length + 1;
        } else if (sortField === 'createdAt') {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          valA = isNaN(timeA) ? 0 : timeA;
          valB = isNaN(timeB) ? 0 : timeB;
        } else if (sortField === 'leaderName') {
          valA = String(a.leaderName || '').toLowerCase().trim();
          valB = String(b.leaderName || '').toLowerCase().trim();
        } else if (sortField === 'contact') {
          valA = String(a.leaderPhone || a.phone || a.contact || '').toLowerCase().trim();
          valB = String(b.leaderPhone || b.phone || b.contact || '').toLowerCase().trim();
        } else if (sortField === 'email') {
          valA = String(a.leaderEmail || '').toLowerCase().trim();
          valB = String(b.leaderEmail || '').toLowerCase().trim();
        } else if (sortField === 'cityState') {
          const cityStateA = [a.city || (a as any).venueCity, a.state || (a as any).venueState].filter(Boolean).join(', ') || a.location || '';
          const cityStateB = [b.city || (b as any).venueCity, b.state || (b as any).venueState].filter(Boolean).join(', ') || b.location || '';
          valA = cityStateA.toLowerCase().trim();
          valB = cityStateB.toLowerCase().trim();
        } else if (sortField === 'checkedIn') {
          valA = isTeamCheckedIn(a) ? 1 : 0;
          valB = isTeamCheckedIn(b) ? 1 : 0;
        } else {
          valA = String(a.teamName || '').toLowerCase().trim();
          valB = String(b.teamName || '').toLowerCase().trim();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;

        // Secondary deterministic tie-breaker by teamName
        const nameA = String(a.teamName || '').toLowerCase().trim();
        const nameB = String(b.teamName || '').toLowerCase().trim();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
  }, [teams, searchQuery, statusFilter, trackFilter, sortField, sortOrder]);

  // 3 Essential Summary Metrics (omitting "In Formation" / draft cohorts)
  const totalTeams = teams.length;
  const totalParticipants = useMemo(() => {
    return teams.reduce((acc, t) => acc + 1 + (t.members ? t.members.length : 0), 0);
  }, [teams]);
  const submittedTeams = useMemo(() => {
    return teams.filter((t) => t.status === 'SUBMITTED').length;
  }, [teams]);

  // Handle Add Member inside Drawer
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !memberFormName.trim() || !memberFormEmail.trim()) return;

    try {
      setSubmittingMember(true);
      setDrawerError(null);
      const payload: AddTeamMemberPayload = {
        name: memberFormName.trim(),
        email: memberFormEmail.trim(),
        role: memberFormRole.trim() || 'Member',
      };

      const updated = await eventsApi.addTeamMember(eventId, selectedTeam._id, payload);
      const merged = { ...selectedTeam, ...updated };
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? { ...t, ...updated } : t)));
      setSelectedTeam(merged);
      setIsAddingMember(false);
      setMemberFormName('');
      setMemberFormEmail('');
      setMemberFormRole('Developer');
    } catch (err: any) {
      setDrawerError(err?.message || 'Failed to add team member');
    } finally {
      setSubmittingMember(false);
    }
  };

  // Handle Remove Member inside Drawer
  const handleRemoveMember = async (memberEmail: string) => {
    if (!selectedTeam) return;
    if (!window.confirm(`Remove ${memberEmail} from team?`)) return;

    try {
      setDrawerError(null);
      const updated = await eventsApi.removeTeamMember(eventId, selectedTeam._id, memberEmail);
      const merged = { ...selectedTeam, ...updated };
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? { ...t, ...updated } : t)));
      setSelectedTeam(merged);
    } catch (err: any) {
      setDrawerError(err?.message || 'Failed to remove member');
    }
  };

  // Column sort click handler
  const handleHeaderSort = (
    field: 'teamName' | 'leaderName' | 'contact' | 'email' | 'cityState' | 'checkedIn' | 'createdAt'
  ) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const getStatusBadge = (status: TeamStatus) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Submitted
          </span>
        );
      case 'FORMED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Users className="w-3 h-3 text-sky-600" />
            Formed
          </span>
        );
      case 'DISQUALIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Disqualified
          </span>
        );
      case 'WITHDRAWN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
            Registered
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header (R1: Concise title 'Teams', host registration CTA removed) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-stone-800" />
            <span>Teams</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Overview of registered participant cohorts, team rosters, and campus check-in status.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchTeams}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer border border-stone-200 disabled:opacity-50"
            title="Refresh teams roster"
            aria-label="Refresh teams roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Summary Metrics (R2: Exactly 3 essential cards, omitting 'In Formation') ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Teams */}
        <div className="bg-white border border-stone-200/90 p-4 sm:p-5 rounded-2xl shadow-xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Teams
            </span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            {totalTeams}
          </div>
          <p className="text-xs text-stone-500 mt-1">Registered cohorts</p>
        </div>

        {/* Card 2: Total Participants */}
        <div className="bg-white border border-stone-200/90 p-4 sm:p-5 rounded-2xl shadow-xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Participants
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            {totalParticipants}
          </div>
          <p className="text-xs text-stone-500 mt-1">Leaders + members</p>
        </div>

        {/* Card 3: Submitted Teams */}
        <div className="bg-white border border-stone-200/90 p-4 sm:p-5 rounded-2xl shadow-xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Submitted Teams
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            {submittedTeams}
          </div>
          <p className="text-xs text-stone-500 mt-1">Projects submitted</p>
        </div>
      </div>

      {/* ── Search & Filter Controls (R3: Polished search bar, campus onboarding filter, functional sorting) ── */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Polished Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by team name, leader, contact, email, or city/state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search teams by name, leader, contact, email, or city/state"
              className="w-full pl-9 pr-9 py-2.5 text-xs bg-stone-50 border border-stone-200/90 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold p-1 cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Campus Onboarding Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-auto text-xs py-2.5 px-3 bg-stone-50 border border-stone-200/90 rounded-xl focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-stone-800 font-medium cursor-pointer shadow-2xs"
              aria-label="Campus Onboarding Status Filter"
            >
              <option value="ALL">All Onboarding Statuses</option>
              <option value="CHECKED_IN">Checked-In / Onboarded</option>
              <option value="NOT_CHECKED_IN">Not Checked-In</option>
            </select>

            {/* Optional Track Filter */}
            {availableTracks.length > 0 && (
              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                className="w-full sm:w-auto text-xs py-2.5 px-3 bg-stone-50 border border-stone-200/90 rounded-xl focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-stone-800 font-medium cursor-pointer shadow-2xs"
                aria-label="Track Filter"
              >
                <option value="ALL">All Tracks</option>
                {availableTracks.map((tr) => (
                  <option key={tr} value={tr}>
                    Track: {tr}
                  </option>
                ))}
              </select>
            )}

            {/* Functional Sort Control Dropdown */}
            <select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortField(field as any);
                setSortOrder(order as any);
              }}
              className="w-full sm:w-auto text-xs py-2.5 px-3 bg-stone-50 border border-stone-200/90 rounded-xl focus:bg-white focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 text-stone-800 font-medium cursor-pointer shadow-2xs"
              aria-label="Sort Teams"
            >
              <option value="createdAt-desc">Sort: Newest Registered</option>
              <option value="createdAt-asc">Sort: Oldest Registered</option>
              <option value="teamName-asc">Sort: Team Name (A–Z)</option>
              <option value="teamName-desc">Sort: Team Name (Z–A)</option>
              <option value="leaderName-asc">Sort: Team Leader (A–Z)</option>
              <option value="leaderName-desc">Sort: Team Leader (Z–A)</option>
              <option value="contact-asc">Sort: Contact (A–Z)</option>
              <option value="contact-desc">Sort: Contact (Z–A)</option>
              <option value="email-asc">Sort: Email (A–Z)</option>
              <option value="email-desc">Sort: Email (Z–A)</option>
              <option value="cityState-asc">Sort: City/State (A–Z)</option>
              <option value="cityState-desc">Sort: City/State (Z–A)</option>
              <option value="checkedIn-desc">Sort: Checked-In First</option>
              <option value="checkedIn-asc">Sort: Not Checked-In First</option>
              <option value="membersCount-desc">Sort: Most Members</option>
              <option value="membersCount-asc">Sort: Fewest Members</option>
            </select>

            {/* Sort Order Direction Toggle */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2.5 border border-stone-200/90 bg-stone-50 hover:bg-stone-100 rounded-xl text-stone-600 hover:text-stone-900 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title={`Sorting ${sortOrder === 'asc' ? 'Ascending' : 'Descending'} (click to toggle)`}
              aria-label="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL') && (
          <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-2 border-t border-stone-100">
            <span>
              Showing <strong className="text-stone-900">{filteredTeams.length}</strong> of{' '}
              <strong className="text-stone-900">{teams.length}</strong> teams
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setTrackFilter('ALL');
              }}
              className="text-stone-700 hover:text-stone-900 underline font-semibold ml-2 cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ── Teams Table (R4: Minimal tabular data: Team Name, Team Leader, Contact, Email, City/State) ── */}
      <div className="bg-white border border-stone-200/90 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-stone-500 font-medium">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-400" />
            Loading teams roster...
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-stone-900">
              {searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL'
                ? 'No matching teams found'
                : 'No teams registered yet'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL'
                ? 'Try adjusting your search keywords or campus onboarding filter criteria.'
                : 'Registered teams will appear here once attendees submit hackathon or competition registrations.'}
            </p>
            {(searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTrackFilter('ALL');
                }}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            {/* No '+ Register Team' or '+ Register First Team' button here per R1 */}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'teamName' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('teamName')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('teamName');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Team Name</span>
                      {sortField === 'teamName' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'leaderName' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('leaderName')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('leaderName');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Team Leader</span>
                      {sortField === 'leaderName' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'contact' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('contact')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('contact');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Contact</span>
                      {sortField === 'contact' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'email' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('email')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('email');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Email</span>
                      {sortField === 'email' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'cityState' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('cityState')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('cityState');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>City / State</span>
                      {sortField === 'cityState' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th
                    role="columnheader"
                    tabIndex={0}
                    aria-sort={sortField === 'checkedIn' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => handleHeaderSort('checkedIn')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleHeaderSort('checkedIn');
                      }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900 select-none focus:outline-hidden focus:bg-stone-100"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sortField === 'checkedIn' && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTeams.map((t) => {
                  const isSelected = selectedTeam?._id === t._id;
                  const checkedIn = isTeamCheckedIn(t);

                  return (
                    <tr
                      key={t._id}
                      onClick={() => setSelectedTeam(t)}
                      tabIndex={0}
                      aria-label={`Select team ${t.teamName || 'team'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTeam(t);
                        }
                      }}
                      className={`hover:bg-stone-50/80 transition-colors cursor-pointer focus:outline-hidden focus:bg-stone-100/60 ${
                        isSelected ? 'bg-stone-100/70 font-medium' : ''
                      }`}
                    >
                      {/* Team Name */}
                      <td className="py-3 px-4 font-semibold text-stone-900">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{t.teamName || 'Untitled Team'}</span>
                          {t.projectTitle && (
                            <span className="text-[10px] text-stone-400 font-normal truncate hidden lg:inline max-w-[180px]">
                              • {t.projectTitle}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Leader */}
                      <td className="py-3 px-4 text-stone-800 font-medium">
                        {t.leaderName || '—'}
                      </td>

                      {/* Contact / Phone */}
                      <td className="py-3 px-4 text-stone-600 font-mono text-[11px]">
                        {formatTeamContact(t)}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-stone-600 truncate max-w-[200px]">
                        {t.leaderEmail || '—'}
                      </td>

                      {/* City / State */}
                      <td className="py-3 px-4 text-stone-600">
                        {formatTeamCityState(t)}
                      </td>

                      {/* Campus Onboarding Status */}
                      <td className="py-3 px-4">
                        {checkedIn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Checked-In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                            Not Checked-In
                          </span>
                        )}
                      </td>

                      {/* Contextual Action Button */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(t);
                          }}
                          aria-label={`View details for ${t.teamName || 'team'}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer text-[11px] font-semibold"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3 h-3 text-stone-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide-Over Team Detail Drawer (R4: Displays complete details for team and roster) ── */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={() => setSelectedTeam(null)}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-drawer-title"
            onKeyDown={handleDrawerKeyDown}
            className="relative z-50 w-full max-w-md sm:max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 border-l border-stone-200"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {isTeamCheckedIn(selectedTeam) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Checked-In / Onboarded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                      Not Checked-In
                    </span>
                  )}
                  {getStatusBadge(selectedTeam.status)}
                  <span className="text-[11px] text-stone-500 font-mono">
                    ID: {selectedTeam._id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <h2 id="team-drawer-title" className="text-xl font-bold text-stone-900 truncate tracking-tight">
                  {selectedTeam.teamName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-stone-400" />
                    Track: {selectedTeam.track || 'General'}
                  </span>
                  {selectedTeam.tableNumber && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      Table: {selectedTeam.tableNumber}
                    </span>
                  )}
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
              {/* Inline Drawer Error Banner */}
              {drawerError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{drawerError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerError(null)}
                    className="text-rose-500 hover:text-rose-800 text-xs font-bold cursor-pointer"
                    aria-label="Dismiss error"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Campus Onboarding & Location Summary */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-1.5">
                  Campus Onboarding & Location
                </h3>
                <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Onboarding Status:</span>
                    {isTeamCheckedIn(selectedTeam) ? (
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Onboarded via turnstile QR verification
                      </span>
                    ) : (
                      <span className="text-stone-600 font-medium">Awaiting campus turnstile arrival</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">City / State:</span>
                    <span className="font-semibold text-stone-900">
                      {formatTeamCityState(selectedTeam)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Table / Workstation:</span>
                    <span className="font-mono text-stone-800">
                      {selectedTeam.tableNumber ? `Table ${selectedTeam.tableNumber}` : 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Team Leader Contact Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-1.5">
                  Primary Contact (Team Leader)
                </h3>
                <div className="p-3.5 rounded-xl border border-stone-200/80 bg-white shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">{selectedTeam.leaderName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      Team Lead
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="font-mono">{formatTeamContact(selectedTeam)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{selectedTeam.leaderEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project / Submission Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-1.5">
                  Project & Submission
                </h3>
                <div className="bg-stone-50/70 border border-stone-200/80 rounded-xl p-3.5 space-y-2">
                  <div>
                    <div className="text-[10px] font-bold text-stone-400 uppercase">Project Title</div>
                    <div className="text-xs font-semibold text-stone-900">
                      {selectedTeam.projectTitle || 'No project title registered yet'}
                    </div>
                  </div>
                  {selectedTeam.projectDescription && (
                    <div>
                      <div className="text-[10px] font-bold text-stone-400 uppercase">Description</div>
                      <div className="text-xs text-stone-700 mt-0.5 leading-relaxed">
                        {selectedTeam.projectDescription}
                      </div>
                    </div>
                  )}

                  {/* Submission Links */}
                  {(selectedTeam.repoUrl || selectedTeam.demoUrl) && (
                    <div className="flex items-center gap-3 pt-2 border-t border-stone-200/60">
                      {selectedTeam.repoUrl && (
                        <a
                          href={selectedTeam.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-stone-700 hover:text-black font-semibold hover:underline"
                        >
                          <Github className="w-3.5 h-3.5" /> Repository
                        </a>
                      )}
                      {selectedTeam.demoUrl && (
                        <a
                          href={selectedTeam.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Live Demo
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Team Members List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Roster Participants ({(selectedTeam.members || []).length + 1})
                  </h3>
                  {isHostOrCoordinator && !isAddingMember && (
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(true)}
                      className="text-xs text-stone-700 hover:text-black font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add Member
                    </button>
                  )}
                </div>

                {/* Add Member Form inline */}
                {isAddingMember && (
                  <form
                    onSubmit={handleAddMember}
                    className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">Add Team Participant</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingMember(false)}
                        className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Participant Full Name"
                      value={memberFormName}
                      onChange={(e) => setMemberFormName(e.target.value)}
                      required
                      className="w-full text-xs p-2 bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:border-stone-400"
                    />
                    <input
                      type="email"
                      placeholder="Participant Email"
                      value={memberFormEmail}
                      onChange={(e) => setMemberFormEmail(e.target.value)}
                      required
                      className="w-full text-xs p-2 bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:border-stone-400"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Frontend, Designer, ML Engineer)"
                      value={memberFormRole}
                      onChange={(e) => setMemberFormRole(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:border-stone-400"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsAddingMember(false)}
                        className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-200/60 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingMember}
                        className="px-3 py-1 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        {submittingMember ? 'Adding...' : 'Save Member'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Leader listed first */}
                <div className="p-3 rounded-xl bg-stone-50/70 border border-stone-200/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                      <span>{selectedTeam.leaderName}</span>
                      <span className="text-[10px] text-stone-500 font-normal">(Leader)</span>
                    </div>
                    <div className="text-[11px] text-stone-500">{selectedTeam.leaderEmail}</div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-stone-200/70 text-stone-700">
                    Team Lead
                  </span>
                </div>

                {/* Additional Members */}
                {selectedTeam.members && selectedTeam.members.length > 0 ? (
                  selectedTeam.members.map((m, idx) => (
                    <div
                      key={m.email || idx}
                      className="p-3 rounded-xl bg-white border border-stone-200/70 flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-stone-900 flex items-center gap-2">
                          <span>{m.name}</span>
                          {m.checkedIn && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              Checked In
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">{m.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                          {m.role || 'Member'}
                        </span>
                        {isHostOrCoordinator && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.email)}
                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Remove member"
                            aria-label={`Remove member ${m.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-stone-400 italic text-center py-2">
                    No additional team members added.
                  </p>
                )}
              </div>

              {/* Registration Timestamps */}
              <div className="space-y-2 pt-2 border-t border-stone-100 text-[11px] text-stone-400 font-mono">
                <div>
                  Registered: {selectedTeam.createdAt ? new Date(selectedTeam.createdAt).toLocaleString() : '—'}
                </div>
                {selectedTeam.submittedAt && (
                  <div>Project Submitted: {new Date(selectedTeam.submittedAt).toLocaleString()}</div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-stone-200 bg-stone-50/70 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
