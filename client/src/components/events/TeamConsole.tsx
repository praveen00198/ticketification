import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
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
} from 'lucide-react';
import {
  eventsApi,
  EventTeamItem,
  CreateTeamPayload,
  TeamStatus,
  AddTeamMemberPayload,
} from '../../api/events';

interface TeamConsoleProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const TeamConsole: React.FC<TeamConsoleProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [teams, setTeams] = useState<EventTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<'teamName' | 'createdAt' | 'membersCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected Team Drawer
  const [selectedTeam, setSelectedTeam] = useState<EventTeamItem | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Register Team Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTrack, setNewTrack] = useState('General');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [submittingTeam, setSubmittingTeam] = useState(false);

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
      setTeams(data);
      // Keep selected team in sync if open
      if (selectedTeam) {
        const refreshed = data.find((t) => t._id === selectedTeam._id);
        if (refreshed) setSelectedTeam(refreshed);
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

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTeam) {
          setSelectedTeam(null);
        } else if (isRegisterOpen) {
          setIsRegisterOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTeam, isRegisterOpen]);

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
        // Search filter: team name, leader name, member names/emails
        if (query) {
          const matchTeamName = t.teamName.toLowerCase().includes(query);
          const matchLeader = (t.leaderName || '').toLowerCase().includes(query) || (t.leaderEmail || '').toLowerCase().includes(query);
          const matchMembers = (t.members || []).some(
            (m) => (m.name || '').toLowerCase().includes(query) || (m.email || '').toLowerCase().includes(query)
          );
          if (!matchTeamName && !matchLeader && !matchMembers) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== 'ALL' && t.status !== statusFilter) {
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
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
        } else {
          valA = String(a.teamName || '').toLowerCase();
          valB = String(b.teamName || '').toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [teams, searchQuery, statusFilter, trackFilter, sortField, sortOrder]);

  // Summary Metrics calculations
  const totalTeams = teams.length;
  const totalParticipants = useMemo(() => {
    return teams.reduce((acc, t) => acc + 1 + (t.members ? t.members.length : 0), 0);
  }, [teams]);
  const submittedTeams = useMemo(() => {
    return teams.filter((t) => t.status === 'SUBMITTED').length;
  }, [teams]);
  const pendingTeams = useMemo(() => {
    return teams.filter((t) => t.status === 'REGISTERED' || t.status === 'FORMED').length;
  }, [teams]);

  // Handle Team Creation
  const handleRegisterTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !newLeaderName.trim() || !newLeaderEmail.trim()) return;

    try {
      setSubmittingTeam(true);
      setError(null);

      const payload: CreateTeamPayload = {
        teamName: newTeamName.trim(),
        track: newTrack.trim() || 'General',
        tableNumber: newTableNumber.trim() || undefined,
        leaderName: newLeaderName.trim(),
        leaderEmail: newLeaderEmail.trim(),
        projectTitle: newProjectTitle.trim() || undefined,
      };

      const created = await eventsApi.createTeam(eventId, payload);
      setTeams((prev) => [created, ...prev]);
      setIsRegisterOpen(false);
      setNewTeamName('');
      setNewTrack('General');
      setNewTableNumber('');
      setNewLeaderName('');
      setNewLeaderEmail('');
      setNewProjectTitle('');
      setSelectedTeam(created);
    } catch (err: any) {
      setError(err?.message || 'Failed to register team');
    } finally {
      setSubmittingTeam(false);
    }
  };

  // Handle Add Member inside Drawer
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !memberFormName.trim() || !memberFormEmail.trim()) return;

    try {
      setSubmittingMember(true);
      const payload: AddTeamMemberPayload = {
        name: memberFormName.trim(),
        email: memberFormEmail.trim(),
        role: memberFormRole.trim() || 'Member',
      };

      const updated = await eventsApi.addTeamMember(eventId, selectedTeam._id, payload);
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setSelectedTeam(updated);
      setIsAddingMember(false);
      setMemberFormName('');
      setMemberFormEmail('');
      setMemberFormRole('Developer');
    } catch (err: any) {
      alert(err?.message || 'Failed to add team member');
    } finally {
      setSubmittingMember(false);
    }
  };

  // Handle Remove Member inside Drawer
  const handleRemoveMember = async (memberEmail: string) => {
    if (!selectedTeam) return;
    if (!window.confirm(`Remove ${memberEmail} from team?`)) return;

    try {
      const updated = await eventsApi.removeTeamMember(eventId, selectedTeam._id, memberEmail);
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setSelectedTeam(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove member');
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
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-stone-800" />
            <span>Teams & Participants</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Manage cohort registrations, team leaders, roster participants, and project submissions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchTeams}
            disabled={loading}
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer border border-stone-200 disabled:opacity-50"
            title="Refresh team roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isHostOrCoordinator && (
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Team</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Teams</span>
            <Users className="w-3.5 h-3.5 text-stone-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalTeams}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Registered cohorts</p>
        </div>

        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Participants</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalParticipants}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Leaders + members</p>
        </div>

        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Submitted Teams</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{submittedTeams}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Projects submitted</p>
        </div>

        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">In Formation</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-stone-900">{pendingTeams}</div>
          <p className="text-[10px] text-stone-400 mt-0.5">Draft / formed cohorts</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by team name, leader, participant name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto text-xs py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400 text-stone-700 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="REGISTERED">Registered</option>
              <option value="FORMED">Formed</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="DISQUALIFIED">Disqualified</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>

            {/* Track Filter */}
            {availableTracks.length > 0 && (
              <select
                value={trackFilter}
                onChange={(e) => setTrackFilter(e.target.value)}
                className="w-full sm:w-auto text-xs py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400 text-stone-700 cursor-pointer"
              >
                <option value="ALL">All Tracks</option>
                {availableTracks.map((tr) => (
                  <option key={tr} value={tr}>
                    Track: {tr}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-xl text-stone-600 transition-colors cursor-pointer shrink-0"
              title={`Sorting ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL') && (
          <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-1 border-t border-stone-100">
            <span>Filtering {filteredTeams.length} of {teams.length} teams</span>
            <button
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

      {/* ── Teams Table ── */}
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
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'ALL' || trackFilter !== 'ALL'
                ? 'Try adjusting your search keywords or filter criteria.'
                : 'Teams will appear here once attendees submit hackathon or competition registrations.'}
            </p>
            {isHostOrCoordinator && !searchQuery && (
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register First Team</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
                  <th
                    onClick={() => {
                      if (sortField === 'teamName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('teamName'); setSortOrder('asc'); }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900"
                  >
                    Team {sortField === 'teamName' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4">Team Leader</th>
                  <th className="py-3 px-4">Location / Station</th>
                  <th
                    onClick={() => {
                      if (sortField === 'membersCount') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('membersCount'); setSortOrder('desc'); }
                    }}
                    className="py-3 px-4 text-center cursor-pointer hover:text-stone-900"
                  >
                    Members {sortField === 'membersCount' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Status</th>
                  <th
                    onClick={() => {
                      if (sortField === 'createdAt') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortField('createdAt'); setSortOrder('desc'); }
                    }}
                    className="py-3 px-4 cursor-pointer hover:text-stone-900"
                  >
                    Registered On {sortField === 'createdAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTeams.map((t) => {
                  const memberCount = (t.members ? t.members.length : 0) + 1;
                  const isSelected = selectedTeam?._id === t._id;
                  return (
                    <tr
                      key={t._id}
                      onClick={() => setSelectedTeam(t)}
                      tabIndex={0}
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
                          <span className="truncate max-w-[180px]">{t.teamName}</span>
                          {t.projectTitle && (
                            <span className="text-[10px] text-stone-400 font-normal truncate hidden md:inline">
                              • {t.projectTitle}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Team Leader */}
                      <td className="py-3 px-4 text-stone-700">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-stone-900">{t.leaderName}</span>
                        </div>
                      </td>

                      {/* Location / Table */}
                      <td className="py-3 px-4 text-stone-500">
                        {t.tableNumber ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            Table {t.tableNumber}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Members Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-mono text-[11px]">
                          {memberCount}
                        </span>
                      </td>

                      {/* Track */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-medium text-[11px]">
                          {t.track || 'General'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">{getStatusBadge(t.status)}</td>

                      {/* Registered Date */}
                      <td className="py-3 px-4 text-stone-500 text-[11px] font-mono">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Contextual Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTeam(t);
                          }}
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

      {/* ── Slide-Over Team Detail Drawer (Desktop & Mobile) ── */}
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
            className="relative z-50 w-full max-w-md sm:max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 border-l border-stone-200"
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedTeam.status)}
                  <span className="text-[11px] text-stone-500 font-mono">
                    ID: {selectedTeam._id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-stone-900 truncate tracking-tight">
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
                onClick={() => setSelectedTeam(null)}
                className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
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

              {/* Team Leader Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-1.5">
                  Team Leader
                </h3>
                <div className="p-3.5 rounded-xl border border-stone-200/80 bg-white shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-900">{selectedTeam.leaderName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      Primary Contact
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="truncate">{selectedTeam.leaderEmail}</span>
                  </div>
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
                      onClick={() => setIsAddingMember(true)}
                      className="text-xs text-stone-700 hover:text-black font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add Member
                    </button>
                  )}
                </div>

                {/* Add Member Form inline */}
                {isAddingMember && (
                  <form onSubmit={handleAddMember} className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">Add Team Participant</span>
                      <button
                        type="button"
                        onClick={() => setIsAddingMember(false)}
                        className="text-xs text-stone-400 hover:text-stone-700"
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
                        className="px-3 py-1 text-xs text-stone-600 hover:bg-stone-200/60 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingMember}
                        className="px-3 py-1 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-lg disabled:opacity-50"
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
                        <div className="font-semibold text-stone-900">{m.name}</div>
                        <div className="text-[11px] text-stone-500">{m.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 font-medium">
                          {m.role || 'Member'}
                        </span>
                        {isHostOrCoordinator && (
                          <button
                            onClick={() => handleRemoveMember(m.email)}
                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                            title="Remove member"
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
                <div>Registered: {selectedTeam.createdAt ? new Date(selectedTeam.createdAt).toLocaleString() : '—'}</div>
                {selectedTeam.submittedAt && (
                  <div>Project Submitted: {new Date(selectedTeam.submittedAt).toLocaleString()}</div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-stone-200 bg-stone-50/70 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setSelectedTeam(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close Drawer
              </button>

              <button
                onClick={() => {
                  alert(`Team ${selectedTeam.teamName} details recorded.`);
                  setSelectedTeam(null);
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Register Team Modal ── */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-stone-800" />
                <h3 className="text-sm font-bold text-stone-900">Register New Team Cohort</h3>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterTeam} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Team Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quantum Pioneers"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                    Event Track
                  </label>
                  <input
                    type="text"
                    placeholder="General / AI / Web3"
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value)}
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                    Station / Table
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. T-12"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Leader Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newLeaderName}
                  onChange={(e) => setNewLeaderName(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Leader Contact Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="leader@example.com"
                  value={newLeaderEmail}
                  onChange={(e) => setNewLeaderEmail(e.target.value)}
                  required
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase mb-1">
                  Initial Project Title
                </label>
                <input
                  type="text"
                  placeholder="Optional project name"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-stone-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTeam}
                  className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  {submittingTeam ? 'Registering...' : 'Register Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
