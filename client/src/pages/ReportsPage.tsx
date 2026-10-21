import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { apiClient, extractErrorMessage } from '../api/client';
import { ROUTES } from '../routes/paths';
import { EmptyEventsState, ErrorState } from '../components/ui';
import { formatLocalizedDate, formatLocalizedDateTime } from '../utils/date';

const formatVenueLabel = (venue: any): string => {
  if (!venue) return 'Online / Designated Venue';
  if (typeof venue === 'string') return venue.trim() || 'Online / Designated Venue';
  if (typeof venue === 'object') {
    return (
      venue.name ||
      [venue.address, venue.city].filter(Boolean).join(', ') ||
      (venue.type === 'ONLINE' ? 'Online Virtual Event' : venue.type === 'HYBRID' ? 'Hybrid Event' : venue.type === 'PHYSICAL' ? 'Physical Venue' : 'Online / Designated Venue')
    );
  }
  return String(venue);
};

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { events, currentEvent, setCurrentEvent, loading: eventsLoading } = useEvent();
  const [selectedEventId, setSelectedEventId] = useState<string>(currentEvent?.id || '');
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (currentEvent?.id && currentEvent.id !== selectedEventId) {
      setSelectedEventId(currentEvent.id);
    }
  }, [currentEvent]);

  const fetchStats = async (eventId: string) => {
    if (!eventId) return;
    setLoadingStats(true);
    setError(null);
    try {
      const res: any = await apiClient.get('/dashboard/stats', {
        params: { eventId },
      });
      if (res.success && res.data) {
        setStats(res.data.stats);
        setRecentActivity(res.data.recentActivity || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to fetch analytics for the selected event. Please retry.'));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      fetchStats(selectedEventId);
    }
  }, [selectedEventId]);

  const handleEventChange = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find((e) => e.id === eventId);
    if (ev) {
      setCurrentEvent(ev);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || currentEvent;
  const hasReportableActivity =
    stats &&
    ((stats.totalTickets ?? 0) > 0 || (stats.checkedIn ?? 0) > 0 || (recentActivity && recentActivity.length > 0));

  return (
    <div className="flex-1 flex flex-col w-full min-h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">Reports & Analytics</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Turnstile attendance verification, check-in velocity, and credential issuance metrics.
          </p>
        </div>

        {events.length > 0 && (
          <div className="flex items-center gap-3">
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="text-xs font-medium bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchStats(selectedEventId)}
              disabled={loadingStats}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {eventsLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-medium text-stone-500">Loading authorized events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
          <EmptyEventsState
            title="No Analytics Available Yet"
            description="Reports will appear here once your events have activity to report."
            slotText="ANALYTICS PIPELINE"
            categoryText="TURNSTILE REPORTING • EVENT METRICS"
            actionText="Create Event"
            onAction={() => navigate(ROUTES.CREATE_EVENT)}
            actionIcon={<Plus className="w-4 h-4" />}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Strict Error State Separation: if error and no cached stats, display error state */}
          {error && !stats ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
              <ErrorState
                title="Failed to Load Analytics"
                description={error}
                onRetry={() => fetchStats(selectedEventId)}
                retryText="Retry Loading Analytics"
                statusText="ANALYTICS DISRUPTED"
                errorCode="ERR_REPORTING_SYNC"
              />
            </div>
          ) : (
            <>
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => fetchStats(selectedEventId)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-300 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
                  >
                    Retry
                  </button>
                </div>
              )}

              {loadingStats ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                  <p className="text-xs font-medium text-stone-500">Retrieving turnstile metrics...</p>
                </div>
              ) : !hasReportableActivity ? (
                <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
                  <EmptyEventsState
                    title="No Analytics Available Yet"
                    description="Reports will appear here once your events have activity to report."
                    slotText="AWAITING ATTENDEES"
                    categoryText="METRICS STANDBY • LIVE SCANNING"
                  />
                </div>
              ) : (
                <>
                  {/* KPI Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">Total Issued Passes</span>
                        <Ticket className="w-4 h-4 text-stone-400" />
                      </div>
                      <div className="mt-2 text-2xl font-bold text-zinc-900">
                        {stats.totalTickets ?? 0}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        Digital credentials generated
                      </p>
                    </div>

                    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">Verified Turnstile Scans</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="mt-2 text-2xl font-bold text-emerald-600">
                        {stats.checkedIn ?? 0}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        Successful check-ins logged
                      </p>
                    </div>

                    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">Turnout Rate</span>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="mt-2 text-2xl font-bold text-zinc-900">
                        {stats.turnoutRate ?? 0}%
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        Turnstile check-in proportion
                      </p>
                    </div>

                    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-stone-500">Pending Attendance</span>
                        <Users className="w-4 h-4 text-stone-400" />
                      </div>
                      <div className="mt-2 text-2xl font-bold text-zinc-900">
                        {Math.max(0, (stats.totalTickets ?? 0) - (stats.checkedIn ?? 0))}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1">
                        Awaiting arrival at venue
                      </p>
                    </div>
                  </div>

                  {/* Event Context & Activity Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-4">
                      <h3 className="text-sm font-bold text-zinc-900">Event Overview</h3>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-stone-400">Event Title:</span>
                          <p className="font-semibold text-zinc-900 mt-0.5">{selectedEvent?.name}</p>
                        </div>
                        <div>
                          <span className="text-stone-400">Status:</span>
                          <p className="mt-0.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {selectedEvent?.status || 'ACTIVE'}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="text-stone-400">Venue:</span>
                          <p className="font-medium text-zinc-800 mt-0.5">
                            {formatVenueLabel(selectedEvent?.venue)}
                          </p>
                        </div>
                        <div>
                          <span className="text-stone-400">Scheduled Date:</span>
                          <p className="font-medium text-zinc-800 mt-0.5">
                            {selectedEvent?.date ? formatLocalizedDate(selectedEvent.date) : 'Scheduled'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Link
                          to={ROUTES.DASHBOARD}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Open Event Host Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 shadow-2xs space-y-4">
                      <h3 className="text-sm font-bold text-zinc-900">Recent Turnstile Activity</h3>
                      {recentActivity.length === 0 ? (
                        <div className="py-12 text-center text-xs text-stone-400">
                          No check-in scans recorded yet for this event.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recentActivity.slice(0, 5).map((act: any, idx: number) => (
                            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div>
                                  <div className="font-medium text-zinc-900">
                                    {act.attendeeName || act.ticketId || 'Attendee check-in'}
                                  </div>
                                  <div className="text-[11px] text-stone-400">
                                    Scanned by {act.scannedBy || 'Station Turnstile'}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] text-stone-400">
                                {act.timestamp ? formatLocalizedDateTime(act.timestamp) : 'Recent'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
export default ReportsPage;
