import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Calendar,
  MapPin,
  Download,
  Loader2,
  Maximize2,
  Users,
} from 'lucide-react';
import { AttendeeWalletItem } from '../../api/attendee';

export interface SlidingDrawerPassCardProps {
  pass: AttendeeWalletItem;
  onDownload: (pass: AttendeeWalletItem) => void;
  isDownloading?: boolean;
  onOpenTeamWorkspace?: (pass: AttendeeWalletItem) => void;
  onInspectPass?: (pass: AttendeeWalletItem) => void;
}

export const SlidingDrawerPassCard: React.FC<SlidingDrawerPassCardProps> = ({
  pass,
  onDownload,
  isDownloading,
  onOpenTeamWorkspace,
  onInspectPass,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);

  // Total card height is 370px.
  // Second div starts at top: 8%, height covers ~92%.
  // Slide distance = 285px.
  const SLIDE_DISTANCE = 285;

  // Generate high-contrast QR code data URL for this credential
  useEffect(() => {
    let active = true;
    const verifyUrl = `${window.location.origin}/verify/${pass.verificationToken}`;
    QRCode.toDataURL(verifyUrl, {
      width: 260,
      margin: 1,
      color: {
        dark: '#09090b', // Pure high-contrast dark
        light: '#ffffff', // Clean white background
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR data URL:', err);
      });
    return () => {
      active = false;
    };
  }, [pass.verificationToken]);

  // Pointer drag gestures for the drawer handle (Left button only)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    hasDraggedRef.current = false;
    startYRef.current = e.clientY;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startYRef.current;
    if (Math.abs(deltaY) > 5) {
      hasDraggedRef.current = true;
    }
    if (isOpen) {
      // Slid down: user drags upwards to close (negative delta)
      const newOffset = Math.max(-SLIDE_DISTANCE, Math.min(0, deltaY));
      setDragOffset(newOffset);
    } else {
      // Closed at top: user drags downwards to open (positive delta)
      const newOffset = Math.max(0, Math.min(SLIDE_DISTANCE, deltaY));
      setDragOffset(newOffset);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (!isDragging) return;
    setIsDragging(false);
    if (hasDraggedRef.current) {
      if (isOpen) {
        if (dragOffset < -40) {
          setIsOpen(false);
        }
      } else {
        if (dragOffset > 40) {
          setIsOpen(true);
        }
      }
    }
    setDragOffset(0);
  };

  const formattedDate = pass.schedule?.startAt
    ? new Date(pass.schedule.startAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date TBA';

  const dayOfWeek = pass.schedule?.startAt
    ? new Date(pass.schedule.startAt).toLocaleDateString('en-US', {
        weekday: 'short',
      }).toUpperCase()
    : 'PASS';

  const venueLabel = pass.venue?.city || pass.venue?.name || 'Venue TBA';
  const cleanEventType = (pass.categoryName || pass.eventType || 'EVENT').replace('_', ' ');
  const holderName = pass.holder?.name || 'Valued Guest';
  const teamName = pass.teamName || (pass as any).team?.name;

  let currentTranslateY = isOpen ? SLIDE_DISTANCE : 0;
  if (isDragging) {
    currentTranslateY += dragOffset;
  }

  // First div elements are visible when open or while dragging down
  const showFirstDivElements = isOpen || (isDragging && dragOffset > 50);

  return (
    <div className="relative w-full max-w-[290px] sm:max-w-[340px] h-[370px] mx-auto rounded-[32px] bg-stone-100 border border-stone-200/90 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col select-none print:hidden">
      {/* ─────────────────────────────────────────────────────────────
          FIRST DIV: Underneath Base Layer (Instant QR Access Stub)
          - Gate Turnstile Instruction
          - High-contrast pure black modules QR code with quiet zone
          - Quick action row (Full pass modal & download)
          ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-stone-50/95 p-4 pt-3 flex flex-col items-center justify-start text-center z-0">
        <div
          className={`absolute inset-0 bg-stone-900/[0.03] pointer-events-none transition-opacity duration-300 ${
            showFirstDivElements ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <div
          className={`w-full flex flex-col items-center justify-between h-[300px] transition-all duration-300 ${
            showFirstDivElements
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {/* Meaningful operational instruction */}
          <div className="pt-1">
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-stone-500 block">
              Scan at Gate for Entry
            </span>
            <span className="text-xs font-bold text-stone-900 block truncate max-w-[240px]">
              {holderName}
            </span>
          </div>

          {/* Sizable High-Contrast QR Code Container */}
          <div className="p-3 bg-white rounded-2xl border border-stone-200/90 shadow-xs inline-flex items-center justify-center my-auto">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Pass Entry QR"
                className="w-44 h-44 rounded-xl block select-none"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-stone-400">
                <Loader2 className="w-7 h-7 animate-spin text-stone-600" />
              </div>
            )}
          </div>

          {/* Action Row */}
          <div className="w-full flex items-center gap-2 pb-1">
            {onInspectPass && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspectPass(pass);
                }}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold rounded-full border border-stone-200/90 shadow-2xs transition-all active:scale-95 cursor-pointer"
                title="View Full Editorial Pass"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full Pass</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(pass);
              }}
              disabled={isDownloading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Downloading...' : 'Download Pass'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECOND DIV: Sliding Drawer on Top
          - Slides down smoothly when dragged
          - Top emerald ribbon & tactile drag handle
          - Event category, title, attendee name, team (if hackathon)
          - Side-by-side date & venue
          - Actions: Full Pass Inspection & Download
          ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          transform: `translate3d(0, ${currentTranslateY}px, 0)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute inset-x-0 top-[7%] bottom-0 rounded-t-[28px] bg-white border-t border-stone-200/90 shadow-xl z-20 flex flex-col justify-between overflow-hidden"
      >
        {/* Top Emerald Accent Strip */}
        <div className="h-1 w-full bg-emerald-500" />

        {/* Capsule Handle at Top of Drawer */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full pt-2.5 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing group/handle touch-none"
          title="Drag down to reveal gate QR code"
        >
          <div className="w-12 h-1.5 rounded-full bg-stone-300 group-hover/handle:bg-stone-400 active:bg-stone-500 transition-all pointer-events-none" />
        </div>

        {/* Content Body */}
        <div className="px-5 py-2 flex flex-col justify-between flex-1 gap-2.5">
          {/* Header Row: Category Badge & Ticketification Mark */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">
              {cleanEventType}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-400">
              TICKETIFICATION
            </span>
          </div>

          {/* Event Title */}
          <div className="space-y-0.5">
            <h3
              title={pass.eventName}
              onClick={() => onInspectPass?.(pass)}
              className="text-base sm:text-lg font-extrabold text-stone-900 tracking-tight line-clamp-1 leading-snug cursor-pointer hover:text-emerald-800 transition-colors"
            >
              {pass.eventName}
            </h3>
          </div>

          {/* Attendee & Optional Team Identity */}
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                Attendee
              </span>
              {teamName && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTeamWorkspace?.(pass);
                  }}
                  className="text-[9px] font-bold uppercase tracking-wider text-stone-500 hover:text-emerald-700 flex items-center gap-1 truncate max-w-[140px] cursor-pointer transition-colors"
                  title="Team Workspace"
                >
                  <Users className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                  {teamName}
                </button>
              )}
            </div>
            <span className="text-sm font-extrabold text-stone-900 truncate">
              {holderName}
            </span>
          </div>

          {/* Date & Location Columns */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-start gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold uppercase text-stone-400 leading-none">
                  {dayOfWeek}
                </span>
                <span className="font-semibold text-stone-900 truncate leading-tight mt-0.5">
                  {formattedDate}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold uppercase text-stone-400 leading-none">
                  Location
                </span>
                <span
                  className="font-semibold text-stone-900 truncate leading-tight mt-0.5"
                  title={venueLabel}
                >
                  {venueLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Actions: View Full Pass & Download */}
          <div className="pt-1 pb-1 flex items-center gap-2">
            {onInspectPass && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspectPass(pass);
                }}
                className="py-2.5 px-3 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-full border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5"
                title="View Full Pass"
              >
                <Maximize2 className="w-3.5 h-3.5 text-stone-600" />
                <span>View</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(pass);
              }}
              disabled={isDownloading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Downloading...' : 'Download Pass'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidingDrawerPassCard;
