import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { publicApi } from '../../api/public';

interface ReportEventModalProps {
  eventId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'SCAM', label: 'Fraud / Scam / Financial deception' },
  { value: 'IMPERSONATION', label: 'Impersonating another person or brand' },
  { value: 'MISLEADING_INFO', label: 'Misleading event details, venue or speakers' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate or harmful content' },
  { value: 'OTHER', label: 'Other violation of terms' },
];

export const ReportEventModal: React.FC<ReportEventModalProps> = ({
  eventId,
  eventName,
  isOpen,
  onClose,
}) => {
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [category, setCategory] = useState('MISLEADING_INFO');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reporterEmail.trim() || !reporterEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Please describe the issue in at least 10 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await publicApi.reportEvent(eventId, {
        reporterEmail: reporterEmail.trim(),
        reporterName: reporterName.trim() || undefined,
        category,
        reason: reason.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSubmitted(false);
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#111622] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-gray-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Report Submitted</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">
              Thank you for helping keep Ticketification safe. Our Trust & Safety team has received your report regarding <span className="text-white font-medium">{eventName}</span> and will investigate promptly.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors"
            >
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Report This Event</h3>
                <p className="text-xs text-gray-400 truncate max-w-xs">{eventName}</p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Your Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={reporterEmail}
                onChange={(e) => setReporterEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-gray-800 focus:border-rose-500 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                We will email you only if we need clarification.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Your Name <span className="text-gray-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-gray-800 focus:border-rose-500 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Reason Category <span className="text-rose-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-gray-800 focus:border-rose-500 rounded-xl text-sm text-white focus:outline-none transition-colors"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-[#111622] text-white">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Explanation & Details <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                placeholder="Please describe why this event should be reviewed by Trust & Safety..."
                className="w-full px-3.5 py-2.5 bg-[#090d16] border border-gray-800 focus:border-rose-500 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none transition-colors resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-gray-500 mt-1">
                <span>Minimum 10 characters</span>
                <span>{reason.length} / 1000</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-sm flex items-center gap-2 transition-colors shadow-lg shadow-rose-900/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportEventModal;
