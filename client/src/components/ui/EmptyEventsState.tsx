import React from "react";

interface EmptyEventsStateProps {
  title?: string;
  description?: string;
  slotText?: string;
  categoryText?: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  secondaryActionIcon?: React.ReactNode;
  className?: string;
}

export const EmptyEventsState: React.FC<EmptyEventsStateProps> = ({
  title = "No Public Events Published Yet",
  description = "Organizers publish events frequently. Check back soon or create your own event now.",
  slotText = "UNCLAIMED SLOT",
  categoryText = "CATEGORY PASS • ZERO ADMISSION",
  actionText,
  onAction,
  actionIcon,
  secondaryActionText,
  onSecondaryAction,
  secondaryActionIcon,
  className = "",
}) => {
  // Constrain text font sizes to prevent overflow past the jagged ticket tear
  const slotFontSize =
    slotText.length > 20 ? 9.5 : slotText.length > 15 ? 10.5 : slotText.length > 12 ? 11.5 : 12.5;

  const categoryFontSize =
    categoryText.length > 26 ? 6.5 : categoryText.length > 18 ? 7 : 7.5;

  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto relative group select-none py-0 ${className}`}
    >
      {/* ── Realistic Torn / Ripped Ticket Visual with Skew & Perspective ── */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] h-[142px] sm:h-[150px] flex items-center justify-center select-none py-0 z-10 mx-auto mb-7 sm:mb-8">
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
                fill="#FFFFFF"
                stroke="#E7E5E4"
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
                <text
                  x="0"
                  y="8"
                  fill="#78716C"
                  fontSize="8"
                  fontWeight="700"
                  fontFamily="monospace"
                  letterSpacing="0.1em"
                >
                  TICKETIFICATION // PASS
                </text>

                {/* Title */}
                <text
                  x="0"
                  y="26"
                  fill="#1C1917"
                  fontSize={slotFontSize}
                  fontWeight="900"
                  fontFamily="sans-serif"
                  letterSpacing="-0.01em"
                  textLength={slotText.length > 13 ? "140" : undefined}
                  lengthAdjust={slotText.length > 13 ? "spacingAndGlyphs" : undefined}
                >
                  {slotText}
                </text>

                {/* Event Type / Subtitle */}
                <text
                  x="0"
                  y="40"
                  fill="#A8A29E"
                  fontSize={categoryFontSize}
                  fontWeight="600"
                  fontFamily="sans-serif"
                  textLength={categoryText.length > 20 ? "140" : undefined}
                  lengthAdjust={categoryText.length > 20 ? "spacingAndGlyphs" : undefined}
                >
                  {categoryText}
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
                <text
                  x="0"
                  y="82"
                  fill="#A8A29E"
                  fontSize="7.5"
                  fontWeight="600"
                  fontFamily="monospace"
                  letterSpacing="0.12em"
                >
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
                fill="#FFFFFF"
                stroke="#E7E5E4"
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
                <rect
                  x="4"
                  y="2"
                  width="52"
                  height="52"
                  rx="8"
                  fill="#FAFAF9"
                  stroke="#E7E5E4"
                  strokeWidth="1.5"
                />

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
                  <rect
                    x="0"
                    y="0"
                    width="56"
                    height="16"
                    rx="4"
                    fill="#F5F5F4"
                    stroke="#A8A29E"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="28"
                    y="11"
                    textAnchor="middle"
                    fill="#78716C"
                    fontSize="8"
                    fontWeight="800"
                    fontFamily="monospace"
                    letterSpacing="0.1em"
                  >
                    DETACHED
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-2 z-10 relative mb-6 sm:mb-7">
        <h3 className="text-xl sm:text-2xl font-serif font-normal text-stone-900 tracking-tight">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* Actions */}
      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3 z-10 relative">
          {secondaryActionText && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {secondaryActionIcon}
              <span>{secondaryActionText}</span>
            </button>
          )}
          {actionText && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="px-5 py-2.5 rounded-full bg-stone-900 hover:bg-black text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 border border-stone-800 active:scale-95 cursor-pointer"
            >
              {actionIcon}
              <span>{actionText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default EmptyEventsState;
