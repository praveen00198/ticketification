import React from 'react';
import {
  MapPin,
  Video,
  Clock,
  QrCode,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { extractDateParts } from './FolderTabEventCard';

export interface RegistrationEventCardProps {
  id?: string;
  registrationId?: string;
  name: string;
  eventType?: string;
  description?: string | null;
  bannerUrl?: string | null;
  dateStr?: string | null;
  timeStr?: string | null;
  venueLabel?: string | null;
  venueType?: 'PHYSICAL' | 'ONLINE' | 'HYBRID' | string | null;
  status: string; // 'CONFIRMED' | 'PENDING_APPROVAL' | 'CANCELLED' | 'REJECTED'
  credentialStatus?: string; // 'ACTIVE' | 'CHECKED_IN' | 'REVOKED' | 'EXPIRED'
  isCompleted?: boolean;
  isCancelling?: boolean;
  onViewPass?: () => void;
  onCancel?: () => void;
  onClick?: () => void;
}

/**
 * Computes counter string like "2d to go" (if future) or "2d ago" (if passed).
 */
export function getCountdownLabel(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return null;

  const now = Date.now();
  const diffMs = target - now;
  const isFuture = diffMs > 0;
  const absDiff = Math.abs(diffMs);

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absDiff < hourMs) {
    const mins = Math.max(1, Math.round(absDiff / minuteMs));
    return isFuture ? `${mins}m to go` : `${mins}m ago`;
  }
  if (absDiff < dayMs) {
    const hours = Math.round(absDiff / hourMs);
    return isFuture ? `${hours}h to go` : `${hours}h ago`;
  }
  const days = Math.round(absDiff / dayMs);
  return isFuture ? `${days}d to go` : `${days}d ago`;
}

/**
 * Generative theme banner for registration cards without a custom cover image.
 */
function GenerativeThemeBanner({ category, name }: { category: string; name: string }) {
  const normCategory = (category || '').toUpperCase();

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
      <div className={`absolute -top-8 -right-8 w-36 h-36 rounded-full ${orbColor1} blur-2xl pointer-events-none`} />
      <div className={`absolute -bottom-6 -left-6 w-28 h-28 rounded-full ${orbColor2} blur-xl pointer-events-none`} />
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:14px_14px] pointer-events-none" />
      <div className="w-full h-full flex items-center justify-center opacity-20 pointer-events-none">
        <Sparkles className="w-10 h-10 text-stone-700 stroke-[1.2]" />
      </div>
    </div>
  );
}

