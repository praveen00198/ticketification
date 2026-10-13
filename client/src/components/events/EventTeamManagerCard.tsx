import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Trash2,
  AlertCircle,
  Tag,
  ExternalLink,
  Github,
  MapPin,
  Search,
  CheckCircle2,
  X,
  FileText,
  UserPlus,
  Edit2,
} from 'lucide-react';
import {
  eventsApi,
  EventTeamItem,
  CreateTeamPayload,
  UpdateTeamPayload,
  TeamStatus,
  AddTeamMemberPayload,
} from '../../api/events';

interface EventTeamManagerCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const EventTeamManagerCard: React.FC<EventTeamManagerCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [teams, setTeams] = useState<EventTeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Register Team Modal
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTrack, setNewTrack] = useState('General');
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [submittingTeam, setSubmittingTeam] = useState(false);

  // Add Member Modal
  const [selectedTeamForMember, setSelectedTeamForMember] = useState<EventTeamItem | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Developer');
  const [submittingMember, setSubmittingMember] = useState(false);

  // Edit Team Modal
  const [selectedTeamForEdit, setSelectedTeamForEdit] = useState<EventTeamItem | null>(null);
  const [editTrack, setEditTrack] = useState('');
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editStatus, setEditStatus] = useState<TeamStatus>('REGISTERED');
  const [editProjectTitle, setEditProjectTitle] = useState('');
  const [editRepoUrl, setEditRepoUrl] = useState('');
  const [editDemoUrl, setEditDemoUrl] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getTeams(eventId);
      setTeams(data);
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
    } catch (err: any) {
      setError(err?.message || 'Failed to register team');
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForMember || !newMemberName.trim() || !newMemberEmail.trim()) return;

    try {
      setSubmittingMember(true);
      setError(null);

      const payload: AddTeamMemberPayload = {
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole.trim() || 'Member',
      };

      const updated = await eventsApi.addTeamMember(eventId, selectedTeamForMember._id, payload);
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));

      setSelectedTeamForMember(null);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberRole('Developer');
    } catch (err: any) {
      setError(err?.message || 'Failed to add member');
    } finally {
      setSubmittingMember(false);
    }
  };

  const handleRemoveMember = async (teamId: string, memberEmail: string) => {
    if (!confirm(`Remove ${memberEmail} from team roster?`)) return;

    try {
      setError(null);
      const updated = await eventsApi.removeTeamMember(eventId, teamId, memberEmail);
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    } catch (err: any) {
      setError(err?.message || 'Failed to remove member');
    }
  };

  const handleOpenEdit = (team: EventTeamItem) => {
    setSelectedTeamForEdit(team);
    setEditTrack(team.track || 'General');
    setEditTableNumber(team.tableNumber || '');
    setEditStatus(team.status);
    setEditProjectTitle(team.projectTitle || '');
    setEditRepoUrl(team.repoUrl || '');
    setEditDemoUrl(team.demoUrl || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamForEdit) return;

    try {
      setSubmittingEdit(true);
      setError(null);

      const payload: UpdateTeamPayload = {
        track: editTrack.trim(),
        tableNumber: editTableNumber.trim() || undefined,
        status: editStatus,
        projectTitle: editProjectTitle.trim() || undefined,
        repoUrl: editRepoUrl.trim() || undefined,
        demoUrl: editDemoUrl.trim() || undefined,
      };

      const updated = await eventsApi.updateTeam(eventId, selectedTeamForEdit._id, payload);
      setTeams((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));

      setSelectedTeamForEdit(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update team');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamName}"? This action is irreversible.`)) return;

    try {
      setError(null);
      await eventsApi.deleteTeam(eventId, teamId);
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete team');
    }
  };

  // Distinct tracks for filtering
  const distinctTracks = Array.from(new Set(teams.map((t) => t.track || 'General'))).filter(Boolean);

  const filteredTeams = teams.filter((t) => {
    if (trackFilter !== 'ALL' && (t.track || 'General') !== trackFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = t.teamName.toLowerCase().includes(q);
      const matchLeader = t.leaderName.toLowerCase().includes(q) || t.leaderEmail.toLowerCase().includes(q);
      const matchProject = t.projectTitle?.toLowerCase().includes(q);
      const matchMember = t.members.some(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      );
      if (!matchName && !matchLeader && !matchProject && !matchMember) return false;
    }
    return true;
  });

  const submittedCount = teams.filter((t) => t.status === 'SUBMITTED').length;

  return (
    <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-zinc-900">Team & Hackathon Cohort Management</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 border border-stone-200">
              {teams.length} {teams.length === 1 ? 'Team' : 'Teams'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Track participant team formations, roster limits, hacking table allocations, and project submissions.
          </p>
        </div>

        {isHostOrCoordinator && (
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register Team</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="text-[11px] font-semibold text-zinc-500">Total Registered</div>
          <div className="text-base font-bold text-zinc-900 mt-0.5">{teams.length}</div>
        </div>
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="text-[11px] font-semibold text-zinc-500">Projects Submitted</div>
          <div className="text-base font-bold text-zinc-900 mt-0.5">{submittedCount}</div>
        </div>
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="text-[11px] font-semibold text-zinc-500">Active Tracks</div>
          <div className="text-base font-bold text-zinc-900 mt-0.5">{distinctTracks.length || 1}</div>
        </div>
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="text-[11px] font-semibold text-zinc-500">Total Participants</div>
          <div className="text-base font-bold text-zinc-900 mt-0.5">
            {teams.reduce((acc, t) => acc + (t.members?.length || 1), 0)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team name, leader, project, or member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {distinctTracks.length > 0 && (
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:border-brand-500 shadow-sm"
            >
              <option value="ALL">All Tracks</option>
              {distinctTracks.map((trk) => (
                <option key={trk} value={trk}>
                  Track: {trk}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:border-brand-500 shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="FORMED">FORMED</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="DISQUALIFIED">DISQUALIFIED</option>
            <option value="WITHDRAWN">WITHDRAWN</option>
          </select>
        </div>
      </div>

      {/* Team Roster Grid */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-50 border border-zinc-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-12 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
            <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-zinc-800 mb-1">No Teams Found</h3>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              {searchQuery || trackFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No teams match your filter criteria.'
                : 'Click "Register Team" to add the first cohort to this event.'}
            </p>
          </div>
        ) : (
          filteredTeams.map((team) => {
            const isSubmitted = team.status === 'SUBMITTED';
            const isDisqualified = team.status === 'DISQUALIFIED';

            return (
              <div
                key={team._id}
                className="bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl p-4 shadow-sm transition space-y-3"
              >
                {/* Team Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900">{team.teamName}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          isSubmitted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isDisqualified
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {team.status}
                      </span>
                      {team.track && (
                        <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-200 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-zinc-500" />
                          {team.track}
                        </span>
                      )}
                      {team.tableNumber && (
                        <span className="text-[10px] font-semibold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-500" />
                          {team.tableNumber}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">
                      Lead: <span className="font-semibold text-zinc-800">{team.leaderName}</span> (
                      {team.leaderEmail})
                    </div>
                  </div>

                  {/* Actions */}
                  {isHostOrCoordinator && (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => setSelectedTeamForMember(team)}
                        disabled={team.members.length >= 6}
                        className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold rounded-lg transition disabled:opacity-40 flex items-center gap-1"
                        title="Add Member"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Add Member</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(team)}
                        className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition"
                        title="Edit Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteTeam(team._id, team.teamName)}
                        className="p-1.5 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 rounded-lg transition"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Project Details (if submitted or in progress) */}
                {(team.projectTitle || team.repoUrl || team.demoUrl) && (
                  <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-1.5">
                    {team.projectTitle && (
                      <div className="flex items-center gap-1.5 text-zinc-800 font-semibold">
                        <FileText className="w-3.5 h-3.5 text-brand-600" />
                        <span>Project: {team.projectTitle}</span>
                      </div>
                    )}
                    {team.projectDescription && (
                      <p className="text-[11px] text-zinc-600 line-clamp-2">
                        {team.projectDescription}
                      </p>
                    )}
                    <div className="flex items-center gap-3 pt-0.5">
                      {team.repoUrl && (
                        <a
                          href={team.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-700 hover:text-black font-semibold"
                        >
                          <Github className="w-3.5 h-3.5" />
                          <span>Code Repository</span>
                          <ExternalLink className="w-2.5 h-2.5 text-zinc-400" />
                        </a>
                      )}
                      {team.demoUrl && (
                        <a
                          href={team.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-stone-800 hover:text-black font-semibold underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                          <span>Live Demo</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Members Roster Pills */}
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5 flex items-center justify-between">
                    <span>
                      Team Roster ({team.members.length} / 6 members)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {team.members.map((member, idx) => {
                      const isLeader = member.email.toLowerCase() === team.leaderEmail.toLowerCase();
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs"
                        >
                          <span className="font-semibold text-zinc-800">{member.name}</span>
                          <span className="text-[10px] text-zinc-400">({member.role || 'Member'})</span>
                          {member.checkedIn && (
                            <span title="Checked In">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </span>
                          )}
                          {!isLeader && isHostOrCoordinator && (
                            <button
                              onClick={() => handleRemoveMember(team._id, member.email)}
                              className="text-zinc-400 hover:text-rose-600 ml-0.5"
                              title="Remove member"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Register Team Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900">Register New Team Cohort</h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyber Guardians"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Track</label>
                  <input
                    type="text"
                    placeholder="e.g. AI/ML, FinTech"
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Table / Booth Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Table 12, Station B"
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Team Leader Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={newLeaderName}
                    onChange={(e) => setNewLeaderName(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Leader Email</label>
                  <input
                    type="email"
                    required
                    placeholder="lead@company.com"
                    value={newLeaderEmail}
                    onChange={(e) => setNewLeaderEmail(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Initial Project Pitch (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Decentralized zero-knowledge credentials"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTeam}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingTeam ? 'Registering...' : 'Register Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {selectedTeamForMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Add Member to {selectedTeamForMember.teamName}
              </h3>
              <button
                onClick={() => setSelectedTeamForMember(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Member Name</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Member Email</label>
                <input
                  type="email"
                  required
                  placeholder="member@domain.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Roster Role</label>
                <input
                  type="text"
                  placeholder="e.g. Frontend, ML Engineer, Designer"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeamForMember(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingMember}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {selectedTeamForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900">
                Edit Team: {selectedTeamForEdit.teamName}
              </h3>
              <button
                onClick={() => setSelectedTeamForEdit(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Track</label>
                  <input
                    type="text"
                    value={editTrack}
                    onChange={(e) => setEditTrack(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Table Number</label>
                  <input
                    type="text"
                    value={editTableNumber}
                    onChange={(e) => setEditTableNumber(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TeamStatus)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                >
                  <option value="REGISTERED">REGISTERED</option>
                  <option value="FORMED">FORMED</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="DISQUALIFIED">DISQUALIFIED</option>
                  <option value="WITHDRAWN">WITHDRAWN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Project Title</label>
                <input
                  type="text"
                  value={editProjectTitle}
                  onChange={(e) => setEditProjectTitle(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Repository URL</label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    value={editRepoUrl}
                    onChange={(e) => setEditRepoUrl(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Demo / Pitch URL</label>
                  <input
                    type="url"
                    placeholder="https://demo..."
                    value={editDemoUrl}
                    onChange={(e) => setEditDemoUrl(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeamForEdit(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventTeamManagerCard;
