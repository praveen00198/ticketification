import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Loader2, Download, Printer, Users } from 'lucide-react';

export interface DigitalEventPassProps {
  eventName: string;
  eventType?: string;
  categoryName?: string;
  schedule?: {
    startAt?: string | null;
    endAt?: string | null;
  };
  venue?: {
    name?: string | null;
    city?: string | null;
    address?: string | null;
    type?: string | null;
  };
  holderName: string;
  teamName?: string | null;
  organization?: string | null;
  verificationToken: string;
  qrDataUrl?: string | null;
  onDownload?: () => void;
  isDownloading?: boolean;
  className?: string;
  showLanyardSlot?: boolean;
  showActions?: boolean;
}

/**
 * Returns formatted date parts (Day of week, Month Day, Year, Time).
 */
function getEventDateMeta(dateStr?: string | null, timeStr?: string | null) {
  if (!dateStr) {
    return {
      dayOfWeek: 'EVENT PASS',
      formattedDate: 'Date TBA',
      formattedTime: null,
    };
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return {
      dayOfWeek: 'EVENT PASS',
      formattedDate: dateStr,
      formattedTime: timeStr || null,
    };
  }

  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const formattedDate = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = timeStr || d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return { dayOfWeek, formattedDate, formattedTime };
}

/**
 * Derives controlled accent styles per event category.
 */
function getCategoryDesignTokens(eventType?: string, categoryName?: string) {
  const norm = (categoryName || eventType || 'GENERAL').toUpperCase();

  if (norm.includes('HACKATHON') || norm.includes('CODE') || norm.includes('DEV')) {
    return {
      label: categoryName || 'HACKATHON',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      accentColor: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
    };
  }
  if (norm.includes('CONFERENCE') || norm.includes('SUMMIT') || norm.includes('KEYNOTE')) {
    return {
      label: categoryName || 'CONFERENCE',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-200/80',
      accentColor: 'text-slate-800',
      dotColor: 'bg-slate-600',
    };
  }
  if (norm.includes('FESTIVAL') || norm.includes('CONCERT') || norm.includes('MUSIC')) {
    return {
      label: categoryName || 'FESTIVAL',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200/80',
      accentColor: 'text-rose-700',
      dotColor: 'bg-rose-500',
    };
  }
  if (norm.includes('WORKSHOP') || norm.includes('BOOTCAMP') || norm.includes('MASTERCLASS')) {
    return {
      label: categoryName || 'WORKSHOP',
      badgeBg: 'bg-sky-50 text-sky-800 border-sky-200/80',
      accentColor: 'text-sky-700',
      dotColor: 'bg-sky-500',
    };
  }

  return {
    label: categoryName || (eventType ? eventType.replace('_', ' ') : 'EVENT PASS'),
    badgeBg: 'bg-stone-100 text-stone-800 border-stone-200/80',
    accentColor: 'text-stone-800',
    dotColor: 'bg-emerald-500',
  };
}

/**
 * Distinctive, premium, professionally art-directed digital event pass credential.
 *
 * Product Rules Enforced:
 * 1. NO Pass ID, Credential ID, Registration ID, or internal sequence numbers are displayed.
 * 2. NO Verification Status (ACTIVE, VERIFIED, etc.) is displayed on the static ticket.
 * 3. High-contrast QR code with pure black modules and proper quiet zone.
 * 4. CSS/SVG-based ticket silhouette with lanyard punch slot and side perforation cutouts.
 */
