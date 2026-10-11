import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { EventItem, TicketType } from '../../types';
import { eventsApi, EventDashboardSummary, EventTypeFeatures } from '../../api/events';
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
  | 'credentials'
  | 'staff'
  | 'competition'
  | 'gate'
  | 'audit';

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
  const [activeTab, setActiveTab] = useState<HostConsoleTab>('overview');
  const [summary, setSummary] = useState<EventDashboardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  const eventId = event.id;
  const eventType = (event.eventType || 'OTHER').toUpperCase();

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'HACKATHON':
      case 'COMPETITION':
        return <Code className="w-3.5 h-3.5 text-emerald-400" />;
      case 'CONCERT':
      case 'FESTIVAL':
        return <Music className="w-3.5 h-3.5 text-indigo-400" />;
      case 'WORKSHOP':
      case 'BOOTCAMP':
        return <BookOpen className="w-3.5 h-3.5 text-amber-400" />;
      case 'CONFERENCE':
      case 'SUMMIT':
        return <Layers className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Context-Aware Adaptive Header */}
      <div className="bg-[#111622] border border-[#1f293d] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-36 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#161f30] text-emerald-400 border border-emerald-500/20 shadow-sm">
                {getTypeIcon(eventType)}
                <span>{eventType.replace(/_/g, ' ')} CONSOLE</span>
              </span>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  event.status === 'EVENT_LIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                    : event.status === 'PUBLISHED'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : event.status === 'COMPLETED'
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                ● {event.status || 'DRAFT'}
              </span>

              <span className="text-[11px] text-zinc-400 font-medium px-2 py-0.5 rounded-md bg-zinc-800/60 border border-zinc-700/50">
                Taxonomy: {features.credentialTerm}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {event.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>{event.date}</span>
                {event.time && <span className="text-zinc-500">at {event.time}</span>}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{event.venue}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-colors shadow-sm"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Register / Claim {features.credentialTerm}</span>
            </button>

            <button
              onClick={() => {
                fetchSummary();
                onRefreshEvent();
              }}
              disabled={loadingSummary}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#1a2233] hover:bg-[#222c42] text-zinc-200 text-xs font-semibold rounded-xl border border-[#2a3650] transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
              <span>Refresh Console</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-[#1f293d]/80">
          <div className="bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Issued {features.credentialTerm}s</span>
              <Ticket className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">{summary?.credentials.total ?? 0}</span>
              <span className="text-[10px] text-emerald-400 font-semibold">
                {summary?.credentials.checkInRatePercent ?? 0}% checked in
              </span>
            </div>
          </div>

          <div className="bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Scan Velocity</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">
                {summary?.checkins.velocityLast15Mins ?? 0}
              </span>
              <span className="text-[10px] text-zinc-400">scans / 15m</span>
            </div>
          </div>

          <div className="bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Staff On-Duty</span>
              <Users className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">{summary?.staff.total ?? 0}</span>
              <span className="text-[10px] text-zinc-400">
                {summary?.staff.volunteers ?? 0} volunteers
              </span>
            </div>
          </div>

          {features.hasCompetition ? (
            <div className="bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Team Cohorts</span>
                <Trophy className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-white">
                  {summary?.teams?.totalTeams ?? 0}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {summary?.teams?.totalMembers ?? 0} hackers
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Admitted Guests</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-white">
                  {summary?.checkins.successfulCheckins ?? 0}
                </span>
                <span className="text-[10px] text-zinc-400">turnstile scans</span>
              </div>
            </div>
          )}

          <div className="col-span-2 sm:col-span-1 bg-[#161e2e]/60 border border-[#232e44] p-3 rounded-xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Storage Quota</span>
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-white">
                {summary?.storage.usagePercent ?? 0}%
              </span>
              <span className="text-[10px] text-zinc-400">of 1GB bound</span>
            </div>
          </div>
        </div>
      </div>

      {/* Context-Aware Navigation Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-[#1f293d]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview & Lifecycle</span>
        </button>

        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'credentials'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>{features.credentialTerm}s & Badges</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff & Station Tasks</span>
        </button>

        {/* Competition Tab: Only visible if event supports competition */}
        {features.hasCompetition && (
          <button
            onClick={() => setActiveTab('competition')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'competition'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Competition & Tracks</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('gate')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'gate'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Day-of-Event Gate Ops</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#161e2e]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Security & Audit Trail</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* Tab 1: Overview & Lifecycle */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <EventVerificationCard
              eventId={eventId}
              isOwner={true}
              onStatusChange={() => onRefreshEvent()}
            />

            <EventLifecycleBar
              eventId={eventId}
              currentStatus={event.status || 'DRAFT'}
              isOwner={true}
              onStatusChange={() => onRefreshEvent()}
            />

            {/* Event Form & Categories Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-[#111622] border border-[#1f293d] p-6 rounded-2xl shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-[#1f293d] pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">Event Details</h2>
                    <p className="text-xs text-zinc-400">Update event information and schedules</p>
                  </div>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                      <span>Saved successfully</span>
                    </span>
                  )}
                </div>

                <form onSubmit={onUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">Event Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">Event Date</label>
                      <input
                        type="date"
                        required
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">Time</label>
                      <input
                        type="time"
                        value={formData.time || ''}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">Venue</label>
                      <input
                        type="text"
                        value={formData.venue || ''}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">Organizer</label>
                      <input
                        type="text"
                        value={formData.organizerName || ''}
                        onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                        className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right column: Ticket / Pass Categories */}
              <div className="bg-[#111622] border border-[#1f293d] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[#1f293d] pb-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-white">{features.credentialTerm} Categories</h2>
                      <p className="text-[11px] text-zinc-400">Rules & tiers for this event</p>
                    </div>
                    <button
                      onClick={onOpenAddTicketType}
                      className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {ticketTypes.map((type) => (
                      <div
                        key={type.id}
                        className="p-3 bg-[#182030] border border-[#2a3650] rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{type.name}</p>
                          <p className="text-[10px] text-zinc-400">{type.usagePolicy}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                          {type.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Credentials & Badges */}
        {activeTab === 'credentials' && (
          <div className="space-y-6">
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

        {/* Tab 3: Staff & Station Tasks */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <EventStaffCard
              eventId={eventId}
              isHostOrAdmin={true}
            />
            <EventTaskManagerCard
              eventId={eventId}
              isHostOrCoordinator={true}
            />
          </div>
        )}

        {/* Tab 4: Competition & Tracks (Hackathon / Competition only) */}
        {activeTab === 'competition' && features.hasCompetition && (
          <div className="space-y-6">
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
          </div>
        )}

        {/* Tab 5: Day-of-Event Gate Ops */}
        {activeTab === 'gate' && (
          <div className="space-y-6">
            <EventCheckinScannerCard
              eventId={eventId}
              isStaffOrHost={true}
            />
          </div>
        )}

        {/* Tab 6: Security & Audit Trail */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
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
