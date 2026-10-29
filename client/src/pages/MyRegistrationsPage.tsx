import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Search,
  Ban,
  X,
  Wallet,
  Hash,
  Eye,
  LayoutDashboard,
} from 'lucide-react';
import { attendeeApi } from '../api/attendee';
import { extractErrorMessage } from '../api/client';
import { ROUTES } from '../routes/paths';
import { formatLocalizedDateTime } from '../utils/date';
import { formatVenueLabel } from '../utils/venue';
import { EmptyEventsState, ErrorState, Badge, InView, AnimatedGroup } from '../components/ui';

type RegistrationFilter = 'ALL' | 'UPCOMING' | 'COMPLETED';

/**
 * Computes a human-readable relative time string like "in 3 days" or "2 weeks ago".
 */
const getRelativeTimeLabel = (dateStr: string | undefined): string | null => {
  if (!dateStr) return null;
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;

  const diffMs = target - now;
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  if (absDiffMs < 60 * 60 * 1000) {
    return isFuture ? 'Starting soon' : 'Just ended';
  }
  if (absDiffMs < 24 * 60 * 60 * 1000) {
    const hours = Math.round(absDiffMs / (60 * 60 * 1000));
    return isFuture ? `in ${hours}h` : `${hours}h ago`;
  }
  if (absDiffMs < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.round(absDiffMs / (24 * 60 * 60 * 1000));
    return isFuture ? `in ${days}d` : `${days}d ago`;
  }
  if (absDiffMs < 30 * 24 * 60 * 60 * 1000) {
    const weeks = Math.round(absDiffMs / (7 * 24 * 60 * 60 * 1000));
    return isFuture ? `in ${weeks}w` : `${weeks}w ago`;
  }
  const months = Math.round(absDiffMs / (30 * 24 * 60 * 60 * 1000));
  return isFuture ? `in ${months}mo` : `${months}mo ago`;
};

