import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Compass, Ticket, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { PublicEventSummary } from '../../api/public';

export const EVENT_TYPE_TABS = [
  { label: 'All Gatherings', value: 'ALL' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Conferences', value: 'CONFERENCE' },
  { label: 'Concerts & Music', value: 'CONCERT' },
  { label: 'Festivals', value: 'FESTIVAL' },
  { label: 'Workshops', value: 'WORKSHOP' },
  { label: 'College Fests', value: 'COLLEGE_EVENT' },
];

function formatDate(str?: string) {
  if (!str) return 'Date TBA';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function venueLabel(event: PublicEventSummary) {
  if (event.venue?.type === 'ONLINE') return 'Virtual Event';
  if (event.venue?.city) return event.venue.city;
  if (event.venue?.name) return event.venue.name;
  return 'In-Person Venue';
}

export interface LiveEventsCatalogSectionProps {
  events: PublicEventSummary[];
  eventsLoading: boolean;
  eventsError: boolean;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onRetry: () => void;
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToRegister?: () => void;
}

export const LiveEventsCatalogSection: React.FC<LiveEventsCatalogSectionProps> = ({
  events,
  eventsLoading,
  eventsError,
  selectedCategory,
  onSelectCategory,
  onRetry,
  currentUser,
  onNavigateToRegister,
}) => {
  const navigate = useNavigate();

  return (
    <section className="py-12 sm:py-16 bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">
              Live Public Catalog
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
              Featured Upcoming Gatherings
            </h2>
            <p className="text-sm text-stone-600 mt-1">
              Real events published by verified organizers across academia, tech, and entertainment.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900 hover:text-stone-700 transition-colors"
          >
            Browse entire catalog
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {EVENT_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onSelectCategory(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                selectedCategory === tab.value
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Catalog Content */}
        {eventsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-white border border-stone-200 animate-pulse p-4" />
            ))}
          </div>
        ) : eventsError ? (
          <div className="py-12 text-center space-y-2 border border-stone-200 rounded-2xl bg-white p-8 max-w-md mx-auto">
            <p className="text-sm text-stone-600">Unable to load featured events right now.</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-stone-900 underline cursor-pointer"
            >
              Retry loading
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center flex flex-col items-center justify-center space-y-6 max-w-2xl mx-auto shadow-sm relative overflow-hidden group">
            {/* Subtle atmospheric card backdrop */}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-50/60 to-transparent pointer-events-none -z-0" />

            {/* ── Realistic Torn / Ripped Ticket Visual with Skew & Perspective ── */}
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] h-[140px] flex items-center justify-center select-none py-2 z-10">
              {/* Floating Torn Paper Particles / Fibers */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-stone-200 border border-stone-300 rounded-xs rotate-45 translate-x-2 -translate-y-4 animate-pulse opacity-60" />
                <span className="w-1 h-2 bg-stone-300 rounded-2xs -rotate-12 -translate-x-1 translate-y-6 opacity-50" />
                <span className="w-2 h-1 bg-stone-200 border border-stone-300/80 rounded-xs rotate-12 translate-x-5 translate-y-3 opacity-70" />
              </div>

              {/* TORN TICKET SVG ENGINE */}
              <div className="relative flex items-center justify-center -space-x-1 sm:-space-x-2">
                {/* ── LEFT TICKET PIECE (Main Body - Skewed & Tilted Left) ── */}
                <div className="transform -rotate-[6deg] -translate-x-2 sm:-translate-x-3 translate-y-1 skew-y-[-2deg] group-hover:-rotate-[8deg] group-hover:-translate-x-4 transition-all duration-300 filter drop-shadow-[0_12px_18px_rgba(28,25,23,0.08)]">
                  <svg
                    width="200"
                    height="124"
                    viewBox="0 0 200 124"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="overflow-visible"
                  >
                    {/* Realistic Jagged Left Ticket Silhouette */}
                    <path
                      d="M 12 2
                         L 182 2
                         L 185 10
                         L 179 18
                         L 186 26
                         L 180 34
                         L 187 43
                         L 181 52
                         L 188 61
                         L 180 70
                         L 187 79
                         L 182 88
                         L 188 97
                         L 182 105
                         L 187 114
                         L 181 122
                         L 12 122
                         A 10 10 0 0 1 2 112
                         L 2 72
                         A 10 10 0 0 0 2 52
                         L 2 12
                         A 10 10 0 0 1 12 2 Z"
                      fill="#FAFAF9"
                      stroke="#D6D3D1"
                      strokeWidth="1.5"
                    />

                    {/* Subtle torn edge fiber highlight */}
                    <path
                      d="M 182 2 L 185 10 L 179 18 L 186 26 L 180 34 L 187 43 L 181 52 L 188 61 L 180 70 L 187 79 L 182 88 L 188 97 L 182 105 L 187 114 L 181 122"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.8"
                    />

                    {/* Left Stub Content */}
                    <g transform="translate(18, 16)">
                      {/* Brand Header */}
                      <text x="0" y="8" fill="#78716C" fontSize="8" fontWeight="700" fontFamily="monospace" letterSpacing="0.1em">
                        TICKETIFICATION // PASS
                      </text>

                      {/* Title */}
                      <text x="0" y="27" fill="#1C1917" fontSize="13" fontWeight="900" fontFamily="sans-serif" letterSpacing="-0.02em">
                        UNCLAIMED SLOT
                      </text>

                      {/* Event Type / Subtitle */}
                      <text x="0" y="41" fill="#A8A29E" fontSize="8" fontWeight="600" fontFamily="sans-serif">
                        CATEGORY PASS • ZERO ADMISSION
                      </text>

                      {/* Realistic Barcode */}
                      <g transform="translate(0, 52)">
                        <rect x="0" y="0" width="2" height="18" fill="#57534E" />
                        <rect x="4" y="0" width="1" height="18" fill="#78716C" />
                        <rect x="7" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="12" y="0" width="1.5" height="18" fill="#A8A29E" />
                        <rect x="16" y="0" width="4" height="18" fill="#57534E" />
                        <rect x="22" y="0" width="2" height="18" fill="#78716C" />
                        <rect x="26" y="0" width="1" height="18" fill="#57534E" />
                        <rect x="29" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="34" y="0" width="1.5" height="18" fill="#A8A29E" />
                        <rect x="38" y="0" width="2" height="18" fill="#57534E" />
                        <rect x="42" y="0" width="4" height="18" fill="#78716C" />
                        <rect x="48" y="0" width="1.5" height="18" fill="#57534E" />
                        <rect x="52" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="57" y="0" width="2" height="18" fill="#A8A29E" />
                        <rect x="61" y="0" width="1.5" height="18" fill="#57534E" />
                        <rect x="64" y="0" width="3.5" height="18" fill="#78716C" />
                        <rect x="70" y="0" width="2" height="18" fill="#57534E" />
                        <rect x="74" y="0" width="1.5" height="18" fill="#A8A29E" />
                        <rect x="78" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="83" y="0" width="2" height="18" fill="#78716C" />
                        <rect x="87" y="0" width="4" height="18" fill="#57534E" />
                        <rect x="93" y="0" width="1.5" height="18" fill="#57534E" />
                        <rect x="97" y="0" width="2" height="18" fill="#A8A29E" />
                        <rect x="101" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="106" y="0" width="1" height="18" fill="#78716C" />
                        <rect x="109" y="0" width="3" height="18" fill="#57534E" />
                        <rect x="114" y="0" width="2" height="18" fill="#57534E" />
                        <rect x="118" y="0" width="1" height="18" fill="#A8A29E" />
                        <rect x="121" y="0" width="3.5" height="18" fill="#57534E" />
                      </g>

                      {/* Serial Number */}
                      <text x="0" y="82" fill="#A8A29E" fontSize="7.5" fontWeight="600" fontFamily="monospace" letterSpacing="0.12em">
                        SERIAL: #0000-VOID-NULL
                      </text>
                    </g>
                  </svg>
                </div>

                {/* ── RIGHT TICKET STUB (Detached Piece - Skewed & Tilted Right) ── */}
                <div className="transform rotate-[7deg] translate-x-2 sm:translate-x-3 -translate-y-1.5 skew-y-[3deg] group-hover:rotate-[9deg] group-hover:translate-x-4 transition-all duration-300 filter drop-shadow-[0_12px_18px_rgba(28,25,23,0.08)]">
                  <svg
                    width="120"
                    height="124"
                    viewBox="0 0 120 124"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="overflow-visible"
                  >
                    {/* Matching Jagged Right Ticket Silhouette */}
                    <path
                      d="M 18 2
                         L 108 2
                         A 10 10 0 0 1 118 12
                         L 118 52
                         A 10 10 0 0 0 118 72
                         L 118 112
                         A 10 10 0 0 1 108 122
                         L 18 122
                         L 24 114
                         L 19 105
                         L 25 97
                         L 19 88
                         L 24 79
                         L 17 70
                         L 25 61
                         L 18 52
                         L 24 43
                         L 17 34
                         L 23 26
                         L 16 18
                         L 22 10
                         L 18 2 Z"
                      fill="#FAFAF9"
                      stroke="#D6D3D1"
                      strokeWidth="1.5"
                    />

                    {/* Subtle torn edge fiber highlight */}
                    <path
                      d="M 18 2 L 22 10 L 16 18 L 23 26 L 17 34 L 24 43 L 18 52 L 25 61 L 17 70 L 24 79 L 19 88 L 25 97 L 19 105 L 24 114 L 18 122"
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity="0.8"
                    />

                    {/* Right Stub Content */}
                    <g transform="translate(34, 18)">
                      {/* Mini QR Box Outline */}
                      <rect x="4" y="2" width="52" height="52" rx="8" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1.5" />
                      
                      {/* QR Placeholder Glyphs */}
                      <rect x="10" y="8" width="14" height="14" rx="3" fill="#1C1917" />
                      <rect x="13" y="11" width="8" height="8" rx="1.5" fill="#FFFFFF" />
                      <rect x="15" y="13" width="4" height="4" fill="#1C1917" />

                      <rect x="36" y="8" width="14" height="14" rx="3" fill="#1C1917" />
                      <rect x="39" y="11" width="8" height="8" rx="1.5" fill="#FFFFFF" />
                      <rect x="41" y="13" width="4" height="4" fill="#1C1917" />

                      <rect x="10" y="34" width="14" height="14" rx="3" fill="#1C1917" />
                      <rect x="13" y="37" width="8" height="8" rx="1.5" fill="#FFFFFF" />
                      <rect x="15" y="39" width="4" height="4" fill="#1C1917" />

                      {/* Small QR dots */}
                      <rect x="28" y="12" width="3" height="3" fill="#78716C" />
                      <rect x="28" y="20" width="4" height="4" fill="#1C1917" />
                      <rect x="36" y="28" width="5" height="4" fill="#78716C" />
                      <rect x="28" y="36" width="4" height="4" fill="#1C1917" />
                      <rect x="36" y="38" width="4" height="4" fill="#1C1917" />
                      <rect x="44" y="34" width="4" height="4" fill="#78716C" />

                      {/* Stub Stamp */}
                      <g transform="translate(2, 64) rotate(-4)">
                        <rect x="0" y="0" width="56" height="16" rx="4" fill="#F5F5F4" stroke="#A8A29E" strokeWidth="1" strokeDasharray="2 2" />
                        <text x="28" y="11" textAnchor="middle" fill="#78716C" fontSize="8" fontWeight="800" fontFamily="monospace" letterSpacing="0.1em">
                          DETACHED
                        </text>
                      </g>
                    </g>
                  </svg>
                </div>
              </div>
            </div>

            {/* ── Subtle Heading Text (In Libre Baskerville) ── */}
            <div className="space-y-2 z-10">
              <h3 className="text-xl sm:text-2xl font-serif font-normal text-stone-900 tracking-tight">
                No Passes Issued in this Category
              </h3>
              <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
                There are no public events published under this filter right now. You can clear the category filter to explore all upcoming gatherings or launch your own event and issue the first pass.
              </p>
            </div>

            {/* ── Action Buttons ── */}
            <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto z-10">
              <button
                type="button"
                onClick={() => onSelectCategory('ALL')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-stone-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>View All Gatherings</span>
              </button>
              <button
                type="button"
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Ticket className="w-3.5 h-3.5 text-stone-700" />
                <span>Publish New Event</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}/public`)}
                className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md hover:border-stone-400 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="relative h-44 bg-stone-100 overflow-hidden">
                  {event.bannerUrl ? (
                    <img
                      src={event.bannerUrl}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300">
                      <Ticket className="w-10 h-10 text-stone-300" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-white/95 text-stone-800 shadow-sm border border-stone-200/50">
                    {event.eventType.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-base text-[#111827] group-hover:text-stone-900 transition-colors line-clamp-1">
                      {event.name}
                    </h4>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {event.description || 'Join this exciting event and connect with organizers.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stone-500" />
                      <span>{formatDate(event.schedule?.startAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      <span className="truncate">{venueLabel(event)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
