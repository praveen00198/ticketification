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
      <div className="bg-white border border-surface-border rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                {getTypeIcon(eventType)}
                <span>{eventType.replace(/_/g, ' ')} CONSOLE</span>
              </span>

              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                  event.status === 'EVENT_LIVE'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 animate-pulse'
                    : event.status === 'PUBLISHED'
                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                    : event.status === 'COMPLETED'
                    ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                ● {event.status || 'DRAFT'}
              </span>

              <span className="text-[11px] text-zinc-500 font-medium px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200">
                Taxonomy: {features.credentialTerm}
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
                  <span>{event.venue}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-colors shadow-2xs"
            >
              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
              <span>Register / Claim {features.credentialTerm}</span>
            </button>

            <button
              onClick={() => {
                fetchSummary();
                onRefreshEvent();
              }}
              disabled={loadingSummary}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200/80 text-zinc-700 text-xs font-semibold rounded-xl border border-stone-200 transition-colors shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${loadingSummary ? 'animate-spin' : ''}`} />
              <span>Refresh Console</span>
            </button>
          </div>
        </div>

        {/* Live Telemetry Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-surface-border">
          <div className="bg-stone-50/70 border border-stone-200/70 p-3 rounded-xl hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between text-zinc-500 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider">Issued {features.credentialTerm}s</span>
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
                  {summary?.teams?.totalMembers ?? 0} hackers
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

      {/* Context-Aware Navigation Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-surface-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview & Lifecycle</span>
        </button>

        <button
          onClick={() => setActiveTab('credentials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'credentials'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          <span>{features.credentialTerm}s & Badges</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'staff'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
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
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
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
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Day-of-Event Gate Ops</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-100'
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
              <div className="lg:col-span-2 bg-white border border-surface-border p-6 rounded-2xl shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-surface-border pb-4">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900">Event Details</h2>
                    <p className="text-xs text-zinc-500">Update event information and schedules</p>
                  </div>
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
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
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Time</label>
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
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Venue</label>
                      <input
                        type="text"
                        value={formData.venue || ''}
                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1">Organizer</label>
                      <input
                        type="text"
                        value={formData.organizerName || ''}
                        onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                        className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-[#FAFAF9] border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right column: Ticket / Pass Categories */}
              <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-900">{features.credentialTerm} Categories</h2>
                      <p className="text-[11px] text-zinc-500">Rules & tiers for this event</p>
                    </div>
                    <button
                      onClick={onOpenAddTicketType}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {ticketTypes.map((type) => (
                      <div
                        key={type.id}
                        className="p-3 bg-stone-50/70 border border-stone-200/80 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{type.name}</p>
                          <p className="text-[10px] text-zinc-500">{type.usagePolicy}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-zinc-600 font-mono border border-stone-200">
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
