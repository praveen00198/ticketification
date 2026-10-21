import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
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
import { apiClient } from '../api/client';
import { ROUTES } from '../routes/paths';

export const ReportsPage: React.FC = () => {
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
      setError(err?.response?.data?.error || 'Failed to fetch analytics for the selected event.');
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reports & Analytics</h1>
          <p className="text-sm text-stone-500 mt-1">
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
        <div className="py-16 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50 p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">No events hosted yet</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Analytics are available for events you organize. Create your first event to unlock live turnstile tracking and reporting.
            </p>
          </div>
          <Link
            to={ROUTES.CREATE_EVENT}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* KPI Metrics */}
          {loadingStats ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
          ) : stats ? (
            <>
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
                      <p className="font-medium text-zinc-800 mt-0.5">{selectedEvent?.venue || 'Online / Designated Venue'}</p>
                    </div>
                    <div>
                      <span className="text-stone-400">Date:</span>
                      <p className="font-medium text-zinc-800 mt-0.5">{selectedEvent?.date || 'Scheduled'}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100">
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
                    <div className="divide-y divide-stone-100">
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
                            {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-stone-400">
              Select an event to view reports.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ReportsPage;
