import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supportApi, SupportReportItem } from '../api/support';
import { extractErrorMessage } from '../api/client';
import { useEvent } from '../context/EventContext';

export const ReportIssuePage: React.FC = () => {
  const { events } = useEvent();
  const [reports, setReports] = useState<SupportReportItem[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form State
  const [category, setCategory] = useState<string>('TECHNICAL_ISSUE');
  const [description, setDescription] = useState('');
  const [eventId, setEventId] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const fetchMyReports = async () => {
    setLoadingReports(true);
    try {
      const res = await supportApi.getMyReports();
      if (res.success) {
        setReports(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load user reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchMyReports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!description.trim() || description.trim().length < 10) {
      setSubmitError('Please provide a detailed description (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await supportApi.submitReport({
        category: category as any,
        description: description.trim(),
        eventId: eventId ? eventId : undefined,
        evidenceUrls: evidenceUrl.trim() ? [evidenceUrl.trim()] : undefined,
      });

      if (res.success) {
        setSubmitSuccess('Your issue report has been submitted. Our support team will review it.');
        setDescription('');
        setEvidenceUrl('');
        setEventId('');
        await fetchMyReports();
      }
    } catch (err: any) {
      setSubmitError(extractErrorMessage(err, 'Failed to submit report. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Under Review
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5" /> Investigating
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
          </span>
        );
      case 'DISMISSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
            Dismissed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Report an Issue</h1>
        <p className="text-sm text-stone-500 mt-1">
          Submit technical bugs, access problems, or event concerns, and monitor your past issue tickets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Submission Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-5">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-zinc-900">Submit a New Request</h2>
            </div>

            {submitSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {submitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-900 mb-1.5">
                  Issue Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="TECHNICAL_ISSUE">Technical Issue / Bug</option>
                  <option value="ACCESS_ISSUE">Turnstile / Check-in Access Problem</option>
                  <option value="SCAM">Suspected Scam or Fraudulent Event</option>
                  <option value="HARASSMENT">Harassment or Code of Conduct Violation</option>
                  <option value="INAPPROPRIATE_CONTENT">Inappropriate Event Content</option>
                  <option value="SAFETY_VIOLATION">Venue / Safety Concern</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              {events.length > 0 && (
                <div>
                  <label className="block font-semibold text-zinc-900 mb-1.5">
                    Related Event (Optional)
                  </label>
                  <select
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Platform / General Issue (No specific event)</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-900 mb-1.5">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what occurred, any error messages encountered, or the event context..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white placeholder-stone-400 text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-900 mb-1.5">
                  Screenshot / Evidence URL (Optional)
                </label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white placeholder-stone-400 text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-2xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting Report...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Submit Issue
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Submitted Issue History & Status */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-600" />
                <h3 className="text-sm font-bold text-zinc-900">Your Submitted Issues</h3>
              </div>
              <button
                onClick={fetchMyReports}
                disabled={loadingReports}
                className="text-stone-400 hover:text-stone-700 p-1 transition-colors"
                title="Refresh history"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingReports ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingReports ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            ) : reports.length === 0 ? (
              <div className="py-10 text-center text-xs text-stone-400 space-y-2 border border-dashed border-stone-100 rounded-xl p-4">
                <FileText className="w-6 h-6 mx-auto text-stone-300" />
                <p className="font-medium text-stone-500">No support requests submitted</p>
                <p className="text-[11px] text-stone-400">
                  When you submit an issue, its review progress and response notes will be displayed here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 divide-y divide-stone-100">
                {reports.map((report) => {
                  const eventName =
                    typeof report.eventId === 'object' && report.eventId !== null
                      ? report.eventId.name
                      : null;

                  return (
                    <div key={report._id} className="pt-3 first:pt-0 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-zinc-900 capitalize">
                          {report.category.toLowerCase().replace('_', ' ')}
                        </span>
                        {getStatusBadge(report.status)}
                      </div>

                      {eventName && (
                        <div className="text-[11px] text-stone-500 font-medium">
                          Event: <span className="text-zinc-800">{eventName}</span>
                        </div>
                      )}

                      <p className="text-stone-600 line-clamp-3 bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                        {report.description}
                      </p>

                      {report.moderationNotes && (
                        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-800">
                          <strong className="block font-semibold">Moderation Response:</strong>
                          {report.moderationNotes}
                        </div>
                      )}

                      <div className="text-[10px] text-stone-400 pt-0.5">
                        Submitted {new Date(report.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ReportIssuePage;
