import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  QrCode,
  Clock,
  X,
} from 'lucide-react';
import {
  eventsApi,
  EventMemberItem,
  EventStaffRole,
  InviteMemberPayload,
} from '../../api/events';

interface EventStaffCardProps {
  eventId: string;
  isHostOrAdmin?: boolean;
}

const ROLE_DEFINITIONS: Record<
  EventStaffRole,
  { label: string; description: string; colorClass: string }
> = {
  HOST: {
    label: 'Host / Organizer',
    description: 'Full administrative control over event configuration, finances, and team.',
    colorClass: 'bg-zinc-800 text-zinc-200 border-zinc-700',
  },
  COORDINATOR: {
    label: 'Coordinator',
    description: 'Can manage attendee rosters, coordinate volunteers, and oversee operations.',
    colorClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
  VOLUNTEER: {
    label: 'Volunteer / Field Staff',
    description: 'Assigned operational tasks. Can be granted credential scanning rights.',
    colorClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
  MENTOR: {
    label: 'Mentor / Guide',
    description: 'Access to assigned hacker teams or attendees for mentoring sessions.',
    colorClass: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  },
  EVALUATOR: {
    label: 'Evaluator / Judge',
    description: 'Scoring workspace with blind evaluation rubric access.',
    colorClass: 'bg-zinc-800/80 text-zinc-300 border-zinc-700',
  },
};

export const EventStaffCard: React.FC<EventStaffCardProps> = ({
  eventId,
  isHostOrAdmin = true,
}) => {
  const [members, setMembers] = useState<EventMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<EventStaffRole>('VOLUNTEER');
  const [volunteerCanScan, setVolunteerCanScan] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getMembers(eventId);
      setMembers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchMembers();
    }
  }, [eventId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setSubmittingInvite(true);
      setError(null);

      const payload: InviteMemberPayload = {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      };

      if (inviteRole === 'VOLUNTEER' && volunteerCanScan) {
        payload.customPermissions = ['VIEW_ASSIGNED_TASKS', 'SCAN_CREDENTIALS'];
      }

      const res = await eventsApi.inviteMember(eventId, payload);
      setInviteSuccessLink(res.invitationLink || (res.devToken ? `/invite/accept?token=${res.devToken}` : null));
      await fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Failed to send team invitation');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleRevoke = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to revoke this team member’s access?')) {
      return;
    }

    try {
      setActionLoading(memberId);
      await eventsApi.revokeMember(eventId, memberId);
      await fetchMembers();
    } catch (err: any) {
      alert(err?.message || 'Failed to revoke access');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyLink = (link: string) => {
    const fullUrl = window.location.origin + link;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 shadow-xl mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-zinc-300" />
            <h3 className="text-lg font-semibold text-white">Event Staff & Access Control</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
              {members.length} {members.length === 1 ? 'Member' : 'Members'}
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Invite coordinators, volunteers, evaluators, and mentors with event-scoped RBAC permissions.
          </p>
        </div>

        {isHostOrAdmin && (
          <button
            onClick={() => {
              setInviteEmail('');
              setInviteRole('VOLUNTEER');
              setVolunteerCanScan(false);
              setInviteSuccessLink(null);
              setIsInviteOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-sm rounded-xl transition duration-150 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite Staff Member
          </button>
        )}
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Roster Table */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-zinc-900/60 rounded-xl animate-pulse border border-zinc-800/60"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl">
          <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
          <h4 className="text-sm font-medium text-zinc-300 mb-1">No Team Members Yet</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-4">
            Invite your team to coordinate event admissions, evaluate submissions, or scan tickets on event day.
          </p>
          {isHostOrAdmin && (
            <button
              onClick={() => setIsInviteOpen(true)}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition"
            >
              Add First Member
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="divide-y divide-zinc-800/80">
            {members.map((member) => {
              const roleDef = ROLE_DEFINITIONS[member.role] || {
                label: member.role,
                description: '',
                colorClass: 'bg-zinc-800 text-zinc-300 border-zinc-700',
              };
              const isInvited = member.status === 'INVITED';
              const isRevoked = member.status === 'REVOKED';
              const canScan = member.permissions?.includes('SCAN_CREDENTIALS');

              return (
                <div
                  key={member._id}
                  className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 group hover:bg-zinc-900/40 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-300 uppercase">
                      {member.userEmail.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{member.userEmail}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${roleDef.colorClass}`}
                        >
                          {roleDef.label}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isInvited
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                        {canScan && (
                          <span className="flex items-center gap-1 text-zinc-300 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                            <QrCode className="w-3 h-3" /> Scanner Enabled
                          </span>
                        )}
                        <span>{member.permissions?.length || 0} permissions</span>
                        {isInvited && member.invitedAt && (
                          <span className="flex items-center gap-1 text-amber-400/80">
                            <Clock className="w-3 h-3" /> Invited
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isHostOrAdmin && (
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      {!isRevoked && member.role !== 'HOST' && (
                        <button
                          onClick={() => handleRevoke(member._id)}
                          disabled={actionLoading === member._id}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                          title="Revoke member access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => setIsInviteOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Invite Team Member</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-6">
              Enter their email and designate their event-scoped role. Secure single-use invitation tokens expire after 72 hours.
            </p>

            {inviteSuccessLink ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm mb-1">
                    <Check className="w-4 h-4" /> Invitation Generated!
                  </div>
                  <p className="text-xs text-zinc-300">
                    Share this invitation link with the member. They will sign in with their email to activate access.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.origin + inviteSuccessLink}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 font-mono truncate"
                  />
                  <button
                    onClick={() => handleCopyLink(inviteSuccessLink)}
                    className="px-3 py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setIsInviteOpen(false);
                      setInviteSuccessLink(null);
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@organization.edu"
                    className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Event Role *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['COORDINATOR', 'VOLUNTEER', 'MENTOR', 'EVALUATOR'] as EventStaffRole[]).map(
                      (r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInviteRole(r)}
                          className={`p-2.5 text-left rounded-xl border text-xs transition ${
                            inviteRole === r
                              ? 'bg-zinc-800 border-zinc-500 text-white'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div className="font-semibold text-white">{ROLE_DEFINITIONS[r].label}</div>
                          <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                            {ROLE_DEFINITIONS[r].description}
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {inviteRole === 'VOLUNTEER' && (
                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="scannerToggle"
                      checked={volunteerCanScan}
                      onChange={(e) => setVolunteerCanScan(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-700 text-white focus:ring-zinc-400 bg-zinc-800"
                    />
                    <label htmlFor="scannerToggle" className="cursor-pointer">
                      <span className="block text-xs font-medium text-white">
                        Grant Day-of-Event Ticket Scanning
                      </span>
                      <span className="block text-[11px] text-zinc-400">
                        Allows this volunteer to use the camera scanner to check in attendees.
                      </span>
                    </label>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="px-4 py-2 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
                  >
                    {submittingInvite ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventStaffCard;
