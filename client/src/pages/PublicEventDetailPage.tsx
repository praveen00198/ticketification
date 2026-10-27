import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Ticket,
  ShieldCheck,
  ShieldAlert,
  Building,
  Globe,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { publicApi, PublicEventDetailResponse } from '../api/public';
import { attendeeApi } from '../api/attendee';
import { getStoredAuthToken } from '../api/client';
import { EventRegistrationModal } from '../components/events/EventRegistrationModal';
import { ReportEventModal } from '../components/events/ReportEventModal';

export const PublicEventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PublicEventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myRegistration, setMyRegistration] = useState<{
    registration: any;
    credential: any;
  } | null>(null);

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  const loadEvent = async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await publicApi.getPublicEventById(eventId);
      setData(res);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || 'The requested event is not available or is not open for public viewing.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadMyRegistration = async () => {
    if (!eventId || !getStoredAuthToken()) {
      setMyRegistration(null);
      return;
    }
    try {
      const res = await attendeeApi.getMyRegistration(eventId);
      if (res?.success && res.data?.registration && res.data.registration.status !== 'CANCELLED') {
        setMyRegistration(res.data);
      } else {
        setMyRegistration(null);
      }
    } catch {
      setMyRegistration(null);
    }
  };

  useEffect(() => {
    loadEvent();
    loadMyRegistration();
  }, [eventId]);

  // Update countdown
  useEffect(() => {
    if (!data?.event?.schedule?.startAt) return;

    const targetDate = new Date(data.event.schedule.startAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds, isPast: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [data?.event?.schedule?.startAt]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-stone-500 tracking-wider uppercase">Loading Event Details</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-white border border-stone-200 rounded-2xl p-8 space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-stone-900">Event Unavailable</h2>
            <p className="text-xs text-stone-600 leading-relaxed">{error || 'Event could not be found.'}</p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-black text-white font-semibold text-xs transition-colors shadow-xs border border-stone-800"
          >
            Explore Other Events
          </button>
        </div>
      </div>
    );
  }

  const { event, host, metrics } = data;
  const startDate = new Date(event.schedule?.startAt);
  const endDate = new Date(event.schedule?.endAt);

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] font-sans py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/explore')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors bg-white px-3.5 py-1.5 rounded-full border border-stone-200 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Catalog
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-700 transition-colors shadow-sm"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-stone-500" />}
              {copied ? 'Link Copied' : 'Share Event'}
            </button>
          </div>
        </div>

        {/* Hero Banner Card */}
        <div className="relative rounded-2xl bg-white border border-stone-200/90 overflow-hidden shadow-sm">
          <div className="relative h-64 sm:h-80 w-full bg-stone-100">
            {event.bannerUrl ? (
              <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300">
                <Sparkles className="w-16 h-16 text-stone-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* Badges on Banner */}
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-white/95 backdrop-blur-md text-stone-800 text-xs font-bold uppercase tracking-wider shadow-sm border border-stone-200/50">
                {event.eventType.replace('_', ' ')}
              </span>
              {event.verificationStatus === 'VERIFIED' && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Verified Event
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight leading-tight">
                  {event.name}
                </h1>
                <p className="text-xs text-stone-500 mt-1">
                  Organized by <strong className="text-stone-800">{host.organizationName}</strong>
                </p>
              </div>

              {/* Status Pill */}
              <div className="shrink-0">
                {event.status === 'CANCELLED' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Event Cancelled
                  </span>
                ) : event.status === 'COMPLETED' || timeLeft.isPast ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">
                    Event Concluded
                  </span>
                ) : event.status === 'REGISTRATION_CLOSED' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Registration Closed
                  </span>
                ) : event.status === 'EVENT_LIVE' ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Event Live
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Upcoming Event
                  </span>
                )}
              </div>
            </div>

            {event.status === 'CANCELLED' && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Notice:</strong> This event has been cancelled by the host. Registrations and access are currently unavailable.
                </span>
              </div>
            )}

            {/* Live Countdown Clock */}
            {!timeLeft.isPast && event.status !== 'CANCELLED' && event.status !== 'COMPLETED' && (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 max-w-xl">
                <div className="text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-600" />
                  Event Commences In
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-sm">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">{timeLeft.days}</div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Days</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-sm">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">{timeLeft.hours}</div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Hours</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-sm">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">{timeLeft.minutes}</div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Mins</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-sm">
                    <div className="text-xl sm:text-2xl font-black text-stone-900 font-mono">{timeLeft.seconds}</div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Secs</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 space-y-3 shadow-sm">
              <h2 className="text-base font-bold text-stone-900">About the Event</h2>
              <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                {event.description || 'No detailed overview provided for this event.'}
              </div>
            </div>

            {/* Schedule & Venue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Schedule Card */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="p-2 w-fit rounded-lg bg-stone-100 text-stone-700">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">Date & Schedule</h3>
                <div className="text-xs text-stone-600 space-y-1">
                  <p className="text-stone-900 font-semibold">
                    {startDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <p>
                    {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({event.schedule?.timezone})
                  </p>
                </div>
              </div>

              {/* Venue Card */}
              <div className="bg-white border border-stone-200/90 rounded-2xl p-5 space-y-3 shadow-sm">
                <div className="p-2 w-fit rounded-lg bg-stone-100 text-stone-700">
                  {event.venue?.type === 'ONLINE' ? <Video className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  {event.venue?.type === 'ONLINE' ? 'Virtual Attendance' : 'Event Location'}
                </h3>
                <div className="text-xs text-stone-600 space-y-1">
                  {event.venue?.type === 'ONLINE' ? (
                    <p className="text-stone-700">
                      {event.venue?.onlineDescription || 'Access link will be unlocked on your issued pass.'}
                    </p>
                  ) : (
                    <>
                      <p className="text-stone-900 font-semibold">{event.venue?.name || 'In-Person Venue'}</p>
                      <p>{event.venue?.address}</p>
                      <p>
                        {event.venue?.city ? `${event.venue.city}, ` : ''}
                        {event.venue?.country}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Host Trust Profile */}
            <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center shrink-0">
                  {host.logoUrl ? (
                    <img src={host.logoUrl} alt={host.organizationName} className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-5 h-5 text-stone-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900">{host.organizationName}</h3>
                    {host.hostVerificationStatus === 'HIGH' && (
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 text-[10px] font-semibold border border-stone-200">
                        Institutional Host
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{host.institutionType.replace('_', ' ')}</p>
                </div>
              </div>

              {host.bio && <p className="text-xs text-stone-600 leading-relaxed">{host.bio}</p>}

              {host.website && (
                <a
                  href={host.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-stone-900 hover:text-black font-semibold underline transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Visit Official Website
                </a>
              )}
            </div>
          </div>

          {/* Registration Sidebar */}
          <div className="space-y-6">
            <div className="sticky top-6 bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
              <div>
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider block mb-1">
                  Registration Pass
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-stone-900">
                    {event.registration?.pricingModel === 'PAID' ? 'Paid Admission' : 'Free Pass'}
                  </span>
                </div>
              </div>

              {/* Live Capacity Meter */}
              {metrics.remainingCapacity !== null && (
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500">Available Capacity</span>
                    <span className="font-semibold text-stone-900">
                      {metrics.remainingCapacity} spots remaining
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full bg-stone-900 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (metrics.confirmedCount / (event.registration?.capacity || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Claim Pass CTA or Registered State */}
              {myRegistration ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 text-xs text-emerald-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      You Are Registered
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Pass ID: <span className="font-mono font-semibold">{myRegistration.credential?.formattedId || 'CONFIRMED'}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/wallet')}
                    className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xs border border-emerald-800"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    View Your Pass in Wallet
                  </button>
                </div>
              ) : (
                <button
                  disabled={
                    event.status === 'CANCELLED' ||
                    event.status === 'REGISTRATION_CLOSED' ||
                    event.status === 'COMPLETED' ||
                    timeLeft.isPast ||
                    metrics.isSoldOut
                  }
                  onClick={() => setIsRegisterOpen(true)}
                  className="w-full py-3.5 rounded-xl bg-stone-900 hover:bg-black disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-xs border border-stone-800"
                >
                  <Ticket className="w-4 h-4" />
                  {event.status === 'CANCELLED'
                    ? 'Event Cancelled'
                    : event.status === 'REGISTRATION_CLOSED'
                    ? 'Registration Closed'
                    : event.status === 'COMPLETED' || timeLeft.isPast
                    ? 'Event Concluded'
                    : metrics.isSoldOut
                    ? 'Event Sold Out'
                    : `Claim Your ${event.credentialTerminology || 'Pass'}`}
                </button>
              )}

              <div className="space-y-2 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                  <span>Instant verifiable pass issuance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                  <span>Dynamic tamper-proof QR code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-stone-700 shrink-0" />
                  <span>Stored automatically in your pass wallet</span>
                </div>
              </div>

              {/* Trust & Safety Report Trigger */}
              <div className="pt-3 border-t border-stone-100 text-center">
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-rose-600 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Report misleading details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <EventRegistrationModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          eventId={event.id}
          eventName={event.name}
          eventType={event.eventType}
          credentialTerminology={event.credentialTerminology}
          onSuccess={() => {
            loadEvent();
            loadMyRegistration();
          }}
        />

        <ReportEventModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          eventId={event.id}
          eventName={event.name}
        />
      </div>
    </div>
  );
};

export default PublicEventDetailPage;
