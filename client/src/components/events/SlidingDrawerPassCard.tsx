import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Calendar,
  MapPin,
  Download,
  Loader2,
} from 'lucide-react';
import { AttendeeWalletItem } from '../../api/attendee';

export interface SlidingDrawerPassCardProps {
  pass: AttendeeWalletItem;
  onDownload: (pass: AttendeeWalletItem) => void;
  isDownloading?: boolean;
  onOpenTeamWorkspace?: (pass: AttendeeWalletItem) => void;
}

export const SlidingDrawerPassCard: React.FC<SlidingDrawerPassCardProps> = ({
  pass,
  onDownload,
  isDownloading,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startYRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);

  // Total card height is 400px.
  // Second div starts at top: 15% (60px), height: 340px (covers 85%).
  // When slid down to bottom, it stays at bottom covering ~13% (52px).
  // Slide distance = 340px - 52px = 288px.
  const SLIDE_DISTANCE = 288;

  // Generate QR Code data URL for this pass
  useEffect(() => {
    let active = true;
    const verifyUrl = `${window.location.origin}/verify/${pass.verificationToken}`;
    QRCode.toDataURL(verifyUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#18181b',
        light: '#ffffff',
      },
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

  // Pointer drag gestures for the drawer handle (Left button only, drag to pin down / pull up)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary/left mouse button
    setIsDragging(true);
    hasDraggedRef.current = false;
    startYRef.current = e.clientY;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
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
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (!isDragging) return;
    setIsDragging(false);
    if (hasDraggedRef.current) {
      if (isOpen) {
        // If dragged upwards past threshold, pin back to top (close)
        if (dragOffset < -40) {
          setIsOpen(false);
        }
      } else {
        // If dragged downwards past threshold, pin down at bottom (open)
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

  const venueLabel = pass.venue?.city || pass.venue?.name || 'Venue TBA';
  const cleanEventType = (pass.eventType || 'EVENT').replace('_', ' ');
  const description =
    (pass as any).description ||
    pass.usagePolicy ||
    'Official admission credential for this event gathering.';

  let currentTranslateY = isOpen ? SLIDE_DISTANCE : 0;
  if (isDragging) {
    currentTranslateY += dragOffset;
  }

  // First div elements are visible when open or while dragging down
  const showFirstDivElements = isOpen || (isDragging && dragOffset > 50);

  return (
    <div className="relative w-full max-w-[280px] sm:max-w-[330px] h-[350px] mx-auto rounded-[30px] bg-stone-100 border border-stone-200/90 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col select-none">
      {/* ─────────────────────────────────────────────────────────────
          FIRST DIV: Underneath Base Layer
          Contains:
          - Meaningful header text (text-center, no "Entry Pass" / "Pass-0002")
          - Large QR code
          - Full-width Download button with icon
          - Subtle dark overlay
          ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-stone-50/95 p-4 pt-3.5 flex flex-col items-center justify-start text-center z-0">
        {/* Subtle dark overlay when open */}
        <div
          className={`absolute inset-0 bg-stone-900/[0.04] pointer-events-none transition-opacity duration-300 ${
            showFirstDivElements ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Elements of 1st div: visible when drawer is slid down */}
        <div
          className={`w-full flex flex-col items-center justify-start h-[288px] transition-all duration-300 ${
            showFirstDivElements
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          {/* Meaningful text at top with text-center */}
          <p className="text-[11px] font-bold tracking-wider uppercase text-stone-500 text-center w-full pt-1">
            Scan at Turnstile for Entry
          </p>

          {/* Increased size QR Code Container */}
          <div className="p-2.5 bg-white rounded-2xl border border-stone-200/90 shadow-xs inline-flex items-center justify-center my-auto">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Attendee Pass QR"
                className="w-48 h-48 rounded-xl block"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center text-stone-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
          </div>

          {/* Full-width Download Button with Icon */}
          <div className="w-full pb-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(pass);
              }}
              disabled={isDownloading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
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
          - Covers 80-85% height initially (top: 15% = 60px)
          - Slides down when held and dragged with left mouse button
          - Stays pinned at bottom covering 10-15% (showing handle)
          - Contains:
            • Capsule handle (no "pull down" / "pull up" text)
            • Plain text "HACKATHON" (no capsule badge)
            • Title & Description
            • Date & Location structure side-by-side:
              {Icon}          {Icon}
              Date Here       Location Name
            • Full-width button that also downloads the pass
          ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          transform: `translate3d(0, ${currentTranslateY}px, 0)`,
          transition: isDragging ? 'none' : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute inset-x-0 top-[8%] bottom-0 rounded-t-[28px] bg-white border-t border-stone-200/90 shadow-xl z-20 flex flex-col justify-between overflow-hidden"
      >
        {/* Capsule Handle at Top of Second Div (Hold with left mouse button to slide down / up) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full pt-3 pb-2.5 flex items-center justify-center cursor-grab active:cursor-grabbing group/handle touch-none"
          title="Hold with left mouse button and slide down"
        >
          <div className="w-14 h-1.5 rounded-full bg-stone-300 group-hover/handle:bg-stone-400 active:bg-stone-500 transition-all pointer-events-none" />
        </div>

        {/* Content of Second Div */}
        <div className="px-5 py-2 flex flex-col justify-between flex-1 gap-2.5">
          {/* Plain Event Type Text (Capsule removed) */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              {cleanEventType}
            </span>
          </div>

          {/* Event Title and Description */}
          <div className="space-y-1">
            <h3
              title={pass.eventName}
              className="text-lg font-bold text-stone-900 tracking-tight line-clamp-1 leading-snug"
            >
              {pass.eventName}
            </h3>
            <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Date and Location next to each other:
              {Icon}          {Icon}
              Date Here       Location Name */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date Column */}
            <div className="flex flex-col items-start gap-1">
              <Calendar className="w-4 h-4 text-stone-500 shrink-0" />
              <span className="text-xs font-semibold text-stone-900 leading-tight">
                {formattedDate}
              </span>
            </div>

            {/* Location Column */}
            <div className="flex flex-col items-start gap-1">
              <MapPin className="w-4 h-4 text-stone-500 shrink-0" />
              <span
                className="text-xs font-semibold text-stone-900 truncate max-w-full leading-tight"
                title={venueLabel}
              >
                {venueLabel}
              </span>
            </div>
          </div>

          {/* Bottom Button (Downloads ticket as well) */}
          <div className="pt-1 pb-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(pass);
              }}
              disabled={isDownloading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-full shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloading ? 'Downloading...' : 'Download Ticket'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlidingDrawerPassCard;
