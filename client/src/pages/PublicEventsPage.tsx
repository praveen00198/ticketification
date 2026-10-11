import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  MapPin,
  Video,
  Ticket,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  X,
  Compass,
  AlertCircle,
} from 'lucide-react';
import { publicApi, PublicEventSummary } from '../api/public';

const EVENT_TYPE_OPTIONS = [
  { label: 'All Categories', value: 'ALL' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Conferences', value: 'CONFERENCE' },
  { label: 'Concerts & Music', value: 'CONCERT' },
  { label: 'Festivals', value: 'FESTIVAL' },
  { label: 'Workshops', value: 'WORKSHOP' },
  { label: 'College Fests', value: 'COLLEGE_EVENT' },
  { label: 'Exhibitions', value: 'EXHIBITION' },
];

const VENUE_TYPE_OPTIONS = [
  { label: 'All Formats', value: 'ALL' },
  { label: 'In-Person', value: 'PHYSICAL' },
  { label: 'Virtual', value: 'ONLINE' },
  { label: 'Hybrid', value: 'HYBRID' },
];

const PRICING_OPTIONS = [
  { label: 'All Pricing', value: 'ALL' },
  { label: 'Free Passes', value: 'FREE' },
  { label: 'Paid Admission', value: 'PAID' },
];

export const PublicEventsPage: React.FC = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedVenue, setSelectedVenue] = useState('ALL');
  const [selectedPricing, setSelectedPricing] = useState('ALL');
  const [cityInput, setCityInput] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getPublicEvents({
        page,
        limit: 12,
        search: search.trim() || undefined,
        eventType: selectedType !== 'ALL' ? selectedType : undefined,
        venueType: selectedVenue !== 'ALL' ? selectedVenue : undefined,
        pricingModel: selectedPricing !== 'ALL' ? selectedPricing : undefined,
        city: cityInput.trim() || undefined,
      });

      setEvents(res.events || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to load public events:', err);
      setError(err?.response?.data?.message || 'Unable to connect to the events catalog. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedType, selectedVenue, selectedPricing, cityInput]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedType('ALL');
    setSelectedVenue('ALL');
    setSelectedPricing('ALL');
    setCityInput('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search || selectedType !== 'ALL' || selectedVenue !== 'ALL' || selectedPricing !== 'ALL' || cityInput
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] font-sans">
      {/* ── Top Header Section ── */}
      <div className="border-b border-stone-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>Public Event Catalog</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] leading-tight">
              Discover & Attend Gatherings
            </h1>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Explore hackathons, developer summits, workshops, and cultural fests. Claim verified credentials and access dynamic QR passes from a single account.
            </p>
          </div>

          {/* ── Search & Filter Bar ── */}
          <div className="mt-8 space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by event title, topic, or keyword..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAF9] border border-stone-200 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative sm:w-48">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="City / Region"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAFAF9] border border-stone-200 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
              >
                Search
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* ── Category Pills ── */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {EVENT_TYPE_OPTIONS.map((opt) => {
                  const isSelected = selectedType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSelectedType(opt.value);
                        setPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                        isSelected
                          ? 'bg-[#10B981] text-white shadow-sm'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* ── Secondary Dropdowns: Format & Pricing ── */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-600">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-stone-500">Format:</span>
                  <select
                    value={selectedVenue}
                    onChange={(e) => {
                      setSelectedVenue(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {VENUE_TYPE_OPTIONS.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-stone-500">Pricing:</span>
                  <select
                    value={selectedPricing}
                    onChange={(e) => {
                      setSelectedPricing(e.target.value);
                      setPage(1);
                    }}
                    className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {PRICING_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 ml-auto flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Reset all filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Results Metadata Bar */}
        <div className="flex items-center justify-between text-xs text-stone-500">
          <span>
            Showing <strong className="text-stone-900">{events.length}</strong> of{' '}
            <strong className="text-stone-900">{total}</strong> live events
          </span>
          {totalPages > 1 && (
            <span>
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        {/* ── Loading Skeleton ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 bg-white border border-stone-200/80 rounded-2xl animate-pulse p-4 space-y-4"
              >
                <div className="h-40 bg-stone-100 rounded-xl" />
                <div className="h-4 bg-stone-100 rounded w-3/4" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
                <div className="h-3 bg-stone-100 rounded w-1/3 pt-4" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* ── Error State with Retry ── */
          <div className="py-16 text-center bg-white border border-rose-200 rounded-2xl p-8 space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-900">Failed to Load Catalog</h3>
              <p className="text-xs text-stone-600 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={fetchEvents}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          /* ── Empty State ── */
          <div className="py-16 text-center bg-white border border-stone-200/80 rounded-2xl p-8 space-y-4 max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
              <Compass className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-stone-900">
                {hasActiveFilters ? 'No Events Match Your Filters' : 'No Public Events Published Yet'}
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed max-w-md mx-auto">
                {hasActiveFilters
                  ? 'Try broadening your search term or resetting category filters to view other live gatherings.'
                  : 'Organizers publish events frequently. Check back soon or create your own event now.'}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters ? (
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-lg bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => navigate('/events/create')}
                  className="px-4 py-2 rounded-lg bg-[#10B981] text-white font-semibold text-xs hover:bg-[#059669] transition-colors shadow-sm"
                >
                  Create an Event
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── Event Grid ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}/public`)}
                className="group relative flex flex-col justify-between bg-white border border-stone-200/90 hover:border-emerald-400/80 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-emerald-950/5 hover:-translate-y-0.5"
              >
                {/* Banner Header */}
                <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                  {event.bannerUrl ? (
                    <img
                      src={event.bannerUrl}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300">
                      <Sparkles className="w-8 h-8 text-stone-300" />
                    </div>
                  )}

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-md text-stone-800 text-[11px] font-bold uppercase tracking-wider shadow-sm border border-stone-200/50">
                      {event.eventType.replace('_', ' ')}
                    </span>
                    {event.verificationStatus === 'VERIFIED' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 shadow-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {event.name}
                    </h3>
                    <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                      {event.description || 'Join attendees for this high-impact gathering and networking opportunity.'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-stone-100 text-xs text-stone-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{formatDate(event.schedule?.startAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {event.venue?.type === 'ONLINE' ? (
                        <>
                          <Video className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">Virtual Gathering</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate">
                            {event.venue?.city ? `${event.venue.city}, ` : ''}
                            {event.venue?.name || 'Venue TBA'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
                      <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                      {event.registration?.pricingModel === 'PAID' ? 'Paid Admission' : 'Free Pass'}
                    </span>

                    <span className="inline-flex items-center gap-1 font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors">
                      View Details
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6 border-t border-stone-200/80">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-40 text-xs font-semibold text-stone-700 border border-stone-200 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-stone-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-lg bg-white hover:bg-stone-50 disabled:opacity-40 text-xs font-semibold text-stone-700 border border-stone-200 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicEventsPage;
