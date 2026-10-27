import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Users,
  Trophy,
  QrCode,
  ShieldCheck,
  Zap,
  HardDrive,
  Calendar,
  MapPin,
  RefreshCw,
  Sparkles,
  Layers,
  Music,
  Code,
  BookOpen,
  ArrowLeft,
  ExternalLink,
  Settings,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { EventItem, TicketType } from '../../types';
import { eventsApi, EventDashboardSummary, EventTypeFeatures } from '../../api/events';
import { formatVenueLabel } from '../../utils/venue';
import { EventVerificationCard } from './EventVerificationCard';
import { EventLifecycleBar } from './EventLifecycleBar';
import { EventStaffCard } from './EventStaffCard';
import { EventTaskManagerCard } from './EventTaskManagerCard';
import { EventAssignmentCard } from './EventAssignmentCard';
import { EventTeamManagerCard } from './EventTeamManagerCard';
import { EventEvaluationCard } from './EventEvaluationCard';
import { EventCredentialManagerCard } from './EventCredentialManagerCard';
import { EventCredentialTemplateCard } from './EventCredentialTemplateCard';
import { EventCheckinScannerCard } from './EventCheckinScannerCard';
import { EventAuditLogCard } from './EventAuditLogCard';
import { EventRegistrationModal } from './EventRegistrationModal';

export type HostConsoleTab =
  | 'overview'
  | 'configuration'
  | 'verification'
  | 'attendees'
  | 'operations'
  | 'team';

export const getPluralCredentialTerm = (term?: string) => {
  if (!term) return 'Passes';
  if (term.endsWith('Pass')) return `${term}es`;
  if (term.endsWith('s')) return `${term}es`;
  return `${term}s`;
};

interface ContextAwareHostConsoleProps {
  event: EventItem;
  ticketTypes: TicketType[];
  onRefreshEvent: () => Promise<void>;
  formData: any;
  setFormData: (data: any) => void;
  onUpdateEvent: (e: React.FormEvent) => Promise<void>;
  saving: boolean;
  saveSuccess: boolean;
  onOpenAddTicketType: () => void;
}

