import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { attendeeApi } from '../api/attendee';
import { extractErrorMessage } from '../api/client';
import { ROUTES } from '../routes/paths';
import { formatLocalizedDateTime } from '../utils/date';
import { formatVenueLabel } from '../utils/venue';
import { EmptyEventsState, ErrorState, Badge } from '../components/ui';

type RegistrationFilter = 'ALL' | 'UPCOMING' | 'COMPLETED';

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

  return (
    <div className="w-full flex-1 flex flex-col min-h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">My Registrations</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Track and manage your upcoming event entries, approval statuses, and active registrations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.EXPLORE}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-black rounded-full transition-all shadow-xs active:scale-95"
          >
            Explore Events
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Rounded-full Search with circular magnifying glass button */}
        <div className="relative flex items-center w-full sm:max-w-xs md:max-w-sm bg-stone-100/70 border border-stone-200/80 rounded-full p-1 transition-colors">
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
              className="p-1 mr-1 text-stone-400 hover:text-stone-600 rounded-full cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Segmented Switcher matching Image 2 */}
        <div className="inline-flex items-center self-start sm:self-auto bg-stone-100/90 border border-stone-200/70 overflow-hidden rounded-full shrink-0 shadow-2xs">
          {[
            { key: 'ALL', label: 'All Passes' },
            { key: 'UPCOMING', label: 'Upcoming' },
            { key: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as RegistrationFilter)}
              className={`px-4 py-2 text-xs font-medium transition-all cursor-pointer ${
                filter === tab.key
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRegistrations.map((reg) => {
            const event = reg.event || reg.eventId || {};
            const eventId = event._id || reg.eventId;
            const startAt = formatLocalizedDateTime(event.schedule?.startAt || reg.schedule?.startAt);
            const venue = formatVenueLabel(event.venue || reg.venue);
            const isCancelled = reg.status === 'CANCELLED';

            return (
              <div
                key={reg._id || reg.id}
                className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs hover:border-stone-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="neutral">
                      {event.eventType || reg.eventType || 'EVENT'}
                    </Badge>
                    {getStatusBadge(reg.status)}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 leading-snug line-clamp-1">
                      {reg.eventName || event.name || 'Untitled Event'}
                    </h3>
                    <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                      {event.description || 'No description provided.'}
                    </p>
                  </div>

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
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                  <div>
                    {reg.status === 'CONFIRMED' ? (
                      <Link
                        to={ROUTES.WALLET}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-900 hover:text-black"
                      >
                        View Ticket Pass <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-[11px] text-stone-400">
                        Registered {new Date(reg.registeredAt || reg.createdAt || Date.now()).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {!isCancelled && reg.status !== 'REJECTED' && (
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
        </div>
      )}
    </div>
  );
};
export default MyRegistrationsPage;

