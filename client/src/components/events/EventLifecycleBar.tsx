import React, { useState } from 'react';
import {
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Archive,
  Ban,
  Clock,
  History,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  FileCheck2,
  Send,
} from 'lucide-react';
import { eventsApi, EventStatusHistoryItem } from '../../api/events';

interface EventLifecycleBarProps {
  eventId: string;
  currentStatus: string;
  isOwner?: boolean;
  isIndividual?: boolean;
  onStatusChange: (newStatus: string) => void;
}

const LIFECYCLE_STEPS = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'EVENT_LIVE', label: 'Live' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export const EventLifecycleBar: React.FC<EventLifecycleBarProps> = ({
  eventId,
  currentStatus,
  isOwner = true,
  isIndividual = false,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<EventStatusHistoryItem[]>([]);

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await eventsApi.getLifecycleHistory(eventId);
      setHistoryItems(res.statusHistory || []);
    } catch (err: any) {
      setError(err.message || 'Could not load lifecycle history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const executeTransition = async (actionFn: () => Promise<any>, targetStatus: string, successText: string) => {
    try {
      setLoading(true);
      setError(null);
      await actionFn();
      onStatusChange(targetStatus);
      setSuccessMsg(successText);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || `Failed to transition event to ${targetStatus}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEvent = () => {
    executeTransition(
      () => eventsApi.transitionLifecycle(eventId, 'SUBMITTED', 'Submitted for review by host'),
      'SUBMITTED',
      'Event draft submitted successfully for review!'
    );
  };

  const handleApproveEvent = () => {
    executeTransition(
      () => eventsApi.transitionLifecycle(eventId, 'APPROVED', 'Approved by host'),
      'APPROVED',
      'Event approved and ready for publishing!'
    );
  };

  const handlePublish = () => {
    executeTransition(() => eventsApi.publishEvent(eventId), 'PUBLISHED', 'Event published successfully!');
  };

  const handleOpenRegistrations = () => {
    executeTransition(
      () => eventsApi.openRegistrations(eventId),
      'REGISTRATION_OPEN',
      'Attendee registrations are now open.'
    );
  };

  const handleCloseRegistrations = () => {
    executeTransition(
      () => eventsApi.closeRegistrations(eventId),
      'REGISTRATION_CLOSED',
      'Registrations closed.'
    );
  };

  const handleStartLive = () => {
    executeTransition(
      () => eventsApi.startLiveEvent(eventId),
      'EVENT_LIVE',
      'Event is now live! Entry scanning gates active.'
    );
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      setError('Please provide a reason for cancelling this event.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await eventsApi.cancelEvent(eventId, cancelReason.trim());
      onStatusChange('CANCELLED');
      setShowCancelModal(false);
      setCancelReason('');
      setSuccessMsg('Event has been cancelled.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel event.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentOrPassed = (stepKey: string) => {
    const order = ['DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'EVENT_LIVE', 'COMPLETED', 'ARCHIVED'];
    const effectiveStatus =
      currentStatus === 'REGISTRATION_OPEN' || currentStatus === 'REGISTRATION_CLOSED'
        ? 'PUBLISHED'
        : currentStatus;
    const currentIdx = order.indexOf(effectiveStatus);
    const stepIdx = order.indexOf(stepKey);
    return currentIdx >= 0 && stepIdx >= 0 && stepIdx <= currentIdx;
  };

  return (
    <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden">
      {/* Top Bar: Stepper & History Trigger */}
      <div className="p-4 sm:p-5 border-b border-surface-border bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Timeline Stepper */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 text-xs">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const active = step.key === currentStatus;
            const passed = isCurrentOrPassed(step.key);

            return (
              <React.Fragment key={step.key}>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-stone-900 text-white ring-2 ring-stone-900/20 ring-offset-1'
                        : passed
                        ? 'bg-stone-200 text-stone-900 border border-stone-300'
                        : 'bg-zinc-100 text-zinc-400 border border-zinc-200'
                    }`}
                  >
                    {passed && !active ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`font-semibold ${
                      active ? 'text-zinc-900 font-bold' : passed ? 'text-zinc-700' : 'text-zinc-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div
                    className={`w-4 sm:w-8 h-0.5 flex-shrink-0 ${
                      passed && !active ? 'bg-stone-300' : 'bg-zinc-200'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status History Trigger */}
        <button
          type="button"
          onClick={() => {
            setShowHistory(true);
            fetchHistory();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-all self-start md:self-auto shadow-sm"
        >
          <History className="w-3.5 h-3.5 text-zinc-500" />
          <span>Status History</span>
        </button>
      </div>

      {/* Main Action Bar */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Description */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              currentStatus === 'EVENT_LIVE'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : currentStatus === 'PUBLISHED' || currentStatus === 'REGISTRATION_OPEN'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : currentStatus === 'SUSPENDED' || currentStatus === 'CANCELLED'
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
            }`}
          >
            {currentStatus === 'EVENT_LIVE' ? (
              <Radio className="w-5 h-5 animate-pulse text-emerald-600" />
            ) : currentStatus === 'PUBLISHED' ? (
              <Globe className="w-5 h-5" />
            ) : currentStatus === 'REGISTRATION_OPEN' ? (
              <FileCheck2 className="w-5 h-5" />
            ) : currentStatus === 'REGISTRATION_CLOSED' ? (
              <Lock className="w-5 h-5" />
            ) : currentStatus === 'COMPLETED' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : currentStatus === 'ARCHIVED' ? (
              <Archive className="w-5 h-5" />
            ) : currentStatus === 'SUSPENDED' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : currentStatus === 'CANCELLED' ? (
              <Ban className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900">Current Phase:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  currentStatus === 'EVENT_LIVE'
                    ? 'bg-emerald-500 text-white animate-pulse'
                    : currentStatus === 'PUBLISHED' || currentStatus === 'REGISTRATION_OPEN'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : currentStatus === 'SUSPENDED' || currentStatus === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                }`}
              >
                {currentStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {currentStatus === 'DRAFT' &&
                (isIndividual
                  ? 'Event draft is in preparation. Configure event details and submit for review.'
                  : 'Event is in preparation. Complete institutional verification or submit for review.')}
              {currentStatus === 'SUBMITTED' && 'Submitted for verification review. Awaiting platform administration decision.'}
              {currentStatus === 'APPROVED' && 'Event is verified and approved. Ready to be published to attendees.'}
              {currentStatus === 'PUBLISHED' && 'Event is published. Open registrations or launch live check-in gates.'}
              {currentStatus === 'REGISTRATION_OPEN' && 'Public registrations are actively accepted.'}
              {currentStatus === 'REGISTRATION_CLOSED' && 'Registrations are locked. Ready to open live entry gates.'}
              {currentStatus === 'EVENT_LIVE' && 'Event is live! Dynamic QR credentials and check-in scanners active.'}
              {currentStatus === 'COMPLETED' && 'Event concluded. Review metrics and archive records.'}
              {currentStatus === 'ARCHIVED' && 'Sealed read-only archive. No further modifications permitted.'}
              {currentStatus === 'SUSPENDED' && 'Event suspended by platform administration. Check-ins and sales frozen.'}
              {currentStatus === 'CANCELLED' && 'This event has been cancelled.'}
            </p>
          </div>
        </div>

        {/* Dynamic Contextual Action Buttons */}
        {isOwner && currentStatus !== 'ARCHIVED' && currentStatus !== 'CANCELLED' && currentStatus !== 'SUSPENDED' && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {currentStatus === 'DRAFT' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmitEvent}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Submit Event for Review</span>
              </button>
            )}

            {currentStatus === 'SUBMITTED' && (
              <button
                type="button"
                disabled={loading}
                onClick={handleApproveEvent}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Approve Event</span>
              </button>
            )}

            {currentStatus === 'APPROVED' && (
              <button
                type="button"
                disabled={loading}
                onClick={handlePublish}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-black disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                <span>Publish Event</span>
              </button>
            )}

            {currentStatus === 'PUBLISHED' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOpenRegistrations}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-stone-700" />
                  <span>Open Registrations</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartLive}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Go Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl transition-all"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Event</span>
                </button>
              </>
            )}

            {currentStatus === 'REGISTRATION_OPEN' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCloseRegistrations}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Close Registrations</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartLive}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Go Live</span>
                </button>
              </>
            )}

            {currentStatus === 'REGISTRATION_CLOSED' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleOpenRegistrations}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-stone-700" />
                  <span>Reopen Registrations</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStartLive}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Go Live</span>
                </button>
              </>
            )}

            {currentStatus === 'EVENT_LIVE' && (
              <span className="text-xs text-emerald-700 font-semibold px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Turnstile entry gates active</span>
              </span>
            )}

            {currentStatus === 'COMPLETED' && (
              <span className="text-xs text-stone-600 font-medium px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-xl">
                Event Concluded
              </span>
            )}
          </div>
        )}
      </div>

      {/* Inline Feedback Banners */}
      {error && (
        <div className="mx-5 mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mx-5 mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Status History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm">
                <History className="w-4 h-4 text-zinc-900" />
                <span>Lifecycle Transition History</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                <span>Loading transition history...</span>
              </div>
            ) : historyItems.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {historyItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-zinc-900">
                        <span className="px-1.5 py-0.5 bg-zinc-200 rounded text-[10px]">
                          {item.fromStatus}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-400" />
                        <span className="px-1.5 py-0.5 bg-zinc-900 text-white rounded text-[10px]">
                          {item.toStatus}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {item.reason && (
                      <p className="text-[11px] text-zinc-600 italic">
                        "{item.reason}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-400 italic">
                No status transitions recorded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2 font-bold text-rose-600 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Cancel Event</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Cancelling an event is an irreversible action. Registrations will close immediately, and entry tickets will be invalidated.
            </p>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain the reason for cancellation (e.g. venue unavailability, unforeseen circumstances)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 shadow-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200">
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 text-xs font-bold rounded-xl hover:bg-zinc-50"
              >
                Keep Event Active
              </button>
              <button
                type="button"
                disabled={loading || !cancelReason.trim()}
                onClick={handleCancelSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                {loading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
