import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, Ticket, ShieldCheck, LogIn, UserPlus } from 'lucide-react';
import { attendeeApi, RegisterEventDTO } from '../../api/attendee';
import { getStoredAuthToken } from '../../api/client';
import { useNavigate } from 'react-router-dom';

interface EventRegistrationModalProps {
  eventId: string;
  eventName: string;
  eventType: string;
  credentialTerminology?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
  eventId,
  eventName,
  eventType,
  credentialTerminology = 'Pass',
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const token = getStoredAuthToken();

  const [formData, setFormData] = useState<RegisterEventDTO>({
    phone: '',
    organization: '',
    designation: '',
    teamName: '',
    responses: {
      github: '',
      dietary: 'None',
      experienceLevel: 'Intermediate',
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedResult, setIssuedResult] = useState<{
    registration: any;
    credential: any;
  } | null>(null);

  if (!isOpen) return null;

  const isHackathon = ['HACKATHON', 'COMPETITION', 'COLLEGE_EVENT'].includes(eventType.toUpperCase());
  const isConferenceOrWorkshop = ['CONFERENCE', 'WORKSHOP', 'SEMINAR'].includes(eventType.toUpperCase());

  const currentRedirect = encodeURIComponent(window.location.pathname);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Please sign in or create an account to claim your pass.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await attendeeApi.registerForEvent(eventId, formData);
      if (res.success && res.data) {
        setIssuedResult(res.data);
        if (onSuccess) onSuccess(res.data);
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Registration failed.';
      if (err?.response?.status === 401) {
        setError('Your session has expired. Please sign in again to complete registration.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-stone-200/90 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-200/90 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-700">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                Register for {eventName}
              </h3>
              <p className="text-xs text-stone-500">
                Claim your {credentialTerminology} & secure your verified attendance spot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-zinc-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                {(!token || error.includes('sign in') || error.includes('session has expired')) && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/login?redirect=${currentRedirect}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold"
                    >
                      <LogIn className="w-3.5 h-3.5" /> Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/register?redirect=${currentRedirect}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 rounded-lg text-xs font-semibold"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Create Account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!token && !error ? (
            /* Unauthenticated Prompt */
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-700 border border-stone-200">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-900">Sign in to Claim Your Pass</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                  Ticketification uses verified digital passes. Sign in or register once to receive your tamper-proof pass and access your wallet.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/login?redirect=${currentRedirect}`);
                  }}
                  className="w-full py-2.5 px-4 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/register?redirect=${currentRedirect}`);
                  }}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all border border-stone-200 flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4 text-stone-500" /> Create Account
                </button>
              </div>
            </div>
          ) : issuedResult ? (
            /* Success confirmation card */
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mx-auto shadow-xs">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-zinc-900">Registration Confirmed!</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Your official {credentialTerminology} has been issued and linked to your account.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 text-left max-w-sm mx-auto space-y-2">
                <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-200/80 pb-2">
                  <span>Pass Identifier</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {issuedResult.credential?.formattedId || 'CONFIRMED'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-200/80 pb-2">
                  <span>Holder Name</span>
                  <span className="text-zinc-800 font-semibold">
                    {issuedResult.credential?.holder?.name || 'Attendee'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Status</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/wallet');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Open My Wallet
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-zinc-700 font-semibold text-xs border border-stone-200 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Registration Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    College / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Bombay / Acme Corp"
                    value={formData.organization || ''}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Student / Full-Stack Engineer"
                  value={formData.designation || ''}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900 transition-all"
                />
              </div>

              {/* Event-specific fields */}
              {isHackathon && (
                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-stone-600" /> Hackathon Participation Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        GitHub Profile
                      </label>
                      <input
                        type="text"
                        placeholder="github-username"
                        value={formData.responses?.github || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            responses: { ...formData.responses, github: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Team Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CyberKnights"
                        value={formData.teamName || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isConferenceOrWorkshop && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Dietary Preference
                  </label>
                  <select
                    value={formData.responses?.dietary || 'None'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        responses: { ...formData.responses, dietary: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20"
                  >
                    <option value="None">Standard / No restrictions</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Halal">Halal</option>
                    <option value="Jain">Jain</option>
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-stone-200/90 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold transition-colors border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-black disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Issuing Pass...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Registration
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventRegistrationModal;
