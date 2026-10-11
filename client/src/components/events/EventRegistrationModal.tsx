import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, Ticket, ShieldCheck } from 'lucide-react';
import { attendeeApi, RegisterEventDTO } from '../../api/attendee';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setError(err?.response?.data?.error?.message || err?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#111622] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Register for {eventName}
              </h3>
              <p className="text-xs text-zinc-400">
                Claim your {credentialTerminology} & secure your attendance spot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {issuedResult ? (
            /* Success confirmation card */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Registration Confirmed!</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Your official {credentialTerminology} has been issued and linked to your account.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-emerald-500/30 text-left max-w-sm mx-auto space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-2">
                  <span>Pass Identifier</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {issuedResult.credential?.formattedId || 'CONFIRMED'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800 pb-2">
                  <span>Holder Name</span>
                  <span className="text-zinc-200 font-medium">
                    {issuedResult.credential?.holder?.name || 'Attendee'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Status</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/wallet');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" /> Open My Wallet
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Registration Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    College / Organization
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IIT Bombay / Acme Corp"
                    value={formData.organization || ''}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Student / Full-Stack Engineer"
                  value={formData.designation || ''}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Event-specific fields */}
              {isHackathon && (
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Hackathon Information
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                        GitHub Profile
                      </label>
                      <input
                        type="text"
                        placeholder="github username"
                        value={formData.responses?.github || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            responses: { ...formData.responses, github: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                        Team Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CyberKnights"
                        value={formData.teamName || ''}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isConferenceOrWorkshop && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
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
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-1.5"
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
