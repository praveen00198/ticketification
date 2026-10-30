import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Search,
  X,
  Wallet,
  QrCode,
} from 'lucide-react';
import { attendeeApi } from '../api/attendee';
import { extractErrorMessage } from '../api/client';
import { ROUTES } from '../routes/paths';
import { formatLocalizedDateTime } from '../utils/date';
import { formatVenueLabel } from '../utils/venue';
import { EmptyEventsState, ErrorState, InView, AnimatedGroup } from '../components/ui';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmed
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" /> Cancelled
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-600">
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
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
        <div className="pt-2 sm:pt-4">
          <AnimatedGroup
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            staggerDelay={50}
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
                  className={`group bg-white border border-stone-200/80 hover:border-stone-300 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:shadow-stone-900/4 hover:-translate-y-0.5 ${
                    isMuted ? 'opacity-75' : ''
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Event Type + Relative Time + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                          {event.eventType || reg.eventType || 'EVENT'}
                        </span>
                        {relativeTime && !isCancelled && !isRejected && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            completed
                              ? 'bg-stone-100 text-stone-500'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {relativeTime}
                          </span>
                        )}
                      </div>
                      {getStatusBadge(reg.status)}
                    </div>

                    {/* Event Title */}
                    <div>
                      <Link to={ROUTES.WALLET} className="hover:underline">
                        <h3 className={`text-base font-semibold leading-snug line-clamp-1 ${
                          isMuted ? 'text-zinc-500' : 'text-zinc-900'
                        }`}>
                          {reg.eventName || event.name || 'Untitled Event'}
                        </h3>
                      </Link>
                    </div>

                    {/* Event Details (No harsh divider lines) */}
                    <div className="space-y-2 text-xs text-stone-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="text-stone-700 font-medium">{startAt}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="text-stone-500 truncate">{venue}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                          <Ticket className="w-3 h-3 text-stone-400" />
                          {reg.ticketTier || reg.registrationType || 'Attendee Pass'}
                        </span>
                        {credentialId && (
                          <span className="font-mono text-[11px] text-stone-400 tracking-wide">
                            #{credentialId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions (No divider line, prominent View Pass) */}
                  <div className="pt-4 mt-4 flex items-center justify-between gap-3">
                    <div>
                      {reg.status === 'CONFIRMED' && !completed ? (
                        <Link
                          to={ROUTES.WALLET}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          View Pass
                        </Link>
                      ) : completed && reg.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                          {reg.credential?.status === 'CHECKED_IN' ? 'Attended' : 'Completed'}
                        </span>
                      ) : (
                        <span />
                      )}
                    </div>

                    {!isCancelled && !isRejected && !completed && (
                      <button
                        onClick={() => handleCancelRegistration(eventId, reg.eventName || event.name)}
                        disabled={cancellingId === eventId}
                        className="text-xs font-medium text-stone-400 hover:text-rose-600 transition-colors cursor-pointer py-1.5 px-2 rounded-lg hover:bg-rose-50/50 disabled:opacity-50"
                      >
                        {cancellingId === eventId ? (
                          <span className="inline-flex items-center gap-1 text-rose-500">
                            <Loader2 className="w-3 h-3 animate-spin" /> Cancelling...
                          </span>
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
        </div>
      )}
    </div>
  );
};
export default MyRegistrationsPage;
