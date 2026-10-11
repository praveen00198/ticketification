import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  MapPin,
  Video,
  Ticket,
  Filter,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Compass,
} from 'lucide-react';
import { publicApi, PublicEventSummary } from '../api/public';

const EVENT_TYPE_OPTIONS = [
  { label: 'All Categories', value: 'ALL' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Conferences', value: 'CONFERENCE' },
  { label: 'Concerts & Music', value: 'CONCERT' },
  { label: 'Festivals', value: 'FESTIVAL' },
  { label: 'Workshops', value: 'WORKSHOP' },
  { label: 'College & Fests', value: 'COLLEGE_EVENT' },
  { label: 'Exhibitions', value: 'EXHIBITION' },
];

const VENUE_TYPE_OPTIONS = [
  { label: 'All Formats', value: 'ALL' },
  { label: 'In-Person', value: 'PHYSICAL' },
  { label: 'Virtual', value: 'ONLINE' },
  { label: 'Hybrid', value: 'HYBRID' },
];

export const PublicEventsPage: React.FC = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedVenue, setSelectedVenue] = useState('ALL');
  const [selectedPricing, setSelectedPricing] = useState('ALL');
  const [cityInput, setCityInput] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error('Failed to load public events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, selectedType, selectedVenue, selectedPricing]);

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
    <div className="min-vh-100 bg-[#090d16] text-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#111622] via-[#141b2c] to-[#0d131f] border border-gray-800/80 p-8 sm:p-12 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              Verified Event Discovery
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Discover & Attend <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                World-Class Gatherings
              </span>
            </h1>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              Explore hackathons, developer conferences, concerts, and campus summits.
              Register with 1-click and secure tamper-proof verified credentials with live dynamic QR codes.
            </p>

            {/* Quick Search Form */}
            <form onSubmit={handleSearchSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by event title, topic, or keyword..."
                  className="w-full pl-11 pr-4 py-3 bg-[#090d16]/90 border border-gray-700/80 focus:border-emerald-500 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="relative sm:w-48">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="City / Region"
                  className="w-full pl-10 pr-4 py-3 bg-[#090d16]/90 border border-gray-700/80 focus:border-emerald-500 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#090d16] font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0"
              >
                Search
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            Categories
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSelectedType(opt.value);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedType === opt.value
                    ? 'bg-emerald-500 text-[#090d16] shadow-md shadow-emerald-500/20'
                    : 'bg-[#111622] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Format:</span>
              <select
                value={selectedVenue}
                onChange={(e) => {
                  setSelectedVenue(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-[#111622] border border-gray-800 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
              >
                {VENUE_TYPE_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Pricing:</span>
              <select
                value={selectedPricing}
                onChange={(e) => {
                  setSelectedPricing(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-[#111622] border border-gray-800 rounded-xl text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Pricing</option>
                <option value="FREE">Free Pass</option>
                <option value="PAID">Paid Pass</option>
              </select>
            </div>

            {(selectedType !== 'ALL' || selectedVenue !== 'ALL' || selectedPricing !== 'ALL' || search || cityInput) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors ml-auto underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800">
          <span>
            Showing <strong className="text-white">{events.length}</strong> of <strong className="text-white">{total}</strong> live events
          </span>
          {totalPages > 1 && (
            <span>
              Page {page} of {totalPages}
            </span>
          )}
        </div>

        {/* Event Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 bg-[#111622] border border-gray-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center bg-[#111622]/50 border border-gray-800/80 rounded-3xl p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-800 text-gray-500 mx-auto flex items-center justify-center">
              <Compass className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">No Public Events Found</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              We couldn't find any events matching your selected criteria. Try adjusting your search keyword or clearing the filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#090d16] font-semibold text-xs transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}/public`)}
                className="group relative flex flex-col justify-between bg-[#111622] hover:bg-[#141b2a] border border-gray-800 hover:border-emerald-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-950/20"
              >
                {/* Banner / Header gradient */}
                <div className="relative h-44 w-full bg-gradient-to-br from-gray-900 to-[#1b2336] overflow-hidden">
                  {event.bannerUrl ? (
                    <img
                      src={event.bannerUrl}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#162032] to-[#0a101b]">
                      <Sparkles className="w-10 h-10 text-emerald-500/30" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-[#111622] via-transparent to-black/40" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                      {event.eventType.replace('_', ' ')}
                    </span>
                    {event.verificationStatus === 'VERIFIED' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/90 text-[#090d16] text-[11px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {event.name}
                    </h3>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {event.description || 'Join attendees for this high-impact gathering and networking opportunity.'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-800/80 text-xs text-gray-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{formatDate(event.schedule?.startAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {event.venue?.type === 'ONLINE' ? (
                        <>
                          <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">Online Event</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate">
                            {event.venue?.city ? `${event.venue.city}, ` : ''}{event.venue?.name || 'In-Person Venue'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Footer CTAs */}
                  <div className="pt-3 border-t border-gray-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Ticket className="w-3.5 h-3.5" />
                      <span>{event.registration?.pricingModel === 'PAID' ? 'Paid Pass' : 'Free Registration'}</span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                      View Event
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-6">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 rounded-xl bg-[#111622] hover:bg-gray-800 disabled:opacity-40 text-xs font-semibold text-white border border-gray-800 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-4 py-2 rounded-xl bg-[#111622] hover:bg-gray-800 disabled:opacity-40 text-xs font-semibold text-white border border-gray-800 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEventsPage;
