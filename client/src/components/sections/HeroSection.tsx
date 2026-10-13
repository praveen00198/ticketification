import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Compass, Ticket, Check, ArrowRight } from 'lucide-react';
import { PublicEventSummary } from '../../api/public';

export interface HeroSectionProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToRegister?: () => void;
  featuredEvent?: PublicEventSummary | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentUser,
  onNavigateToRegister,
  featuredEvent,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
}) => {
  const navigate = useNavigate();

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-12 lg:pb-12">
      {/* Monumental Headline Layout */}
      <div className="relative text-center">
        <div className="flex flex-col items-center gap-6">
          {/* Row 1: 'Where' + Description Paragraph Centered & Next to Each Other */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-7 sm:gap-10">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[7rem] xl:text-[8rem] font-serif font-normal tracking-tight text-stone-950 leading-none">
              Where
            </h1>
            <p className="max-w-xs sm:max-w-sm text-xs sm:text-[13px] text-stone-600 font-normal leading-relaxed text-center sm:text-left sm:mt-6">
              Ticketification is an end-to-end event operating platform that unifies tamper-proof visual passes, roster imports, and gate turnstiles with sub-second execution.
            </p>
          </div>

          {/* Row 2: 'credentials and' (Straight aligned with Scroll Down badge) */}
          <div className="relative -mt-4 sm:-mt-6 lg:-mt-8 flex items-center justify-center">
            <div className="relative inline-flex items-center">
              <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[7.5rem] xl:text-[8.5rem] font-serif font-normal tracking-tight text-stone-950 leading-[0.92]">
                credentials and
              </h2>

              {/* Right: Circular Rotating 'SCROLL DOWN' Stamp + Delicate Arrow */}
              <div className="hidden lg:flex absolute left-full ml-16 xl:ml-20 top-1/2 -translate-y-1/2 flex-col items-center gap-1 pointer-events-none select-none">
                <div className="relative w-16 h-16 xl:w-20 xl:h-20 flex items-center justify-center animate-[spin_20s_linear_infinite]">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <path
                      id="scrollTextPath"
                      d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                      fill="none"
                    />
                    <text className="text-[9.5px] font-mono uppercase tracking-[0.24em] fill-stone-600 font-medium">
                      <textPath href="#scrollTextPath" startOffset="0%">
                        • SCROLL DOWN • SCROLL DOWN •
                      </textPath>
                    </text>
                  </svg>
                  {/* Central Linked Glyph */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center -space-x-0.5 text-stone-800">
                      <span className="w-2 h-2 rounded-full border border-stone-700/80" />
                      <span className="w-2 h-2 rounded-full border border-stone-700/80" />
                    </div>
                  </div>
                </div>
                {/* Minimalist Downward Line & Arrow */}
                <div className="flex flex-col items-center -mt-0.5">
                  <div className="w-[1px] h-20 bg-stone-400/80" />
                  <span className="text-[11px] text-stone-500 font-serif leading-none">↓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: 'gate access' */}
          <div className="-mt-5 sm:-mt-7 lg:-mt-9">
            <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[8rem] xl:text-[9rem] font-serif font-normal tracking-tight text-stone-950 leading-[0.92]">
              gate access
            </h2>
          </div>

          {/* Row 4: Supporting Paragraph + 'meet' Centered & Next to Each Other */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-5 sm:gap-7 -mt-1 sm:-mt-2 lg:-mt-3">
            <p className="max-w-xs sm:max-w-sm text-xs sm:text-[13px] text-stone-600 font-normal leading-relaxed text-center sm:text-right mt-1">
              Built for hackathons, conferences, concerts, and festivals. Trusted by organizers and attendees who demand zero gate queues.
            </p>
            <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[7rem] xl:text-[8rem] font-serif font-normal tracking-tight text-stone-950 leading-none -mt-6">
              meet
            </h2>
          </div>
        </div>
      </div>

      {/* ── Seamless Integrated Search Bar, CTAs & Guarantees ── */}
      <div className="mt-8 sm:mt-10 max-w-4xl mx-auto space-y-5 text-center">
        {/* Action Row: Search Input + Dual CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <form onSubmit={onSearchSubmit} className="relative w-full sm:w-[380px] md:w-[420px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search hackathons, conferences, concerts, cities..."
              className="w-full pl-11 pr-24 py-3 bg-white border border-stone-200/90 rounded-full text-sm text-[#111827] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900 shadow-2xs hover:border-stone-300 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-full bg-stone-950 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-sm cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="flex-1 sm:flex-none px-5 py-3 rounded-full bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Events</span>
            </button>
            <button
              type="button"
              onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
              className="flex-1 sm:flex-none px-5 py-3 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 text-xs sm:text-sm font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <Ticket className="w-4 h-4 text-stone-700" />
              <span>Organize an Event</span>
            </button>
          </div>
        </div>

        {/* Feature Guarantees */}
        <div className="pt-1 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs sm:text-sm text-stone-700">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-stone-900 bg-stone-900 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            </span>
            <span>One account for attending & hosting</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-stone-900 bg-stone-900 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            </span>
            <span>Sub-200ms QR check-in gates</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full border border-stone-900 bg-stone-900 flex items-center justify-center shrink-0">
              <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
            </span>
            <span>Zero duplicate ticket guarantee</span>
          </div>
        </div>

        {/* Live Gathering Discovery Micro-Banner */}
        {featuredEvent && (
          <div className="pt-1">
            <Link
              to={`/events/${featuredEvent.id}/public`}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100/90 hover:bg-stone-200/90 border border-stone-200/80 text-[11px] text-stone-700 transition-colors group"
            >
              {/* Status Indication: live event status dot */}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-stone-900">Featured Gathering:</span>
              <span className="truncate max-w-[180px] sm:max-w-xs">{featuredEvent.name}</span>
              <span className="text-stone-900 font-semibold group-hover:underline transition-transform flex items-center gap-0.5">
                View Pass Details <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
