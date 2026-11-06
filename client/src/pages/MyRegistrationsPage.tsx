import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Search,
  X,
  Wallet,
} from 'lucide-react';
import { RegistrationEventCard } from '../components/events/RegistrationEventCard';
import { attendeeApi } from '../api/attendee';
import { extractErrorMessage } from '../api/client';
import { ROUTES } from '../routes/paths';
import { formatVenueLabel } from '../utils/venue';
import { EmptyEventsState, ErrorState, InView, AnimatedGroup } from '../components/ui';

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
          <div className="inline-flex items-center self-start sm:self-auto bg-stone-100/90 border border-stone-200/70 overflow-hidden rounded-full shrink-0 shadow-2xs">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium rounded transition-all cursor-pointer ${
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
              const completed = isRegistrationCompleted(reg);

              return (
                <RegistrationEventCard
                  key={reg._id || reg.id}
                  id={eventId}
                  registrationId={reg._id || reg.id}
                  name={reg.eventName || event.name || 'Untitled Event'}
                  eventType={event.eventType || reg.eventType || 'EVENT'}
                  description={event.description || reg.description}
                  bannerUrl={event.bannerUrl || reg.bannerUrl}
                  dateStr={event.schedule?.startAt || reg.schedule?.startAt}
                  timeStr={event.schedule?.startAt || reg.schedule?.startAt}
                  venueLabel={formatVenueLabel(event.venue || reg.venue)}
                  venueType={event.venue?.type || reg.venue?.type}
                  status={reg.status}
                  credentialStatus={reg.credential?.status}
                  isCompleted={completed}
                  isCancelling={cancellingId === eventId}
                  onViewPass={() => navigate(ROUTES.WALLET)}
                  onCancel={
                    !reg.status || reg.status === 'CANCELLED' || reg.status === 'REJECTED' || completed
                      ? undefined
                      : () => handleCancelRegistration(eventId, reg.eventName || event.name)
                  }
                  onClick={() => navigate(ROUTES.WALLET)}
                />
              );
            })}
          </AnimatedGroup>
        </div>
      )}
    </div>
  );
};
export default MyRegistrationsPage;
