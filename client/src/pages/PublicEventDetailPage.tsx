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
import { EventRegistrationModal } from '../components/events/EventRegistrationModal';
import { ReportEventModal } from '../components/events/ReportEventModal';

export const PublicEventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<PublicEventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadEvent();
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
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-[#111622] border border-gray-800 rounded-3xl p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Event Unavailable</h2>
          <p className="text-sm text-gray-400">{error || 'Event could not be found.'}</p>
          <button
            onClick={() => navigate('/explore')}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#090d16] font-semibold text-xs transition-colors"
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
    <div className="min-h-screen bg-[#090d16] text-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/explore')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Public Directory
          </button>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111622] hover:bg-gray-800 border border-gray-800 text-xs font-medium text-gray-300 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied ? 'Link Copied' : 'Share Event'}
          </button>
        </div>

        {/* Hero Banner Card */}
        <div className="relative rounded-3xl bg-[#111622] border border-gray-800 overflow-hidden shadow-2xl">
          <div className="relative h-64 sm:h-80 w-full bg-gradient-to-r from-gray-950 via-[#101826] to-gray-950">
            {event.bannerUrl ? (
              <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#121b2d] to-[#070b13]">
                <Sparkles className="w-16 h-16 text-emerald-500/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#111622] via-[#111622]/60 to-transparent" />

            {/* Badges on Banner */}
            <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                {event.eventType.replace('_', ' ')}
              </span>
              {event.verificationStatus === 'VERIFIED' && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-500 text-[#090d16] text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  Verified Event
                </span>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10 -mt-20 relative z-10 space-y-4">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {event.name}
            </h1>

            {/* Live Countdown Clock */}
            {!timeLeft.isPast && (
              <div className="p-4 rounded-2xl bg-[#090d16]/90 border border-emerald-500/20 backdrop-blur-md max-w-xl">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Event Commences In
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-[#111622] p-2 rounded-xl border border-gray-800">
                    <div className="text-xl sm:text-2xl font-black text-white">{timeLeft.days}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Days</div>
                  </div>
                  <div className="bg-[#111622] p-2 rounded-xl border border-gray-800">
                    <div className="text-xl sm:text-2xl font-black text-white">{timeLeft.hours}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Hours</div>
                  </div>
                  <div className="bg-[#111622] p-2 rounded-xl border border-gray-800">
                    <div className="text-xl sm:text-2xl font-black text-white">{timeLeft.minutes}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Mins</div>
                  </div>
                  <div className="bg-[#111622] p-2 rounded-xl border border-gray-800">
                    <div className="text-xl sm:text-2xl font-black text-white">{timeLeft.seconds}</div>
                    <div className="text-[10px] text-gray-500 uppercase">Secs</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="bg-[#111622] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <h2 className="text-lg font-bold text-white">About the Event</h2>
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {event.description || 'No detailed overview provided for this event.'}
              </div>
            </div>

            {/* Schedule & Venue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Schedule Card */}
              <div className="bg-[#111622] border border-gray-800 rounded-2xl p-6 space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Date & Schedule</h3>
                <div className="text-xs text-gray-400 space-y-1">
                  <p className="text-gray-200 font-medium">
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
              <div className="bg-[#111622] border border-gray-800 rounded-2xl p-6 space-y-3">
                <div className="p-2.5 w-fit rounded-xl bg-cyan-500/10 text-cyan-400">
                  {event.venue?.type === 'ONLINE' ? <Video className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <h3 className="text-sm font-bold text-white">
                  {event.venue?.type === 'ONLINE' ? 'Virtual Attendance' : 'Event Location'}
                </h3>
                <div className="text-xs text-gray-400 space-y-1">
                  {event.venue?.type === 'ONLINE' ? (
                    <p className="text-gray-200">
                      {event.venue?.onlineDescription || 'Access link will be unlocked on your issued pass.'}
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-200 font-medium">{event.venue?.name || 'In-Person Venue'}</p>
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
            <div className="bg-[#111622] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                  {host.logoUrl ? (
                    <img src={host.logoUrl} alt={host.organizationName} className="w-full h-full object-cover" />
                  ) : (
                    <Building className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{host.organizationName}</h3>
                    {host.hostVerificationStatus === 'HIGH' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Institutional Host
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{host.institutionType.replace('_', ' ')}</p>
                </div>
              </div>

              {host.bio && <p className="text-xs text-gray-300 leading-relaxed">{host.bio}</p>}

              {host.website && (
                <a
                  href={host.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Visit Official Website
                </a>
              )}
            </div>
          </div>

          {/* Registration Sidebar */}
          <div className="space-y-6">
            <div className="sticky top-6 bg-[#111622] border border-gray-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  Registration Pass
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">
                    {event.registration?.pricingModel === 'PAID' ? 'Paid Entry' : 'Free Pass'}
                  </span>
                </div>
              </div>

              {/* Live Capacity Meter */}
              {metrics.remainingCapacity !== null && (
                <div className="space-y-2 pt-2 border-t border-gray-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Available Capacity</span>
                    <span className="font-bold text-emerald-400">
                      {metrics.remainingCapacity} spots remaining
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
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

              {/* Claim Pass CTA */}
              <button
                disabled={metrics.isSoldOut}
                onClick={() => setIsRegisterOpen(true)}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-500 text-[#090d16] font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
              >
                <Ticket className="w-5 h-5" />
                {metrics.isSoldOut ? 'Event Sold Out' : `Claim Your ${event.credentialTerminology || 'Pass'}`}
              </button>

              <div className="space-y-2 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Instant verifiable smart pass issuance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dynamic tamper-proof day-of-event QR code</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Stored automatically in your personal wallet</span>
                </div>
              </div>

              {/* Trust & Safety Report Trigger */}
              <div className="pt-4 border-t border-gray-800 text-center">
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-400 transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Report misleading details or scam
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
          onSuccess={() => loadEvent()}
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
