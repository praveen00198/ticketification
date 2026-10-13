import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { eventsApi, EventMemberItem } from '../api/events';
import { ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface AcceptInvitationPageProps {
  currentUser?: { email: string } | null;
}

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ currentUser }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(false);
  const [successMember, setSuccessMember] = useState<EventMemberItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!token) {
      setError('Missing invitation token.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await eventsApi.acceptInvitation(token);
      setSuccessMember(res.member);
    } catch (err: any) {
      setError(
        err?.message ||
          'Failed to accept invitation. Ensure you are signed in with the email address that received the invite.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If user is already authenticated and token is present, we can attempt auto-acceptance
    if (token && currentUser) {
      handleAccept();
    }
  }, [token, currentUser]);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121215] border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="w-14 h-14 bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Team Invitation</h1>
        <p className="text-xs text-zinc-400 mb-6">
          You have been invited to join an event operational team on Ticketification.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-left text-xs text-red-400 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Invitation Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {successMember ? (
          <div className="space-y-5">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-left">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" /> Joined Successfully!
              </div>
              <p className="text-xs text-zinc-300">
                You are now an active <span className="font-bold text-white">{successMember.role}</span> for this event.
              </p>
            </div>

            <button
              onClick={() => navigate(`/events/${successMember.eventId}`)}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
            >
              <span>Go to Event Console</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {!currentUser ? (
              <div className="text-xs text-zinc-400 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                Please sign in to your Ticketification account using the invited email to claim this role.
              </div>
            ) : (
              <button
                onClick={handleAccept}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Invitation...</span>
                  </>
                ) : (
                  <span>Accept Invitation</span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitationPage;
