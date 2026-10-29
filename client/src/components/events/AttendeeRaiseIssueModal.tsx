import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Loader2, X } from 'lucide-react';
import { supportApi } from '../../api/support';

interface AttendeeRaiseIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  userEmail?: string;
  userName?: string;
  onSuccess?: () => void;
}

const ISSUE_CATEGORIES = [
  { value: 'CREDENTIAL_QR_ISSUE', label: 'Pass / QR Code Problem (Check-in, Display, Download)' },
  { value: 'REGISTRATION_ISSUE', label: 'Registration & Ticket Details' },
  { value: 'SCHEDULE_INFO', label: 'Schedule, Timetable or Venue Query' },
  { value: 'TEAM_PARTICIPANT_ISSUE', label: 'Team, Track or Project Submission Issue' },
  { value: 'VENUE_ACCESSIBILITY', label: 'Venue Access & Accessibility Assistance' },
  { value: 'TECHNICAL_ISSUE', label: 'Platform / Technical Issue' },
  { value: 'OTHER', label: 'Other Issue or Feedback' },
] as const;

export const AttendeeRaiseIssueModal: React.FC<AttendeeRaiseIssueModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventName,
  userEmail = '',
  userName = '',
  onSuccess,
}) => {
  const [category, setCategory] = useState<string>('CREDENTIAL_QR_ISSUE');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(userEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setError('Please provide a description of the issue (minimum 5 characters).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await supportApi.submitReport({
        eventId,
        category: category as any,
        description: description.trim(),
        reporterEmail: email.trim() || userEmail,
        reporterName: userName || undefined,
      });

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-title"
    >
      <div className="bg-white border border-stone-200/90 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 id="issue-modal-title" className="text-sm font-bold text-zinc-900">
                Raise an Issue
              </h3>
              <p className="text-[11px] text-stone-500 truncate max-w-xs">{eventName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {success ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-in zoom-in" />
              <h4 className="text-sm font-bold text-zinc-900">Issue Submitted</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Thank you for notifying us. The event organizer and support team have received your request and will follow up shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  What kind of issue are you experiencing?
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Describe what went wrong <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide any details that can help resolve the issue quickly..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-zinc-900 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
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

export default AttendeeRaiseIssueModal;