export const ContextAwareHostConsole: React.FC<ContextAwareHostConsoleProps> = ({
  event,
  ticketTypes,
  onRefreshEvent,
  formData,
  setFormData,
  onUpdateEvent,
  saving,
  saveSuccess,
  onOpenAddTicketType,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getValidTab = (rawTab: string | null): HostConsoleTab => {
    if (!rawTab) return 'overview';
    const lower = rawTab.toLowerCase();
    if (lower === 'overview') return 'overview';
    if (lower === 'configuration' || lower === 'details' || lower === 'settings') return 'configuration';
    if (lower === 'verification' || lower === 'verify' || lower === 'org') return 'verification';
    if (lower === 'attendees' || lower === 'credentials' || lower === 'passes' || lower === 'tickets') return 'attendees';
    if (lower === 'operations' || lower === 'gate' || lower === 'scan' || lower === 'turnstiles') return 'operations';
    if (lower === 'team' || lower === 'staff' || lower === 'competition' || lower === 'audit') return 'team';
    return 'overview';
  };

  const initialTab = getValidTab(searchParams.get('tab') || window.location.hash.replace('#', ''));
  const [activeTab, setActiveTabState] = useState<HostConsoleTab>(initialTab);

  const setActiveTab = (tab: HostConsoleTab) => {
    setActiveTabState(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    const currentParam = searchParams.get('tab') || window.location.hash.replace('#', '');
    const valid = getValidTab(currentParam);
    if (valid !== activeTab) {
      setActiveTabState(valid);
    }
  }, [searchParams]);

  const [summary, setSummary] = useState<EventDashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  const eventId = event.id;
  const eventType = (event.eventType || 'OTHER').toUpperCase();
  const isIndividual = event.hostingType === 'INDIVIDUAL' || event.organizationVerificationStatus === 'NOT_REQUIRED';

  const fetchSummary = async () => {
    if (!eventId) return;
    try {
      setLoadingSummary(true);
      const data = await eventsApi.getEventDashboardSummary(eventId);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [eventId]);

  // Dynamic feature capabilities
  const features: EventTypeFeatures = summary?.event.features || {
    hasCompetition: ['HACKATHON', 'COMPETITION', 'COLLEGE_FEST'].includes(eventType),
    hasMentors: ['HACKATHON', 'COMPETITION'].includes(eventType),
    hasRubrics: ['HACKATHON', 'COMPETITION', 'COLLEGE_FEST'].includes(eventType),
    hasSessions: ['CONFERENCE', 'SUMMIT', 'SEMINAR'].includes(eventType),
    hasHighThroughputTurnstile: ['CONCERT', 'FESTIVAL', 'COLLEGE_FEST', 'SPORTS'].includes(eventType),
    credentialTerm:
      eventType === 'CONCERT' || eventType === 'FESTIVAL'
        ? 'Ticket'
        : eventType === 'CONFERENCE'
        ? 'Badge'
        : eventType === 'HACKATHON'
        ? 'Hacker Pass'
        : 'Pass',
  };

  const pluralCredentialTerm = getPluralCredentialTerm(features.credentialTerm);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'HACKATHON':
      case 'COMPETITION':
        return <Code className="w-3.5 h-3.5 text-emerald-600" />;
      case 'CONCERT':
      case 'FESTIVAL':
        return <Music className="w-3.5 h-3.5 text-indigo-600" />;
      case 'WORKSHOP':
      case 'BOOTCAMP':
        return <BookOpen className="w-3.5 h-3.5 text-amber-600" />;
      case 'CONFERENCE':
      case 'SUMMIT':
        return <Layers className="w-3.5 h-3.5 text-sky-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── Unified Command Header ── */}
      <div className="bg-white border border-surface-border rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <button
                onClick={() => navigate('/events')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-stone-100 hover:bg-stone-200/80 transition-colors cursor-pointer"
                title="Back to All Events"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Events</span>
              </button>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                {getTypeIcon(eventType)}
                <span>{eventType.replace(/_/g, ' ')} OPERATING CONSOLE</span>
              </span>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  event.status === 'EVENT_LIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
                    : event.status === 'PUBLISHED' || event.status === 'REGISTRATION_OPEN'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : event.status === 'COMPLETED'
                    ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                ● {event.status || 'DRAFT'}
              </span>

              <span className="text-[11px] text-zinc-600 font-medium px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                {isIndividual ? 'Individual Host' : 'Institutional Host'}
              </span>

              <span className="text-[11px] text-zinc-600 font-medium px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                Credential: {features.credentialTerm}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
              {event.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>{event.date}</span>
                {event.time && <span className="text-zinc-400">at {event.time}</span>}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{formatVenueLabel(event.venue)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => navigate(`/events/${eventId}/public`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 text-zinc-800 text-xs font-semibold rounded-xl border border-stone-300 transition-colors shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
              <span>Public Page</span>
            </button>

            <button
              onClick={() => navigate('/scan')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scanner</span>
            </button>

            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-2xs"
            >
              <Ticket className="w-3.5 h-3.5 text-stone-200" />
              <span>Issue {features.credentialTerm}</span>
            </button>

            <button
              onClick={() => {
                fetchSummary();
                onRefreshEvent();
              }}
              disabled={loadingSummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold rounded-xl border border-stone-200 transition-colors shadow-2xs disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${loadingSummary ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-surface-border">
          <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Issued {pluralCredentialTerm}</span>
              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-zinc-900">{summary?.credentials.total ?? 0}</span>
              <span className="text-[10px] text-emerald-700 font-semibold">
                {summary?.credentials.checkInRatePercent ?? 0}% checked in
              </span>
            </div>
          </div>

          <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Scan Velocity</span>
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-zinc-900">
                {summary?.checkins.velocityLast15Mins ?? 0}
              </span>
              <span className="text-[10px] text-zinc-500">scans / 15m</span>
            </div>
          </div>

          <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Staff On-Duty</span>
              <Users className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-zinc-900">{summary?.staff.total ?? 0}</span>
              <span className="text-[10px] text-zinc-500">
                {summary?.staff.volunteers ?? 0} volunteers
              </span>
            </div>
          </div>

          {features.hasCompetition ? (
            <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Team Cohorts</span>
                <Trophy className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-zinc-900">
                  {summary?.teams?.totalTeams ?? 0}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {summary?.teams?.totalMembers ?? 0} participants
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Admitted Guests</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-zinc-900">
                  {summary?.checkins.successfulCheckins ?? 0}
                </span>
                <span className="text-[10px] text-zinc-500">turnstile scans</span>
              </div>
            </div>
          )}

          <div className="col-span-2 sm:col-span-1 bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Storage Quota</span>
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-zinc-900">
                {summary?.storage.usagePercent ?? 0}%
              </span>
              <span className="text-[10px] text-zinc-500">of 1GB bound</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 Canonical Pillars Navigation Tab Bar ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-surface-border">
        {/* Pillar 1: Overview */}
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Event Overview</span>
        </button>

        {/* Pillar 2: Configuration */}
        <button
          onClick={() => setActiveTab('configuration')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'configuration'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Event Configuration</span>
        </button>

        {/* Pillar 3: Verification & Organization */}
        <button
          onClick={() => setActiveTab('verification')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'verification'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verification & Org</span>
        </button>

        {/* Pillar 4: Attendees & Credentials */}
        <button
          onClick={() => setActiveTab('attendees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'attendees'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>Attendees & {pluralCredentialTerm}</span>
        </button>

        {/* Pillar 5: Operations & Turnstiles */}
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'operations'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Event Operations</span>
        </button>

        {/* Pillar 6: Team & Evaluation */}
        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'team'
              ? 'bg-stone-900 text-white shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team & Evaluation</span>
        </button>
      </div>

      {/* ── 6 Canonical Pillars Content ── */}
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 1: EVENT OVERVIEW & LIFECYCLE
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Interactive Lifecycle Bar */}
            <EventLifecycleBar
              eventId={eventId}
              currentStatus={event.status || 'DRAFT'}
              isOwner={true}
              isIndividual={isIndividual}
              onStatusChange={() => onRefreshEvent()}
            />

            {/* Quick Hub: 4 Key Workflows */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                onClick={() => setActiveTab('configuration')}
                className="bg-white border border-surface-border p-5 rounded-2xl shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-zinc-700 group-hover:bg-stone-900 group-hover:text-white transition-colors mb-3">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                  <span>Configuration</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Edit date, venue, capacity limits, and custom tier definitions.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('verification')}
                className="bg-white border border-surface-border p-5 rounded-2xl shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors mb-3">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                  <span>Trust & Verification</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {isIndividual
                    ? 'Standard individual host trust active. Full capabilities enabled.'
                    : 'Institutional domain and authorization document review.'}
                </p>
              </div>

              <div
                onClick={() => setActiveTab('attendees')}
                className="bg-white border border-surface-border p-5 rounded-2xl shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition-colors mb-3">
                  <Ticket className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                  <span>Attendees & Passes</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Import guest rosters, issue credentials, and design pass templates.
                </p>
              </div>

              <div
                onClick={() => setActiveTab('operations')}
                className="bg-white border border-surface-border p-5 rounded-2xl shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors mb-3">
                  <QrCode className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold text-zinc-900 flex items-center justify-between">
                  <span>Turnstile Check-In</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Launch atomic check-in scanners and monitor day-of-event arrival flow.
                </p>
              </div>
            </div>

            {/* Operational Readiness Card */}
            <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-zinc-900">Event Operational Readiness</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">
                  ID: {eventId}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/70 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Host Status</span>
                  <p className="font-bold text-zinc-900">
                    {isIndividual ? 'Individual Organizer' : 'Institutional / Enterprise'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {isIndividual
                      ? 'No organizational verification required. Standard platform tier active.'
                      : 'Subject to institutional domain and authorization document checks.'}
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/70 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Public Accessibility</span>
                  <p className="font-bold text-zinc-900">
                    {event.status === 'PUBLISHED' || event.status === 'REGISTRATION_OPEN' || event.status === 'EVENT_LIVE'
                      ? 'Live on Event Discovery'
                      : 'Unpublished Draft'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {event.status === 'DRAFT'
                      ? 'Review configuration details, then advance lifecycle to submit or publish.'
                      : 'Public page is reachable by prospective attendees.'}
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/70 space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Turnstile Readiness</span>
                  <p className="font-bold text-zinc-900">
                    {summary?.credentials.total && summary.credentials.total > 0
                      ? `${summary.credentials.total} Credentials Ready`
                      : 'No Passes Issued Yet'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Atomic scanner verification active with zero-latency duplicate detection.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 2: EVENT CONFIGURATION
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'configuration' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Event Details Form */}
              <div className="lg:col-span-2 bg-white border border-surface-border p-6 rounded-2xl shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-surface-border pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Event Details & Schedule</h2>
                    <p className="text-xs text-zinc-500">Update event identity, timing, venue, and descriptions</p>
                  </div>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Saved successfully</span>
                    </span>
                  )}
                </div>

                <form onSubmit={onUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Event Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Event Date</label>
                      <input
                        type="date"
                        required
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={formData.time || ''}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Venue Location</label>
                      <input
                        type="text"
                        value={typeof formData.venue === 'string' ? formData.venue : (formData.venue ? formatVenueLabel(formData.venue) : '')}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Organizer / Host Identity</label>
                      <input
                        type="text"
                        value={formData.organizerName || ''}
                        onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Event Description</label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900 transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? 'Saving...' : 'Save Configuration Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Ticket / Pass Categories */}
              <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900">{features.credentialTerm} Categories</h2>
                      <p className="text-[11px] text-zinc-500">Access policies & tier limits</p>
                    </div>
                    <button
                      onClick={onOpenAddTicketType}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Tier</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {ticketTypes.map((type) => (
                      <div
                        key={type.id}
                        className="p-3 bg-stone-50/70 border border-stone-200/80 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{type.name}</p>
                          <p className="text-[10px] text-zinc-500">{type.usagePolicy || 'Standard entry policy'}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white text-zinc-700 font-mono border border-stone-200 shadow-2xs">
                          {type.label}
                        </span>
                      </div>
                    ))}

                    {ticketTypes.length === 0 && (
                      <div className="text-center py-8 text-zinc-400 text-xs">
                        No custom categories defined. Click "+ Add Tier" to define access categories.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 3: VERIFICATION & ORGANIZATION
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'verification' && (
          <div className="space-y-6">
            <EventVerificationCard
              eventId={eventId}
              isOwner={true}
              isIndividual={isIndividual}
              organizationVerificationStatus={event.organizationVerificationStatus}
              onStatusChange={() => onRefreshEvent()}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 4: ATTENDEES & CREDENTIALS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'attendees' && (
          <div className="space-y-6">
            {/* Attendees Action Bar */}
            <div className="bg-white border border-surface-border p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-zinc-900">Attendee Roster & Credential Pipeline</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate('/import')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-zinc-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Import Guest Roster (CSV/Excel)</span>
                </button>
                <button
                  onClick={() => navigate('/tickets')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-zinc-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Full Ticket Registry</span>
                </button>
                <button
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Single Pass</span>
                </button>
              </div>
            </div>

            <EventCredentialTemplateCard
              eventId={eventId}
              isHostOrCoordinator={true}
            />

            <EventCredentialManagerCard
              eventId={eventId}
              isHostOrCoordinator={true}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 5: EVENT OPERATIONS & TURNSTILES
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="bg-white border border-surface-border p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-zinc-900">Day-of-Event Check-In Gates & Flow Control</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate('/scan')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Launch Dedicated Scanner App</span>
                </button>
                <button
                  onClick={() => navigate('/reports')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-zinc-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-zinc-600" />
                  <span>Attendance Reports</span>
                </button>
              </div>
            </div>

            <EventCheckinScannerCard
              eventId={eventId}
              isStaffOrHost={true}
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            PILLAR 6: TEAM, EVALUATION & SECURITY
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <EventStaffCard
              eventId={eventId}
              isHostOrAdmin={true}
            />

            <EventTaskManagerCard
              eventId={eventId}
              isHostOrCoordinator={true}
            />

            {/* Competition, Rubrics & Judging (Hackathons / Competitions only) */}
            {features.hasCompetition && (
              <>
                <EventTeamManagerCard
                  eventId={eventId}
                  isHostOrCoordinator={true}
                />
                <EventAssignmentCard
                  eventId={eventId}
                  isHostOrCoordinator={true}
                />
                <EventEvaluationCard
                  eventId={eventId}
                  isHostOrCoordinator={true}
                />
              </>
            )}

            {/* Security & Audit Trail */}
            <EventAuditLogCard
              eventId={eventId}
            />
          </div>
        )}
      </div>

      {/* Attendee Registration Modal */}
      <EventRegistrationModal
        eventId={eventId}
        eventName={event.name}
        eventType={eventType}
        credentialTerminology={features.credentialTerm}
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onSuccess={() => {
          fetchSummary();
        }}
      />
    </div>
  );
};
