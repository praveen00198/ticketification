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
          <div className="bg-white border border-stone-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 max-w-xl mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">No Public Events in this Category</h3>
            <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
              Be the first to publish an event in this category or explore all available gatherings.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectCategory('ALL')}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                View All Events
              </button>
              <button
                type="button"
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-black transition-colors cursor-pointer"
              >
                Create Event
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
