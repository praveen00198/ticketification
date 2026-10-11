import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  AlertCircle,
  Tag,
  BookOpen,
  Scale,
  X,
} from 'lucide-react';
import {
  eventsApi,
  EventAssignmentItem,
  EventMemberItem,
  AssignmentRole,
  CreateAssignmentPayload,
} from '../../api/events';

interface EventAssignmentCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const EventAssignmentCard: React.FC<EventAssignmentCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [assignments, setAssignments] = useState<EventAssignmentItem[]>([]);
  const [members, setMembers] = useState<EventMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MENTOR' | 'EVALUATOR'>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [role, setRole] = useState<AssignmentRole>('MENTOR');
  const [track, setTrack] = useState('');
  const [targetName, setTargetName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fetchedAssignments, fetchedMembers] = await Promise.all([
        eventsApi.getAssignments(eventId),
        eventsApi.getMembers(eventId, 'ACTIVE'),
      ]);
      setAssignments(fetchedAssignments);
      setMembers(fetchedMembers);
    } catch (err: any) {
      setError(err?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchData();
    }
  }, [eventId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !targetName.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const payload: CreateAssignmentPayload = {
        memberId: selectedMemberId,
        role,
        track: track.trim() || undefined,
        targetName: targetName.trim(),
        assignedTargetType: 'TRACK',
        notes: notes.trim() || undefined,
      };

      await eventsApi.createAssignment(eventId, payload);
      setIsModalOpen(false);
      resetModal();
      await fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetModal = () => {
    setSelectedMemberId('');
    setRole('MENTOR');
    setTrack('');
    setTargetName('');
    setNotes('');
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;

    try {
      await eventsApi.deleteAssignment(eventId, assignmentId);
      await fetchData();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove assignment');
    }
  };

  const eligibleMembers = members.filter(
    (m) => m.role === role || m.role === 'HOST' || m.role === 'COORDINATOR'
  );

  const filteredAssignments = assignments.filter((a) => {
    if (roleFilter === 'ALL') return true;
    return a.role === roleFilter;
  });

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Mentor & Evaluator Scoping</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
              {assignments.length} {assignments.length === 1 ? 'Assignment' : 'Assignments'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Assign problem tracks, hackathon cohorts, and blind evaluation rubrics to mentors and judges.
          </p>
        </div>

        {isHostOrCoordinator && (
          <button
            onClick={() => {
              resetModal();
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm rounded-xl transition duration-150 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Assign Mentor / Judge
          </button>
        )}
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-2">
        {(['ALL', 'MENTOR', 'EVALUATOR'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              roleFilter === r
                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
            }`}
          >
            {r === 'ALL' ? 'All Roles' : r === 'MENTOR' ? 'Mentors' : 'Evaluators / Judges'}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Assignment List */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-zinc-900/60 rounded-xl animate-pulse border border-zinc-800/60"
            />
          ))}
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
          <Scale className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-zinc-300 mb-1">No Track Assignments Yet</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
            Link mentors and evaluators to specific tracks or team cohorts to initiate blind review and guidance.
          </p>
          {isHostOrCoordinator && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition"
            >
              Create First Assignment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssignments.map((assignment) => {
            const isMentor = assignment.role === 'MENTOR';
            const memberEmail =
              typeof assignment.memberId === 'object' && assignment.memberId?.userEmail
                ? assignment.memberId.userEmail
                : 'Team Member';

            return (
              <div
                key={assignment._id}
                className="p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {assignment.targetName}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        isMentor
                          ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                          : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {assignment.role}
                    </span>
                    {assignment.track && (
                      <span className="flex items-center gap-1 text-[11px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                        <Tag className="w-3 h-3 text-zinc-500" /> Track: {assignment.track}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1 flex-wrap">
                    <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Assigned to: <span className="text-white font-mono">{memberEmail}</span>
                    </span>
                    {assignment.mentorshipLogs?.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        {assignment.mentorshipLogs.length} Advice Logs
                      </span>
                    )}
                  </div>

                  {assignment.notes && (
                    <p className="text-xs text-zinc-500 italic mt-1">{assignment.notes}</p>
                  )}
                </div>

                {isHostOrCoordinator && (
                  <button
                    onClick={() => handleDeleteAssignment(assignment._id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition self-end md:self-auto"
                    title="Remove assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Assign Mentor or Evaluator</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Bind a verified staff member to an evaluation track, judging rubric, or mentorship cohort.
            </p>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Role Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('MENTOR');
                      setSelectedMemberId('');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                      role === 'MENTOR'
                        ? 'bg-teal-500/15 border-teal-500 text-teal-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    Mentor / Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRole('EVALUATOR');
                      setSelectedMemberId('');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                      role === 'EVALUATOR'
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    Evaluator / Judge
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Select Team Member *
                </label>
                <select
                  required
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="">-- Choose {role} --</option>
                  {eligibleMembers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.userEmail} ({m.role})
                    </option>
                  ))}
                </select>
                {eligibleMembers.length === 0 && (
                  <p className="text-[11px] text-amber-400/80 mt-1">
                    No active members found with role {role}. Invite one under Staff Management above.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Label / Scope Name *
                </label>
                <input
                  type="text"
                  required
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  placeholder="e.g. Track: AI & Machine Learning, Cohort 3, or Team Alpha"
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Track Name (Optional)
                </label>
                <input
                  type="text"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  placeholder="e.g. Fintech, Healthcare, Open Innovation"
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Special Instructions / Briefing Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Review guidelines, rubric criteria or mentorship goals..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedMemberId}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                >
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventAssignmentCard;
