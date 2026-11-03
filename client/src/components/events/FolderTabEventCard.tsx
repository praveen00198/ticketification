import React from 'react';
import {
  MapPin,
  Video,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  IndianRupee,
} from 'lucide-react';

export interface FolderTabEventCardProps {
  id?: string;
  name: string;
  eventType?: string;
  description?: string | null;
  bannerUrl?: string | null;
  dateStr?: string | null;
  timeStr?: string | null;
  venueLabel?: string | null;
  venueType?: 'PHYSICAL' | 'ONLINE' | 'HYBRID' | string | null;
  pricingModel?: 'FREE' | 'PAID' | string | null;
  verificationStatus?: string | null;
  credentialTerminology?: string | null;
  capacity?: number;
  confirmedCount?: number;
  onClick?: () => void;
  // Dashboard specific props
  isDashboardCard?: boolean;
  status?: string;
  displayStatus?: string;
  visibility?: 'public' | 'private' | string;
  isSelected?: boolean;
  onManage?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onSelect?: (e: React.MouseEvent) => void;
  actionText?: string;
}

/**
 * Extracts high-impact numeric date parts from ISO or date strings.
 * Formats day as dominant number, and month/year as compact uppercase token (e.g. OCT'26).
 */
export function extractDateParts(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr) {
    return { day: '01', monthYear: 'TBA', time: timeStr || '' };
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const monthNames = [
          'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
          'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
        ];
        const mIdx = parseInt(parts[1], 10) - 1;
        const month = monthNames[mIdx] || 'TBA';
        const year = parts[0].slice(-2);
        return {
          day: parts[2].padStart(2, '0'),
          monthYear: `${month}'${year}`,
          time: timeStr || '',
        };
      }
      return { day: '01', monthYear: 'TBA', time: timeStr || '' };
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = String(d.getFullYear()).slice(-2);
    let formattedTime = '';
    if (timeStr && !timeStr.includes('T') && !timeStr.includes('-')) {
      formattedTime = timeStr;
    } else if (dateStr.includes('T') || (timeStr && timeStr.includes('T'))) {
      const targetDate = timeStr && timeStr.includes('T') ? new Date(timeStr) : d;
      formattedTime = targetDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    return { day, monthYear: `${month}'${year}`, time: formattedTime };
  } catch {
    return { day: '01', monthYear: 'TBA', time: timeStr || '' };
  }
}

/**
 * Light, airy, and sophisticated theme banner for events without a custom cover image.
 * Uses warm stone neutrals with subtle ambient tints, avoiding dark surfaces and heavy green.
 */
