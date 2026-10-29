import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useOutletContext, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Calendar,
  Clock,
  MapPin,
  Ticket,
  QrCode,
  Users,
  Compass,
  ArrowLeft,
  Download,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Send,
  Loader2,
  RefreshCw,
  Award,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { eventsApi } from '../api/events';
import { attendeeApi, AttendeeTeamData } from '../api/attendee';
import { ticketsApi, triggerBlobDownload } from '../api/tickets';
import { EventItem } from '../types';
import { ROUTES } from '../routes/paths';
import { canManageEventOperations } from '../utils/permissions';
import { AttendeeRaiseIssueModal } from '../components/events/AttendeeRaiseIssueModal';

type AttendeeTab = 'overview' | 'pass' | 'guide' | 'team';

export const AttendeeEventDashboardPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useOutletContext<{ user?: any }>();
  const user = context?.user;

  // Active Tab
  const activeTab = (searchParams.get('tab') as AttendeeTab) || 'overview';
  const setActiveTab = (tab: AttendeeTab) => {
    setSearchParams({ tab });
  };

  // State
  const [event, setEvent] = useState<EventItem | null>(null);
  const [registration, setRegistration] = useState<any | null>(null);
  const [credential, setCredential] = useState<any | null>(null);
  const [teamData, setTeamData] = useState<AttendeeTeamData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Teaming Actions State
  const [teamAction, setTeamAction] = useState<'VIEW' | 'CREATE' | 'JOIN'>('VIEW');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTrack, setNewTeamTrack] = useState('General');
  const [joinTeamQuery, setJoinTeamQuery] = useState('');
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamMsg, setTeamMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Project Submission State
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [submittingProject, setSubmittingProject] = useState(false);

  // Issue Reporting Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  // Fetch all attendee data for this event
  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch Event Details
      const eventDetails = await eventsApi.getEvent(eventId);
      setEvent(eventDetails);

      // 2. Fetch User Registration & Credential
      try {
        const regRes = await attendeeApi.getMyRegistration(eventId);
        if (regRes.success && regRes.data) {
          setRegistration(regRes.data.registration);
          setCredential(regRes.data.credential);

          // Generate QR data url if verification token exists
          const token = regRes.data.credential?.verificationToken;
          if (token) {
            const verifyUrl = `${window.location.origin}/verify/${token}`;
            const qrUri = await QRCode.toDataURL(verifyUrl, { width: 280, margin: 1 });
            setQrDataUrl(qrUri);
          }
        }
      } catch (regErr: any) {
        console.warn('[AttendeeEventDashboard] Could not fetch registration:', regErr.message);
      }

      // 3. Fetch Team if event has team / hackathon features
      try {
        const teamRes = await attendeeApi.getMyTeam(eventId);
        if (teamRes.success && teamRes.data) {
          setTeamData(teamRes.data);
          setProjectTitle(teamRes.data.projectTitle || '');
          setProjectDescription(teamRes.data.projectDescription || '');
          setRepoUrl(teamRes.data.repoUrl || '');
          setDemoUrl(teamRes.data.demoUrl || '');
        }
      } catch (_tErr) {
        // Normal if user is not in a team
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load event details.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Pass Download
  const handleDownloadPass = async () => {
    if (!credential) return;
    try {
      setDownloading(true);
      const credId = credential._id || credential.id || credential.credentialId || credential.formattedId;
      const formattedId = credential.formattedId || credential.credentialId || `pass-${eventId}`;
      const { blob, fileName } = await ticketsApi.downloadTicket(credId, eventId);
      triggerBlobDownload(blob, fileName || `${formattedId}.png`);
    } catch (err) {
      console.error('Failed to download pass:', err);
      if (credential?.asset?.publicUrl) {
        window.open(credential.asset.publicUrl, '_blank');
      }
    } finally {
      setDownloading(false);
    }
  };

  // Handle Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !newTeamName.trim()) return;
    try {
      setTeamSubmitting(true);
      setTeamMsg(null);
      const res = await attendeeApi.createTeam(eventId, {
        teamName: newTeamName.trim(),
        track: newTeamTrack.trim() || 'General',
      });
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamAction('VIEW');
        setTeamMsg({ type: 'success', text: `Team "${res.data.teamName}" created successfully!` });
      }
    } catch (err: any) {
      setTeamMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to create team.',
      });
    } finally {
      setTeamSubmitting(false);
    }
  };

  // Handle Join Team
  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !joinTeamQuery.trim()) return;
    try {
      setTeamSubmitting(true);
      setTeamMsg(null);
      const isId = /^[0-9a-fA-F]{24}$/.test(joinTeamQuery.trim());
      const payload = isId
        ? { teamId: joinTeamQuery.trim() }
        : { teamName: joinTeamQuery.trim() };

      const res = await attendeeApi.joinTeam(eventId, payload);
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamAction('VIEW');
        setTeamMsg({ type: 'success', text: `Joined team "${res.data.teamName}"!` });
      }
    } catch (err: any) {
      setTeamMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to join team.',
      });
    } finally {
      setTeamSubmitting(false);
    }
  };

  // Handle Project Submission
  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    try {
      setSubmittingProject(true);
      setTeamMsg(null);
      const res = await attendeeApi.submitProject(eventId, {
        projectTitle: projectTitle.trim(),
        projectDescription: projectDescription.trim(),
        repoUrl: repoUrl.trim(),
        demoUrl: demoUrl.trim(),
      });
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamMsg({ type: 'success', text: 'Project submitted successfully for evaluation!' });
      }
    } catch (err: any) {
      setTeamMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.message || 'Failed to submit project.',
      });
    } finally {
      setSubmittingProject(false);
    }
  };

  // Format Date and Countdown
  const startDate = event?.date ? new Date(event.date) : null;
  const isUpcoming = startDate && startDate.getTime() > Date.now();
  const daysUntil = startDate
    ? Math.max(0, Math.ceil((startDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const isHost = canManageEventOperations(user, event);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
        <p className="text-xs font-medium text-stone-500">Loading your attendee workspace...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-zinc-900">Event Workspace Unavailable</h2>
        <p className="text-xs text-stone-500 max-w-sm mx-auto">{error || 'Could not find this event.'}</p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={() => navigate(ROUTES.REGISTRATIONS)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to My Registrations
          </button>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-stone-200 text-stone-700 text-xs font-semibold rounded-xl hover:bg-stone-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-stone-500">
          <Link
            to={ROUTES.REGISTRATIONS}
            className="inline-flex items-center gap-1 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> My Registrations
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-semibold text-zinc-800 truncate max-w-xs">{event.name}</span>
          <span className="text-stone-300">/</span>
          <span className="text-stone-500 capitalize">Attendee Workspace</span>
        </div>

        <div className="flex items-center gap-2">
          {isHost && (
            <Link
              to={`/events/${eventId}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-semibold transition-colors shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Host Console
            </Link>
          )}

          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90 rounded-lg font-semibold transition-colors shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-stone-500" /> Raise an Issue
          </button>
        </div>
      </div>

      {/* Hero Banner Card */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden">
        {event.bannerUrl ? (
          <div className="h-44 sm:h-52 w-full overflow-hidden bg-stone-100 relative">
            <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6 text-white space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/90 text-white">
                {event.eventType || 'Event'}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{event.name}</h1>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-gradient-to-br from-stone-900 to-zinc-800 text-white space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/90 text-white">
                {event.eventType || 'Event'}
              </span>
              {isUpcoming && daysUntil !== null && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-xs">
                  Starts in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{event.name}</h1>
            <p className="text-xs text-stone-300 max-w-2xl line-clamp-2">
              {event.description || 'Welcome to your attendee workspace for this event.'}
            </p>
          </div>
        )}

        {/* Quick Metadata Strip */}
        <div className="px-6 py-3.5 bg-stone-50/60 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stone-400" />
              <span className="font-medium text-zinc-800">
                {startDate ? startDate.toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date TBA'}
              </span>
            </div>
            {event.time && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-stone-400" />
                <span>{event.time}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-stone-400" />
              <span className="truncate max-w-xs">{event.venue || 'Venue TBA'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {credential ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  credential.status === 'CHECKED_IN'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : credential.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {credential.status === 'CHECKED_IN'
                  ? 'Checked In'
                  : credential.status === 'ACTIVE'
                  ? 'Pass Active'
                  : credential.status}
              </span>
            ) : registration ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Registration Confirmed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Info className="w-3.5 h-3.5" />
                No Pass Found
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-stone-200/80 px-6 flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-stone-900 text-zinc-900'
                : 'border-transparent text-stone-500 hover:text-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Overview & Schedule
          </button>

          <button
            onClick={() => setActiveTab('pass')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'pass'
                ? 'border-stone-900 text-zinc-900'
                : 'border-transparent text-stone-500 hover:text-zinc-800'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            Entry Pass & QR
            {credential && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-stone-900 text-zinc-900'
                : 'border-transparent text-stone-500 hover:text-zinc-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Attendee Guide & Venue
          </button>

          <button
            onClick={() => setActiveTab('team')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'team'
                ? 'border-stone-900 text-zinc-900'
                : 'border-transparent text-stone-500 hover:text-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Team & Project
            {teamData && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-stone-100 text-stone-700">
                {teamData.teamName}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW & SCHEDULE ────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Description Card */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-zinc-900">About the Event</h2>
              <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                {event.description || 'No detailed description has been published for this event.'}
              </p>
            </div>

            {/* Event Timeline / Agenda */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-900">Event Schedule</h2>
                <span className="text-[11px] font-medium text-stone-500">Official Agenda</span>
              </div>

              <div className="space-y-3 border-l-2 border-stone-100 pl-4 ml-2">
                <div className="relative space-y-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-[21px] top-1" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Doors Open & Gate Check-in</span>
                    <span className="text-[10px] text-stone-400">
                      {event.time || 'Start of day'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Present your digital pass QR code at the turnstile scanners for rapid check-in.
                  </p>
                </div>

                <div className="relative space-y-1 pt-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 absolute -left-[21px] top-4" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Opening Keynote & Briefing</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Welcome address from the organizing team, guidelines, and main schedule breakdown.
                  </p>
                </div>

                <div className="relative space-y-1 pt-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 absolute -left-[21px] top-4" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Main Tracks & Sessions</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Track sessions, workshops, networking, or hackathon hacking periods.
                  </p>
                </div>

                <div className="relative space-y-1 pt-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 absolute -left-[21px] top-4" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">Closing & Wrap-up</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Final project reviews, closing ceremonies, and attendee credential archives.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Quick Pass Snapshot Card */}
            <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">Your Entry Pass</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {credential?.status || 'CONFIRMED'}
                </span>
              </div>

              {qrDataUrl ? (
                <div className="flex flex-col items-center py-2 space-y-3">
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl shadow-2xs">
                    <img src={qrDataUrl} alt="Entry QR" className="w-36 h-36 rounded-lg" />
                  </div>
                  <div className="text-center space-y-0.5">
                    <p className="font-mono text-xs font-bold text-zinc-900 tracking-wider">
                      {credential?.formattedId || 'TIC-ENTRY-PASS'}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Tier: {registration?.ticketTier || registration?.registrationType || 'Standard'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('pass')}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Full Entry Pass
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <Ticket className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs text-stone-500">Your pass details are linked to your wallet.</p>
                  <Link
                    to={ROUTES.WALLET}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 hover:underline"
                  >
                    Open Wallet <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* Organizer Support Card */}
            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-stone-600" />
                <h3 className="text-xs font-bold text-zinc-900">Need Help or Accessibility?</h3>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Have questions regarding badge pickup, dietary requirements, team registration, or accessibility accommodations?
              </p>
              <button
                onClick={() => setIsIssueModalOpen(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              >
                Raise an Issue with Organizers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ENTRY PASS & QR CREDENTIAL ────────────────────────────── */}
      {activeTab === 'pass' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white border border-stone-200/80 rounded-3xl p-8 shadow-sm space-y-6 text-center">
            {/* Header */}
            <div className="space-y-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700">
                Official Digital Credential
              </span>
              <h2 className="text-lg font-bold text-zinc-900 pt-1">{event.name}</h2>
              <p className="text-xs text-stone-500">
                Tier: <strong className="text-zinc-800">{registration?.ticketTier || registration?.registrationType || 'General Admission'}</strong>
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center py-4">
              {qrDataUrl ? (
                <div className="p-4 bg-white border-2 border-stone-200 rounded-2xl shadow-xs">
                  <img src={qrDataUrl} alt="Live Turnstile QR" className="w-56 h-56 rounded-lg" />
                </div>
              ) : (
                <div className="w-56 h-56 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col items-center justify-center text-stone-400 space-y-2">
                  <QrCode className="w-12 h-12" />
                  <span className="text-xs">Generating QR...</span>
                </div>
              )}

              <div className="pt-3 space-y-1">
                <p className="font-mono text-sm font-bold text-zinc-900 tracking-wider">
                  {credential?.formattedId || 'TIC-REGISTRATION-ACTIVE'}
                </p>
                <div className="flex items-center justify-center gap-1.5 text-xs">
                  {credential?.status === 'CHECKED_IN' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Checked In at Turnstile
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Valid & Ready for Gate Entry
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Attendee Holder Details */}
            <div className="grid grid-cols-2 gap-4 py-4 border-y border-stone-100 text-left text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400">Pass Holder</span>
                <p className="font-semibold text-zinc-900 truncate">
                  {credential?.holder?.name || registration?.attendeeDetails?.name || user?.name || 'Attendee'}
                </p>
                <p className="text-[11px] text-stone-500 truncate">
                  {credential?.holder?.email || registration?.attendeeDetails?.email || user?.email}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400">Venue & Access</span>
                <p className="font-semibold text-zinc-900 truncate">{event.venue || 'Main Venue'}</p>
                <p className="text-[11px] text-stone-500">
                  {startDate ? startDate.toLocaleDateString() : 'Date TBA'}
                </p>
              </div>
            </div>

            {/* Pass Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleDownloadPass}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Download Pass (PNG)
                  </>
                )}
              </button>

              <Link
                to={ROUTES.WALLET}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl text-xs font-semibold transition-colors"
              >
                View in Wallet <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: ATTENDEE GUIDE & VENUE ───────────────────────────────── */}
      {activeTab === 'guide' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Venue & Directions */}
          <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Venue & Location</h3>
                <p className="text-xs text-stone-500">Directions and Check-in Point</p>
              </div>
            </div>

            <div className="p-4 bg-stone-50 rounded-xl space-y-2 border border-stone-200/60">
              <p className="text-xs font-bold text-zinc-900">{event.venue || 'Venue Address TBA'}</p>
              <p className="text-xs text-stone-500">
                Check-in counters are located at the main entryway. Please arrive 15 minutes before the opening session.
              </p>
            </div>

            <div className="space-y-2 text-xs text-stone-600">
              <h4 className="font-semibold text-zinc-900">What to Bring</h4>
              <ul className="list-disc list-inside space-y-1 text-stone-500">
                <li>Your digital pass QR code (saved on phone or in Ticketification Wallet)</li>
                <li>Valid government-issued or institutional photo ID</li>
                <li>Laptop and chargers (for hackathons/workshops)</li>
              </ul>
            </div>
          </div>

          {/* Code of Conduct & Policies */}
          <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Event Guidelines</h3>
                <p className="text-xs text-stone-500">Attendee Code of Conduct</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-stone-600 leading-relaxed">
              <p>
                Ticketification events are dedicated to providing a harassment-free experience for everyone, regardless of gender, sexual orientation, disability, physical appearance, race, or religion.
              </p>
              <p>
                If you experience or witness any behavior that makes you feel unsafe, please reach out to the organizers immediately or use the &quot;Raise an Issue&quot; button at the top of this workspace.
              </p>
            </div>

            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800"
            >
              Report a Safety Concern or Inappropriate Behavior &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: TEAM & PROJECT MANAGEMENT ────────────────────────────── */}
      {activeTab === 'team' && (
        <div className="max-w-3xl mx-auto space-y-6">
          {teamMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                teamMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {teamMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{teamMsg.text}</span>
            </div>
          )}

          {teamData ? (
            /* User already has a team */
            <div className="space-y-6">
              {/* Team Info Header */}
              <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400">Track: {teamData.track || 'General'}</span>
                    <h2 className="text-base font-bold text-zinc-900">{teamData.teamName}</h2>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      teamData.status === 'SUBMITTED'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {teamData.status}
                  </span>
                </div>

                {/* Team Roster */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-900">Team Roster</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Leader */}
                    <div className="p-3 bg-stone-50 border border-stone-200/70 rounded-xl flex items-center justify-between">
                      <div className="space-y-0.5 truncate">
                        <p className="text-xs font-bold text-zinc-900 truncate">{teamData.leaderName}</p>
                        <p className="text-[11px] text-stone-500 truncate">{teamData.leaderEmail}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                        Leader
                      </span>
                    </div>

                    {/* Members */}
                    {teamData.members?.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-stone-50 border border-stone-200/70 rounded-xl flex items-center justify-between"
                      >
                        <div className="space-y-0.5 truncate">
                          <p className="text-xs font-bold text-zinc-900 truncate">{m.name}</p>
                          <p className="text-[11px] text-stone-500 truncate">{m.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-200/60 text-stone-700 shrink-0">
                          {m.role || 'Member'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project Submission Form */}
              <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-stone-700" />
                  <h3 className="text-sm font-bold text-zinc-900">Project Submission & Demo</h3>
                </div>
                <p className="text-xs text-stone-500">
                  Submit your project details, GitHub repository, and demo links before judging evaluation begins.
                </p>

                <form onSubmit={handleProjectSubmit} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Project Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Decentralized Credential Verifier"
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Project Description & Highlights
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Explain what you built, technologies used, and challenges overcome..."
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs text-zinc-900 focus:outline-none focus:border-stone-900 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        GitHub / Source Repository URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://github.com/..."
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Live Demo / Video Pitch URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://youtu.be/... or https://..."
                        value={demoUrl}
                        onChange={(e) => setDemoUrl(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingProject}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                    >
                      {submittingProject ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" /> Save & Submit Project
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* User does not have a team yet */
            <div className="bg-white border border-stone-200/80 rounded-2xl p-6 shadow-xs space-y-6">
              <div className="text-center space-y-2 py-4">
                <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">No Team Formed Yet</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  For competitions and hackathons, you can create a new team or join an existing teammate&apos;s team.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-3 border-b border-stone-100 pb-6">
                <button
                  type="button"
                  onClick={() => setTeamAction('CREATE')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                    teamAction === 'CREATE'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Create a Team
                </button>
                <button
                  type="button"
                  onClick={() => setTeamAction('JOIN')}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                    teamAction === 'JOIN'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  Join Existing Team
                </button>
              </div>

              {/* Create Team Form */}
              {teamAction === 'CREATE' && (
                <form onSubmit={handleCreateTeam} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Team Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CyberVanguards"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Track / Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Web3, AI, Fintech, HealthTech"
                      value={newTeamTrack}
                      onChange={(e) => setNewTeamTrack(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={teamSubmitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {teamSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm & Create Team'}
                  </button>
                </form>
              )}

              {/* Join Team Form */}
              {teamAction === 'JOIN' && (
                <form onSubmit={handleJoinTeam} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Team Name or Team ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter exact team name or 24-character ID"
                      value={joinTeamQuery}
                      onChange={(e) => setJoinTeamQuery(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={teamSubmitting}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {teamSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Join Team'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contextual Issue Reporting Modal */}
      <AttendeeRaiseIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        eventId={eventId || ''}
        eventName={event?.name || 'Event'}
        userEmail={user?.email || ''}
        userName={user?.name || ''}
        onSuccess={() => {
          // Keep modal feedback clean
        }}
      />
    </div>
  );
};

export default AttendeeEventDashboardPage;