export const RegistrationEventCard: React.FC<RegistrationEventCardProps> = ({
  id,
  name,
  eventType,
  description,
  bannerUrl,
  dateStr,
  timeStr,
  venueLabel,
  venueType,
  status,
  credentialStatus,
  isCompleted,
  isCancelling,
  onViewPass,
  onCancel,
  onClick,
}) => {
  const dateParts = extractDateParts(dateStr, timeStr);
  const countdownLabel = getCountdownLabel(dateStr);
  const isOnline = venueType === 'ONLINE' || venueLabel?.toLowerCase().includes('online');
  const cleanEventType = (eventType || 'EVENT').replace('_', ' ');

  const locationText =
    venueLabel || (isOnline ? 'Virtual Gathering' : 'Venue TBA');

  const isCancelled = status === 'CANCELLED';
  const isRejected = status === 'REJECTED';
  const isMuted = isCancelled || isRejected;

  return (
    /* Outer container: frames child divs with clean, tactile light-theme bezel */
    <div
      data-event-id={id}
      onClick={onClick || onViewPass}
      className={`group relative flex flex-col bg-stone-100/90 border border-stone-200/90 hover:border-stone-300 p-2.5 rounded-[34px] shadow-2xs hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 select-none ${
        isMuted ? 'opacity-80' : ''
      }`}
    >
      {/* ── FIRST DIV: Upper Banner (Holds cover image or generative banner + status & countdown capsule) ── */}
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

        {/* Top-Right Banner Badges: Status Pill + Counter Capsule ("2d to go" / "2d ago") */}
        <div className="absolute top-3 right-3.5 z-10 pointer-events-none flex items-center gap-1.5 flex-wrap justify-end">
          {/* Status Badge */}
          {status === 'CONFIRMED' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-emerald-700 text-[10px] font-semibold border border-emerald-200/70 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Confirmed
            </span>
          )}
          {status === 'PENDING_APPROVAL' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-amber-700 text-[10px] font-semibold border border-amber-200/70 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending
            </span>
          )}
          {isCancelled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-stone-600 text-[10px] font-semibold border border-stone-200 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
              Cancelled
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-rose-700 text-[10px] font-semibold border border-rose-200 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Rejected
            </span>
          )}

          {/* Time Counter Capsule ("2d to go" / "2d ago" with Clock icon in micro circle) */}
          {countdownLabel && !isCancelled && !isRejected && (
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-[2px] rounded-full bg-white/90 backdrop-blur-md text-stone-900 text-[10px] font-medium border border-white/80 shadow-xs tracking-wide">
              <span>{countdownLabel}</span>
              <span className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-200/90 flex items-center justify-center shrink-0">
                <Clock className="w-2 h-2 text-stone-700 stroke-[2.5]" />
              </span>
            </span>
          )}
        </div>
      </div>

      {/* ── SECOND DIV: Card Body with Smooth Folder-Tab Silhouette & Seamless White Body ── */}
      <div className="relative -mt-12 z-10 flex flex-col flex-1">
        {/* Layer 1 (Background Silhouette): Smooth Folder-Tab SVG with dual continuous curves + Solid White Body */}
        <div className="absolute inset-0 flex flex-col pointer-events-none select-none">
          <div className="w-full h-[52px] shrink-0">
            <svg
              viewBox="0 0 400 52"
              preserveAspectRatio="none"
              className="w-full h-full block fill-white"
              aria-hidden="true"
            >
              <path d="M 0 16 C 0 7, 7 0, 16 0 L 195 0 C 220 0, 240 34, 265 34 L 384 34 C 394 34, 400 40, 400 50 L 400 52 L 0 52 Z" />
              <path
                d="M 0 16 C 0 7, 7 0, 16 0 L 195 0 C 220 0, 240 34, 265 34 L 384 34 C 394 34, 400 40, 400 50"
                fill="none"
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth="1.2"
              />
            </svg>
          </div>
          <div className="w-full flex-1 bg-white -mt-px rounded-b-[24px]" />
        </div>

        {/* Layer 2 (Foreground Content): Positioned with natural harmony over the folder tab body */}
        <div className="relative z-10 px-5 pt-3 sm:pt-3.5 pb-5 flex flex-col justify-between flex-1 gap-3">
          {/* Header Typography Group: Event Type + Title + Description in Tight Harmony */}
          <div>
            {/* Raised Tab Left Side: Category / Event Type with breathing room from top line */}
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 block truncate max-w-[65%] sm:max-w-[70%]">
              {cleanEventType}
            </span>

            {/* Event Title */}
            <h3
              title={name}
              className="text-base sm:text-lg font-bold text-stone-900 tracking-tight line-clamp-1 transition-colors mt-2"
            >
              {name}
            </h3>

            {/* 2-line Description directly under Title (harmonious, no gap) */}
            {description && (
              <p className="text-xs sm:text-[13px] text-stone-600 line-clamp-2 leading-relaxed mt-1.5">
                {description}
              </p>
            )}
          </div>

          {/* Logistics & Footer Group */}
          <div className="flex flex-col gap-3">
            {/* Venue & Time details (Clean, no unnecessary pass IDs or tier clutter) */}
            <div className="flex items-center gap-1.5 text-xs text-stone-600 font-medium">
              {isOnline ? (
                <Video className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              )}
              <span className="truncate">{locationText}</span>
              {dateParts.time && (
                <>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-500 shrink-0">{dateParts.time}</span>
                </>
              )}
            </div>

            {/* Card Footer: Large Day + Small Month'Year (Left) & Pass Action / Cancel (Right) */}
            <div className="pt-2.5 flex items-center justify-between">
              {/* Full Date block */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-none">
                  {dateParts.day}
                </span>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider leading-none">
                  {dateParts.monthYear}
                </span>
              </div>

              {/* Action Buttons: View Pass, Attended, or Cancel */}
              <div className="flex items-center gap-2">
                {onCancel && !isCancelled && !isRejected && !isCompleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel();
                    }}
                    disabled={isCancelling}
                    className="text-xs font-medium text-stone-400 hover:text-rose-600 transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-rose-50/50 disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <span className="inline-flex items-center gap-1 text-rose-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Cancelling...
                      </span>
                    ) : (
                      'Cancel'
                    )}
                  </button>
                )}

                {status === 'CONFIRMED' && !isCompleted ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onViewPass) onViewPass();
                      else if (onClick) onClick();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>View Pass</span>
                  </button>
                ) : isCompleted && status === 'CONFIRMED' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
                    <span>{credentialStatus === 'CHECKED_IN' ? 'Attended' : 'Completed'}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onClick) onClick();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 hover:text-emerald-700 py-1 px-2.5 rounded-full hover:bg-stone-100 group/btn transition-all cursor-pointer"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-700 group-hover/btn:translate-x-0.5 group-hover/btn:text-emerald-700 transition-all" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationEventCard;