export const MyRegistrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<RegistrationFilter>('ALL');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchRegistrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendeeApi.getMyRegistrations();
      if (res.success) {
        setRegistrations(res.data || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load registrations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  // Auto-dismiss success banner after 5 seconds
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  const handleCancelRegistration = async (eventId: string, eventTitle: string) => {
    if (!window.confirm(`Are you sure you want to cancel your registration for "${eventTitle}"? This cannot be undone.`)) {
      return;
    }

    setCancellingId(eventId);
    setActionSuccess(null);
    try {
      const res = await attendeeApi.cancelRegistration(eventId, 'User cancelled registration from dashboard');
      if (res.success) {
        setActionSuccess(`Registration for "${eventTitle}" has been cancelled.`);
        await fetchRegistrations();
      }
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to cancel registration.'));
    } finally {
      setCancellingId(null);
    }
  };

  const isRegistrationCompleted = (reg: any): boolean => {
    if (reg.credential?.status === 'CHECKED_IN' || reg.credential?.status === 'EXPIRED') return true;
    const endAt = reg.schedule?.endAt || reg.event?.schedule?.endAt;
    if (endAt && new Date(endAt).getTime() < Date.now()) return true;
    const startAt = reg.schedule?.startAt || reg.event?.schedule?.startAt;
    if (startAt && new Date(startAt).getTime() + 24 * 60 * 60 * 1000 < Date.now()) return true;
    return false;
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const eventName = reg.eventName || reg.event?.name || reg.eventId?.name || '';
    const matchesSearch = eventName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const completed = isRegistrationCompleted(reg);

    if (filter === 'UPCOMING') {
      return !completed && reg.status !== 'CANCELLED' && reg.status !== 'REJECTED';
    }
    if (filter === 'COMPLETED') {
      return completed || reg.status === 'CANCELLED';
    }
    return true;
  });

  // Summary statistics
  const stats = useMemo(() => {
    let upcoming = 0;
    let confirmed = 0;
    let completed = 0;
    registrations.forEach((reg) => {
      if (reg.status === 'CONFIRMED') confirmed++;
      const done = isRegistrationCompleted(reg);
      if (done || reg.status === 'CANCELLED') {
        completed++;
      } else if (reg.status !== 'CANCELLED' && reg.status !== 'REJECTED') {
        upcoming++;
      }
    });
    return { total: registrations.length, upcoming, confirmed, completed };
  }, [registrations]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending Approval
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
            <Ban className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
            {status}
          </span>
        );
    }
  };

  const FILTER_TABS: { key: RegistrationFilter; label: string }[] = [
    { key: 'ALL', label: 'All Passes' },
    { key: 'UPCOMING', label: 'Upcoming' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="w-full flex-1 flex flex-col min-h-full space-y-6">
      {/* Header */}
      <InView direction="up" distance={12}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">My Registrations</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Track and manage your upcoming event entries, approval statuses, and active registrations.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to={ROUTES.WALLET}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-full transition-all shadow-2xs active:scale-95"
            >
              <Wallet className="w-3.5 h-3.5" />
              Wallet
            </Link>
            <Link
              to={ROUTES.EXPLORE}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-black rounded-full transition-all shadow-xs active:scale-95"
            >
              Explore Events
            </Link>
          </div>
        </div>
      </InView>

      {/* Summary Stats */}
      {!loading && registrations.length > 0 && (
        <InView direction="up" distance={10} delay={0.05}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100/80 border border-stone-200/70 rounded-full text-xs text-stone-600">
              <Ticket className="w-3 h-3 text-stone-400" />
              <span className="font-semibold text-stone-800">{stats.total}</span> total
            </div>
            {stats.upcoming > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/70 rounded-full text-xs text-emerald-700">
                <Calendar className="w-3 h-3" />
                <span className="font-semibold">{stats.upcoming}</span> upcoming
              </div>
            )}
            {stats.confirmed > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-200/70 rounded-full text-xs text-sky-700">
                <CheckCircle2 className="w-3 h-3" />
                <span className="font-semibold">{stats.confirmed}</span> confirmed
              </div>
            )}
            {stats.completed > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 border border-zinc-200/70 rounded-full text-xs text-zinc-600">
                <span className="font-semibold">{stats.completed}</span> past
              </div>
            )}
          </div>
        </InView>
      )}

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar (Search + Segmented Switcher) */}
      <InView direction="up" distance={10} delay={0.1}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Rounded-full Search with circular magnifying glass button */}
          <div className="relative flex items-center w-full sm:max-w-xs md:max-w-sm bg-stone-100/70 border border-stone-200/80 rounded-full p-1 transition-colors focus-within:border-stone-300 focus-within:bg-stone-50">
            <div
              className="w-7 h-7 rounded-full bg-white text-stone-700 shadow-2xs border border-stone-200/60 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <input
              type="text"
              placeholder="Search by event title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent pl-2.5 pr-3 py-1 text-xs text-stone-900 placeholder-stone-400 border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 mr-1 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Segmented Switcher */}
          <div className="inline-flex items-center self-start sm:self-auto bg-stone-100/90 border border-stone-200/70 overflow-hidden rounded-full shrink-0 shadow-2xs p-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer ${
                  filter === tab.key
                    ? 'bg-white text-stone-900 shadow-xs font-semibold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </InView>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-2">
          <div className="w-7 h-7 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin mb-1" />
          <p className="text-xs font-medium text-stone-500">Loading your registrations...</p>
        </div>
      ) : error && registrations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
          <ErrorState
            title="Failed to Load Registrations"
            description={error}
            onRetry={fetchRegistrations}
            retryText="Retry Loading"
            statusText="REGISTRATIONS DISRUPTED"
            errorCode="ERR_REG_SYNC"
          />
        </div>
      ) : filteredRegistrations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
          <EmptyEventsState
            title={
              searchQuery
                ? 'No Matching Registrations'
                : filter === 'UPCOMING'
                ? 'No Upcoming Registrations'
                : filter === 'COMPLETED'
                ? 'No Completed Registrations'
                : 'No Registrations Found'
            }
            description={
              searchQuery
                ? `No registrations found matching "${searchQuery}". Try a different event title.`
                : filter === 'UPCOMING'
                ? 'You do not have any upcoming event passes. Explore events and reserve your admission.'
                : filter === 'COMPLETED'
                ? 'No past event attendance records found in your registration history.'
                : "You haven't registered for any events yet. Explore events and reserve your pass."
            }
            slotText="ZERO PASSES CLAIMED"
            categoryText="ATTENDEE REGISTRATION • ACCESS PASS"
            actionText="Explore Events"
            onAction={() => navigate(ROUTES.EXPLORE)}
            actionIcon={<ArrowRight className="w-3.5 h-3.5" />}
          />
        </div>
      ) : (
        <AnimatedGroup
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          staggerDelay={60}
          direction="up"
        >
          {filteredRegistrations.map((reg) => {
            const event = reg.event || reg.eventId || {};
            const eventId = event._id || reg.eventId;
            const startAt = formatLocalizedDateTime(event.schedule?.startAt || reg.schedule?.startAt);
            const venue = formatVenueLabel(event.venue || reg.venue);
            const isCancelled = reg.status === 'CANCELLED';
            const isRejected = reg.status === 'REJECTED';
            const completed = isRegistrationCompleted(reg);
            const isMuted = isCancelled || isRejected || completed;
            const credentialId = reg.credential?.formattedId || reg.credentialId;
            const relativeTime = getRelativeTimeLabel(event.schedule?.startAt || reg.schedule?.startAt);

            return (
              <div
                key={reg._id || reg.id}
                className={`group bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 ${
                  isMuted
                    ? 'border-stone-200/60 opacity-70 hover:opacity-85'
                    : 'border-stone-200/90 shadow-2xs hover:shadow-sm hover:border-stone-300 hover:-translate-y-0.5'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Event Type + Status + Relative Time */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="neutral">
                        {event.eventType || reg.eventType || 'EVENT'}
                      </Badge>
                      {relativeTime && !isCancelled && !isRejected && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          completed
                            ? 'bg-zinc-100 text-zinc-500'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {relativeTime}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(reg.status)}
                  </div>

                  {/* Event Name + Description */}
                  <div>
                    <Link to={`/events/${eventId}/attendee`} className="hover:underline">
                      <h3 className={`text-base font-semibold leading-snug line-clamp-1 ${
                        isMuted ? 'text-zinc-500' : 'text-zinc-900'
                      }`}>
                        {reg.eventName || event.name || 'Untitled Event'}
                      </h3>
                    </Link>
                    <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                      {event.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Event Details */}
                  <div className="pt-2 space-y-1.5 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{startAt}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>
                        Tier: <strong className="text-zinc-800">{reg.ticketTier || reg.registrationType || 'Standard Admission'}</strong>
                      </span>
                    </div>
                    {credentialId && (
                      <div className="flex items-center gap-2">
                        <Hash className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="font-mono text-[11px] text-stone-500 tracking-wide">{credentialId}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-4 mt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/events/${eventId}/attendee`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Event Dashboard
                    </Link>
                    {reg.status === 'CONFIRMED' && !completed && (
                      <Link
                        to={ROUTES.WALLET}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                        title="View Pass in Wallet"
                      >
                        <Eye className="w-3.5 h-3.5" /> Pass
                      </Link>
                    )}
                    {completed && reg.status === 'CONFIRMED' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-stone-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {reg.credential?.status === 'CHECKED_IN' ? 'Attended' : 'Completed'}
                      </span>
                    )}
                  </div>

                  {!isCancelled && !isRejected && !completed && (
                    <button
                      onClick={() => handleCancelRegistration(eventId, reg.eventName || event.name)}
                      disabled={cancellingId === eventId}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-full transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {cancellingId === eventId ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" /> Cancelling...
                        </>
                      ) : (
                        'Cancel Entry'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </AnimatedGroup>
      )}
    </div>
  );
};
export default MyRegistrationsPage;