function GenerativeThemeBanner({ category, name }: { category: string; name: string }) {
  const normCategory = (category || '').toUpperCase();

  // Refined light-theme palettes: gentle stone base with restrained ambient glow
  let gradientTheme = 'from-stone-100 via-stone-200/70 to-emerald-50/80';
  let orbColor1 = 'bg-emerald-300/25';
  let orbColor2 = 'bg-stone-300/35';

  if (normCategory.includes('HACKATHON') || normCategory.includes('CODE') || normCategory.includes('DEV')) {
    gradientTheme = 'from-stone-100 via-stone-200/80 to-emerald-100/60';
    orbColor1 = 'bg-emerald-400/25';
    orbColor2 = 'bg-teal-300/20';
  } else if (normCategory.includes('CONFERENCE') || normCategory.includes('SUMMIT')) {
    gradientTheme = 'from-stone-100 via-stone-200/75 to-amber-100/50';
    orbColor1 = 'bg-amber-300/25';
    orbColor2 = 'bg-stone-300/30';
  } else if (normCategory.includes('CONCERT') || normCategory.includes('FESTIVAL') || normCategory.includes('MUSIC')) {
    gradientTheme = 'from-stone-100 via-stone-200/75 to-rose-100/50';
    orbColor1 = 'bg-rose-300/25';
    orbColor2 = 'bg-amber-200/20';
  } else if (normCategory.includes('WORKSHOP') || normCategory.includes('BOOTCAMP')) {
    gradientTheme = 'from-stone-100 via-stone-200/75 to-sky-100/50';
    orbColor1 = 'bg-sky-300/25';
    orbColor2 = 'bg-emerald-200/20';
  }

  return (
    <div
      title={name}
      className={`w-full h-full relative overflow-hidden bg-gradient-to-br ${gradientTheme}`}
    >
      {/* Soft Ambient Lighting Orbs */}
      <div
        className={`absolute -top-8 -right-8 w-36 h-36 rounded-full ${orbColor1} blur-2xl pointer-events-none`}
      />
      <div
        className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full ${orbColor2} blur-xl pointer-events-none`}
      />

      {/* Subtle Dot Matrix Pattern */}
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />

      {/* Center Icon */}
      <div className="w-full h-full flex items-center justify-center opacity-20 pointer-events-none">
        <Sparkles className="w-10 h-10 text-stone-700 stroke-[1.2]" />
      </div>
    </div>
  );
}

export const FolderTabEventCard: React.FC<FolderTabEventCardProps> = ({
  id,
  name,
  eventType,
  description,
  bannerUrl,
  dateStr,
  timeStr,
  venueLabel,
  venueType,
  pricingModel,
  verificationStatus,
  onClick,
  onSelect,
}) => {
  const dateParts = extractDateParts(dateStr, timeStr);
  const isOnline = venueType === 'ONLINE' || venueLabel?.toLowerCase().includes('online');
  const cleanEventType = (eventType || 'EVENT').replace('_', ' ');

  const locationText =
    venueLabel || (isOnline ? 'Virtual Gathering' : 'Venue TBA');

  return (
    /* Outer container: frames both child divs with a clean, tactile light-theme bezel */
    <div
      data-event-id={id}
      onClick={onClick}
      className="group relative flex flex-col bg-stone-100/90 p-2.5 rounded-[34px] shadow-2xs hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 select-none"
    >
      {/* ── FIRST DIV: Upper Banner (Compact height, holds cover image or light theme generative banner) ── */}
      <div className="relative w-full h-36 sm:h-38 overflow-hidden bg-stone-200/80 shrink-0 rounded-t-[24px]">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <GenerativeThemeBanner category={eventType || 'EVENT'} name={name} />
        )}

        {/* Top-Right Banner Label: Free/Paid with micro rupee icon */}
        <div className="absolute top-3 right-3.5 z-10 pointer-events-none flex items-center gap-1.5">
          {verificationStatus === 'VERIFIED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-emerald-700 text-[10px] font-semibold border border-emerald-200/70 shadow-xs">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Verified
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-[2px] rounded-full bg-white/90 backdrop-blur-md text-stone-900 text-[10px] font-medium border border-white/80 shadow-xs tracking-wide">
            <span>{pricingModel === 'PAID' ? 'Paid' : 'Free'}</span>
            <span className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-200/90 flex items-center justify-center shrink-0">
              <IndianRupee className="w-2 h-2 text-stone-700 stroke-[2.5]" />
            </span>
          </span>
        </div>
      </div>

      {/* ── SECOND DIV: Card Body with Both Curves Smooth & Rounded Corners ── */}
      <div className="relative -mt-12 z-10 flex flex-col flex-1">
        {/* Layer 1 (Background Silhouette): Smooth Folder-Tab SVG with dual continuous curves + Solid White Body */}
        <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
          <div className="w-full h-[44px] shrink-0">
            <svg
              viewBox="0 0 400 52"
              preserveAspectRatio="none"
              className="w-full h-full block fill-white"
              aria-hidden="true"
            >
              {/*
                Two Perfectly Smooth Curves:
                - Top-Left: M 0 16 C 0 7, 7 0, 16 0 (Smooth rounded corner R=16)
                - Horizontal Tab Line: L 195 0
                - Curve 1 (S-Curve): C 220 0, 240 34, 265 34 (Continuous cubic inflection curve down into shelf)
                - Horizontal Shelf Line: L 384 34
                - Curve 2 (Downward Right Corner): C 394 34, 400 40, 400 50 (Smooth downward curve into vertical right edge)
                - Closes Body: L 400 52 L 0 52 Z
              */}
              <path d="M 0 16 C 0 7, 7 0, 16 0 L 195 0 C 220 0, 240 34, 265 34 L 384 34 C 394 34, 400 40, 400 50 L 400 52 L 0 52 Z" />
              <path
                d="M 0 16 C 0 7, 7 0, 16 0 L 195 0 C 220 0, 240 34, 265 34 L 384 34 C 394 34, 400 40, 400 50"
                fill="none"
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth="1.2"
              />
            </svg>
          </div>
          {/* Solid White Body seamlessly continuing down from the SVG notch with rounded bottom */}
          <div className="w-full flex-1 bg-white -mt-px rounded-b-[24px]" />
        </div>

        {/* Layer 2 (Foreground Content): Positioned with natural harmony over the folder tab body */}
        <div className="relative z-10 px-5 pt-3 sm:pt-3.5 pb-5 flex flex-col justify-between flex-1 gap-3">
          {/* Header Typography Group: Event Type + Title + Description in Tight Harmony */}
          <div>
            {/* Raised Tab Left Side: Category / Event Type with breathing room from top line */}
            <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-stone-500 block truncate max-w-[65%] sm:max-w-[70%]">
              {cleanEventType}
            </span>

            {/* Event Title */}
            <h3
              title={name}
              className="text-base sm:text-md font-semibold text-stone-900 tracking-wide line-clamp-1 mt-2"
            >
              {name}
            </h3>

            {/* 2-line Description directly under Title (harmonious, no gap) */}
            {description && (
              <p className="text-xs text-stone-500 line-clamp-2 tracking-wide leading-tight mt-1">
                {description}
              </p>
            )}
          </div>

          {/* Logistics & Footer Group */}
          <div className="flex flex-col gap-3 mt-2">
            {/* Venue & Time details */}
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              {isOnline ? (
                <Video className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              )}
              <span className="truncate">{locationText}</span>
            </div>

            {/* Card Footer: Large Day + Small Month'Year (Left) & Tertiary "Go to Event >" (Right) */}
            <div className="mt-1.5 flex items-baseline justify-between">
              {/* Full Date block */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-semibold text-stone-800 tracking-tight leading-none">
                  {dateParts.day}
                </span>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider leading-none">
                  {dateParts.monthYear}
                </span>
              </div>

              {/* Tertiary "Go to Event >" Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelect) onSelect(e);
                  else if (onClick) onClick();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-800 cursor-pointer"
              >
                <span>Go to Event</span>
                <ArrowRight className="w-3.5 h-3.5 text-stone-700 group-hover/btn:translate-x-0.5 group-hover/btn:text-emerald-700 transition-all" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolderTabEventCard;