export const DigitalEventPass: React.FC<DigitalEventPassProps> = ({
  eventName,
  eventType,
  categoryName,
  schedule,
  venue,
  holderName,
  teamName,
  organization,
  verificationToken,
  qrDataUrl: initialQrDataUrl,
  onDownload,
  isDownloading,
  className = '',
  showLanyardSlot = true,
  showActions = false,
}) => {
  const [internalQrDataUrl, setInternalQrDataUrl] = useState<string | null>(initialQrDataUrl || null);
  const [qrLoading, setQrLoading] = useState<boolean>(!initialQrDataUrl);

  useEffect(() => {
    if (initialQrDataUrl) {
      setInternalQrDataUrl(initialQrDataUrl);
      setQrLoading(false);
      return;
    }

    if (!verificationToken) {
      setQrLoading(false);
      return;
    }

    let active = true;
    const verifyUrl = `${window.location.origin}/verify/${verificationToken.trim()}`;

    QRCode.toDataURL(verifyUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: '#09090b', // Pure high-contrast dark
        light: '#ffffff', // Clean white background
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (active) {
          setInternalQrDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate high-contrast QR code:', err);
        if (active) setQrLoading(false);
      });

    return () => {
      active = false;
    };
  }, [verificationToken, initialQrDataUrl]);

  const dateMeta = getEventDateMeta(schedule?.startAt, undefined);
  const venueLabel = venue?.city
    ? `${venue?.name ? `${venue.name}, ` : ''}${venue.city}`
    : venue?.name || (venue?.type === 'ONLINE' ? 'Virtual Gathering' : 'Venue TBA');

  const tokens = getCategoryDesignTokens(eventType, categoryName);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* ─────────────────────────────────────────────────────────────
          MAIN TICKET BODY (Art-directed Editorial Credential)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] bg-stone-50 rounded-[32px] border border-stone-200/90 shadow-md text-stone-900 select-none overflow-hidden print:shadow-none print:border-stone-400 print:bg-white">
        {/* Top Emerald Brand Accent Line */}
        <div className="h-1.5 w-full bg-emerald-500" />

        {/* Lanyard Punch Slot (Physical credential badge silhouette) */}
        {showLanyardSlot && (
          <div className="w-full pt-3.5 pb-1 flex justify-center">
            <div
              className="w-16 h-2 rounded-full bg-stone-200/90 border border-stone-300/40 shadow-inner"
              title="Lanyard Slot"
            />
          </div>
        )}

        {/* ── UPPER CREDENTIAL SECTION ── */}
        <div className="px-6 pt-3 pb-5 flex flex-col gap-4">
          {/* Header Row: Ticketification Branding & Category Badge */}
          <div className="flex items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${tokens.dotColor}`} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-stone-500">
                TICKETIFICATION
              </span>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${tokens.badgeBg}`}
            >
              {tokens.label}
            </span>
          </div>

          {/* Event Title (Hero typography) */}
          <div className="space-y-1">
            <h2
              title={eventName}
              className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight leading-snug line-clamp-2"
            >
              {eventName}
            </h2>
          </div>

          {/* Schedule & Location Grid (Clean editorial columns) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Date Column */}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                Date &amp; Time
              </span>
              <span className="text-xs font-bold text-stone-900 leading-tight">
                {dateMeta.dayOfWeek}
              </span>
              <span className="text-[11px] font-medium text-stone-600 leading-tight">
                {dateMeta.formattedDate}
              </span>
              {dateMeta.formattedTime && (
                <span className="text-[10px] font-mono text-stone-500 mt-0.5">
                  {dateMeta.formattedTime}
                </span>
              )}
            </div>

            {/* Venue Column */}
            <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">
                Location
              </span>
              <span
                className="text-xs font-bold text-stone-900 line-clamp-2 leading-tight"
                title={venueLabel}
              >
                {venueLabel}
              </span>
            </div>
          </div>

          {/* Optional Team / Cohort Section (Only displayed when data exists) */}
          {teamName && (
            <div className="pt-2 border-t border-stone-200/60">
              <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1 mb-0.5">
                <Users className="w-2.5 h-2.5 text-stone-400" /> Team Name
              </span>
              <span className="text-sm font-extrabold text-stone-900 tracking-tight uppercase block">
                {teamName}
              </span>
            </div>
          )}

          {/* Attendee Identity Section (Hero element) */}
          <div className="pt-2 border-t border-stone-200/60">
            <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400 block mb-0.5">
              Attendee
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight leading-tight">
              {holderName || 'Valued Guest'}
            </h3>
            {organization && organization !== teamName && (
              <span className="text-xs font-medium text-stone-500 block mt-0.5">
                {organization}
              </span>
            )}
          </div>
        </div>

        {/* ── PERFORATION DIVIDER WITH EDGE CUTOUT NOTCHES ── */}
        <div className="relative w-full flex items-center my-0">
          {/* Left Semicircle Cutout */}
          <div
            className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200/90 -ml-3.5 shrink-0 shadow-inner"
            aria-hidden="true"
          />
          {/* Refined Dashed Divider Line */}
          <div className="flex-1 border-b-2 border-dashed border-stone-300 mx-1" />
          {/* Right Semicircle Cutout */}
          <div
            className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200/90 -mr-3.5 shrink-0 shadow-inner"
            aria-hidden="true"
          />
        </div>

        {/* ── LOWER ADMISSION ZONE (High-Contrast QR Stub) ── */}
        <div className="p-6 pt-5 bg-stone-100/60 flex flex-col items-center justify-center text-center">
          {/* QR Code Container with 4-module clean quiet zone and corner alignment guides */}
          <div className="relative p-3.5 bg-white rounded-2xl border border-stone-200/90 shadow-sm inline-flex items-center justify-center">
            {qrLoading ? (
              <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center gap-2 text-stone-400">
                <Loader2 className="w-7 h-7 animate-spin text-stone-700" />
                <span className="text-[11px] font-medium text-stone-500">Generating Secure QR...</span>
              </div>
            ) : internalQrDataUrl ? (
              <img
                src={internalQrDataUrl}
                alt="Gate Admission QR Code"
                className="w-48 h-48 sm:w-52 sm:h-52 rounded-xl block select-none"
              />
            ) : (
              <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center text-stone-400 text-xs">
                QR Unavailable
              </div>
            )}
          </div>

          {/* Operational Gate Instruction */}
          <p className="text-[11px] font-semibold text-stone-600 max-w-[260px] leading-relaxed text-center mt-3">
            Present this QR code at the entry gate turnstile for admission.
          </p>

          {/* Footer Branding (No Pass ID, No Status) */}
          <div className="mt-4 pt-3 w-full border-t border-stone-200/70 flex items-center justify-center">
            <span className="text-[9px] font-medium tracking-wider uppercase text-stone-400">
              Powered by Ticketification • Official Event Pass
            </span>
          </div>
        </div>
      </div>

      {/* Optional Action Controls (Download / Print) */}
      {showActions && (
        <div className="w-full max-w-[340px] sm:max-w-[380px] mt-4 flex items-center gap-2.5 print:hidden">
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              disabled={isDownloading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-xs hover:shadow transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Downloading...' : 'Download Pass'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-full border border-stone-200 shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer"
            title="Print Pass"
          >
            <Printer className="w-3.5 h-3.5 text-stone-600" />
            <span>Print</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DigitalEventPass;
