import React from "react";
import { RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  description?: string;
  errorCode?: string;
  statusText?: string;
  onRetry?: () => void;
  retryText?: string;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to Load Events",
  description = "A network or server interruption occurred. Please retry your request or check back shortly.",
  errorCode = "ERR_GATEWAY_TIMEOUT",
  statusText = "CONNECTION DISRUPTED",
  onRetry,
  retryText = "Retry Loading Events",
  secondaryActionText,
  onSecondaryAction,
  className = "",
}) => {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto relative group select-none py-0 ${className}`}
    >
      {/* ── Disrupted / Severed Ticket Visual with Skew & Drop Shadow ── */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] h-[142px] sm:h-[150px] flex items-center justify-center select-none py-0 z-10 mx-auto mb-7 sm:mb-8">
        {/* Floating Warning Particles */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <span className="w-1.5 h-1.5 bg-rose-200 border border-rose-300 rounded-xs rotate-45 translate-x-3 -translate-y-4 animate-pulse opacity-70" />
          <span className="w-1 h-2 bg-stone-300 rounded-2xs -rotate-12 -translate-x-2 translate-y-6 opacity-50" />
          <span className="w-2 h-1 bg-rose-100 border border-rose-200 rounded-xs rotate-12 translate-x-6 translate-y-3 opacity-60" />
        </div>

        {/* TORN ERROR TICKET SVG ENGINE */}
        <div className="relative flex items-center justify-center -space-x-1 sm:-space-x-2">
          {/* ── LEFT TICKET PIECE (Disrupted Body - Tilted Left) ── */}
          <div className="transform -rotate-[5deg] -translate-x-2 sm:-translate-x-3 translate-y-1 skew-y-[-2deg] group-hover:-rotate-[7deg] group-hover:-translate-x-4 transition-all duration-300 filter drop-shadow-[0_12px_18px_rgba(28,25,23,0.07)]">
            <svg
              width="200"
              height="124"
              viewBox="0 0 200 124"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible"
            >
              {/* Jagged Left Ticket Silhouette with subtle rose warning edge */}
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
                stroke="#F43F5E"
                strokeWidth="1.2"
                strokeOpacity="0.4"
              />

              {/* Distressed Header Strip */}
              <g transform="translate(14, 12)">
                <text
                  x="0"
                  y="6"
                  fill="#E11D48"
                  fontSize="7"
                  fontWeight="700"
                  letterSpacing="0.12em"
                  fontFamily="monospace"
                >
                  TICKETIFICATION // DIAGNOSTIC
                </text>
                <text
                  x="0"
                  y="20"
                  fill="#0F172A"
                  fontSize="10.5"
                  fontWeight="800"
                  letterSpacing="-0.02em"
                  fontFamily="sans-serif"
                >
                  {statusText}
                </text>
                <text
                  x="0"
                  y="30"
                  fill="#64748B"
                  fontSize="6.5"
                  fontWeight="600"
                  letterSpacing="0.08em"
                  fontFamily="monospace"
                >
                  {errorCode} • RETRY AVAILABLE
                </text>
              </g>

              {/* Barcode Strip with Interrupted Gap */}
              <g transform="translate(14, 60)">
                <rect x="0" y="0" width="3" height="24" fill="#0F172A" />
                <rect x="5" y="0" width="1.5" height="24" fill="#0F172A" />
                <rect x="8" y="0" width="4" height="24" fill="#0F172A" />
                <rect x="14" y="0" width="2" height="24" fill="#0F172A" />
                <rect x="18" y="0" width="1" height="24" fill="#0F172A" />
                <rect x="21" y="0" width="3.5" height="24" fill="#0F172A" />
                <rect x="26" y="0" width="1.5" height="24" fill="#0F172A" />
                <rect x="30" y="0" width="5" height="24" fill="#0F172A" />
                <rect x="37" y="0" width="2" height="24" fill="#0F172A" />
                <rect x="41" y="0" width="3" height="24" fill="#0F172A" />
                <rect x="46" y="0" width="1" height="24" fill="#0F172A" />
                <rect x="49" y="0" width="4" height="24" fill="#0F172A" />
                {/* Interrupted Barcode Gap with warning hash */}
                <rect x="55" y="0" width="2" height="24" fill="#E11D48" opacity="0.8" />
                <rect x="59" y="0" width="1.5" height="24" fill="#E11D48" opacity="0.8" />
                <rect x="63" y="0" width="3" height="24" fill="#0F172A" />
                <rect x="68" y="0" width="2" height="24" fill="#0F172A" />
                <rect x="72" y="0" width="4" height="24" fill="#0F172A" />
                <rect x="78" y="0" width="1.5" height="24" fill="#0F172A" />
                <rect x="82" y="0" width="3" height="24" fill="#0F172A" />
                <rect x="87" y="0" width="2" height="24" fill="#0F172A" />
                <rect x="91" y="0" width="5" height="24" fill="#0F172A" />
                <rect x="98" y="0" width="1.5" height="24" fill="#0F172A" />
                <rect x="102" y="0" width="3" height="24" fill="#0F172A" />
                <rect x="107" y="0" width="2" height="24" fill="#0F172A" />
                <rect x="111" y="0" width="4" height="24" fill="#0F172A" />

                {/* Stamped Badge */}
                <g transform="translate(120, 2)">
                  <rect
                    x="0"
                    y="0"
                    width="42"
                    height="18"
                    rx="3"
                    fill="#FFF1F2"
                    stroke="#FDA4AF"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="21"
                    y="12"
                    textAnchor="middle"
                    fill="#E11D48"
                    fontSize="7"
                    fontWeight="800"
                    fontFamily="monospace"
                  >
                    OFFLINE
                  </text>
                </g>
              </g>

              {/* Serial String */}
              <text
                x="14"
                y="106"
                fill="#94A3B8"
                fontSize="6.5"
                fontFamily="monospace"
                letterSpacing="0.08em"
              >
                STATUS: DISRUPTED // RETRY-SYNC
              </text>
            </svg>
          </div>

          {/* ── RIGHT TICKET STUB (Detached Piece - Tilted Right) ── */}
          <div className="transform rotate-[7deg] translate-x-2 sm:translate-x-3 -translate-y-1.5 skew-y-[3deg] group-hover:rotate-[9deg] group-hover:translate-x-4 transition-all duration-300 filter drop-shadow-[0_12px_18px_rgba(28,25,23,0.07)]">
            <svg
              width="120"
              height="124"
              viewBox="0 0 120 124"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible"
            >
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
                stroke="#F43F5E"
                strokeWidth="1.2"
                strokeOpacity="0.4"
              />

              {/* Right Disconnect Stub Content */}
              <g transform="translate(34, 18)">
                {/* Disconnected Box */}
                <rect
                  x="4"
                  y="2"
                  width="52"
                  height="52"
                  rx="8"
                  fill="#FFF1F2"
                  stroke="#FECDD3"
                  strokeWidth="1.5"
                />

                {/* Severed Connection / Alert Icon */}
                <circle cx="30" cy="24" r="12" fill="#FFE4E6" stroke="#FDA4AF" strokeWidth="1.5" />
                <path
                  d="M 30 18 L 30 25 M 30 29 L 30 31"
                  stroke="#E11D48"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Stub Disconnected Stamp */}
                <g transform="translate(2, 64) rotate(-3)">
                  <rect
                    x="0"
                    y="0"
                    width="56"
                    height="16"
                    rx="4"
                    fill="#FFF1F2"
                    stroke="#FDA4AF"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x="28"
                    y="11"
                    textAnchor="middle"
                    fill="#E11D48"
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="monospace"
                    letterSpacing="0.08em"
                  >
                    SEVERED
                  </text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Typography (Refined, perfectly balanced) ── */}
      <div className="space-y-2 z-10 relative mb-6 sm:mb-7">
        <h3 className="text-xl sm:text-2xl font-serif font-normal text-stone-900 tracking-tight">
          {title}
        </h3>
        <p className="text-[11px] sm:text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* ── Action Buttons ── */}
      {(onRetry || onSecondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 z-10 relative">
          {secondaryActionText && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 text-xs font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <span>{secondaryActionText}</span>
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-5 py-2.5 rounded-full bg-stone-900 hover:bg-black text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 border border-stone-800 active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{retryText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ErrorState;
