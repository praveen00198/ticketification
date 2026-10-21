import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  History,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { attendeeApi } from '../api/attendee';
import { ROUTES } from '../routes/paths';

export const EventHistoryPage: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ATTENDED' | 'ABSENT' | 'REGISTERED'>('ALL');

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendeeApi.getMyAttendanceHistory();
      if (res.success) {
        setHistory(res.data || []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredHistory = history.filter((item) => {
    const eventName = item.event?.name || '';
    const matchesSearch = eventName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.attendanceStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getAttendanceBadge = (status: 'ATTENDED' | 'ABSENT' | 'REGISTERED', checkInCount: number) => {
    switch (status) {
      case 'ATTENDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Attended {checkInCount > 1 ? `(${checkInCount} scans)` : ''}
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600 border border-stone-200">
            <XCircle className="w-3.5 h-3.5 text-stone-400" />
            Not Attended
          </span>
        );
      case 'REGISTERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            Upcoming / Pending Turnstile
          </span>
        );
    }
  };

  const totalAttended = history.filter((h) => h.attendanceStatus === 'ATTENDED').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Event History</h1>
          <p className="text-sm text-stone-500 mt-1">
            Verified participation and check-in timeline based on cryptographic turnstile records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Verified Turnstiles Attended</div>
            <div className="text-xl font-bold text-zinc-900">{totalAttended}</div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center border border-stone-200">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Total Event Records</div>
            <div className="text-xl font-bold text-zinc-900">{history.length}</div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-stone-500 font-medium">Attendance Rate</div>
            <div className="text-xl font-bold text-zinc-900">
              {history.length > 0 ? `${Math.round((totalAttended / history.length) * 100)}%` : '0%'}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search attended events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-stone-200 bg-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg border border-stone-200">
          {(['ALL', 'ATTENDED', 'ABSENT', 'REGISTERED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === tab
                  ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-zinc-900'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* History Timeline */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-medium text-stone-500">Retrieving attendance logs...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50 p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">No attendance history records</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'No events match your search query.'
                : 'Your verified attendance and scan records will appear here after physical or virtual turnstile check-in.'}
            </p>
          </div>
          <Link
            to={ROUTES.EXPLORE}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            Explore Events
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Event & Type</th>
                  <th className="py-3 px-4">Event Date</th>
                  <th className="py-3 px-4">Attendance Verification</th>
                  <th className="py-3 px-4">First Check-in</th>
                  <th className="py-3 px-4">Credential ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                {filteredHistory.map((item) => {
                  const event = item.event || {};
                  const eventDate = event.schedule?.startAt
                    ? new Date(event.schedule.startAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
                    : 'TBD';
                  const checkInTime = item.firstCheckedInAt
                    ? new Date(item.firstCheckedInAt).toLocaleDateString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—';

                  return (
                    <tr key={item.registrationId} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-4 px-4 font-medium text-zinc-900">
                        <div className="font-semibold text-zinc-900">{event.name || 'Untitled Event'}</div>
                        <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                          <span className="capitalize">{event.eventType?.toLowerCase() || 'Event'}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{event.venue?.name || event.venue?.type || 'Venue'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-stone-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-stone-400" />
                          <span>{eventDate}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {getAttendanceBadge(item.attendanceStatus, item.checkInCount)}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-stone-600">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{checkInTime}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-stone-100 px-2 py-0.5 rounded text-stone-700 border border-stone-200">
                          {item.credential?.formattedId || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default EventHistoryPage;
