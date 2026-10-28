import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Ticket,
  Users,
  Trophy,
  QrCode,
  ShieldCheck,
  Settings,
  FileSpreadsheet,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { EventItem, TicketType } from '../../types';
import { eventsApi, EventDashboardSummary, EventTypeFeatures } from '../../api/events';
import { formatVenueLabel } from '../../utils/venue';
import { EventOverviewDashboard } from './EventOverviewDashboard';
import { TeamConsole } from './TeamConsole';
import { EventVerificationCard } from './EventVerificationCard';
import { EventStaffCard } from './EventStaffCard';
import { EventTaskManagerCard } from './EventTaskManagerCard';
import { EventAssignmentCard } from './EventAssignmentCard';
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
  | 'team'
  | 'staff'
  | 'judging'
  | 'audit';

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
    if (lower === 'team' || lower === 'teams' || lower === 'participants') return 'team';
    if (lower === 'staff' || lower === 'volunteers') return 'staff';
    if (lower === 'judging' || lower === 'evaluation' || lower === 'rubrics' || lower === 'review') return 'judging';
    if (lower === 'audit' || lower === 'security') return 'audit';
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

  return (
    <div className="w-full space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1: EVENT OVERVIEW DASHBOARD
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <EventOverviewDashboard
          event={event}
          ticketTypes={ticketTypes}
          summary={summary}
          loadingSummary={loadingSummary}
          features={features}
          pluralCredentialTerm={pluralCredentialTerm}
          onRefreshSummary={() => {
            fetchSummary();
            onRefreshEvent();
          }}
          onOpenIssueModal={() => setIsRegisterModalOpen(true)}
          onNavigateTab={(tab) => setActiveTab(tab as HostConsoleTab)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2: EVENT CONFIGURATION
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'configuration' && (
        <div className="space-y-6">
          <div className="border-b border-stone-200/80 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-stone-800" />
              <span>Event Configuration</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Configure event identity, schedule, venue location, capacity, and pass categories.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Event Details Form */}
            <div className="lg:col-span-2 bg-white border border-stone-200/90 p-6 rounded-2xl shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-stone-900">General Information & Schedule</h2>
                  <p className="text-xs text-stone-500">Update event details displayed to attendees and on credentials</p>
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
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Event Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Event Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date || ''}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Start Time</label>
                    <input
                      type="time"
                      value={formData.time || ''}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Venue Location</label>
                    <input
                      type="text"
                      placeholder="Physical venue or Online"
                      value={typeof formData.venue === 'string' ? formData.venue : (formData.venue ? formatVenueLabel(formData.venue) : '')}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Organizer / Host Identity</label>
                    <input
                      type="text"
                      value={formData.organizerName || ''}
                      onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase mb-1">Event Description</label>
                  <textarea
                    rows={4}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-stone-400 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Configuration Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Pass Categories Summary */}
            <div className="bg-white border border-stone-200/90 p-6 rounded-2xl shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-stone-900">{features.credentialTerm} Categories</h2>
                    <p className="text-[11px] text-stone-500">Access policies & tier limits</p>
                  </div>
                  <button
                    onClick={onOpenAddTicketType}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
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
                        <p className="text-xs font-bold text-stone-900">{type.name}</p>
                        <p className="text-[10px] text-stone-500">{type.usagePolicy || 'Standard entry policy'}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white text-stone-700 font-mono border border-stone-200 shadow-2xs">
                        {type.label}
                      </span>
                    </div>
                  ))}

                  {ticketTypes.length === 0 && (
                    <div className="text-center py-8 text-stone-400 text-xs">
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
          SECTION 3: VERIFICATION & ORGANIZATION
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'verification' && (
        <div className="space-y-6">
          <div className="border-b border-stone-200/80 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-stone-800" />
              <span>Verification & Organization</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Institutional trust tiers, host verification review, and organization affiliations.
            </p>
          </div>

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
          SECTION 4: PASS MANAGEMENT & CREDENTIAL TEMPLATES
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'attendees' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <Ticket className="w-6 h-6 text-stone-800" />
                <span>Pass Management</span>
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Design visual credential templates, preview dynamic badges, and configure pass categories.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/import')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-stone-600" />
                <span>Guest Roster Import</span>
              </button>
              <button
                onClick={() => navigate('/tickets')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
                <Ticket className="w-3.5 h-3.5 text-stone-600" />
                <span>Issued Tickets Registry</span>
              </button>
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Issue Pass</span>
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
          SECTION 5: OPERATIONS CONSOLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <QrCode className="w-6 h-6 text-stone-800" />
                <span>Operations Console</span>
              </h1>
              <p className="text-xs text-stone-500 mt-1">
                Day-of-event arrival flow control, gate station selection, and atomic ticket verification.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate('/scan')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Launch Scanner App</span>
              </button>
              <button
                onClick={() => navigate('/reports')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-xl border border-stone-200 transition-colors cursor-pointer"
              >
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
          SECTION 6: DEDICATED TEAM CONSOLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'team' && (
        <TeamConsole
          eventId={eventId}
          isHostOrCoordinator={true}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7: STAFF CONSOLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="border-b border-stone-200/80 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-stone-800" />
              <span>Staff Console</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Manage event staff invitations, assigned roles, permissions, and volunteer shift tasks.
            </p>
          </div>

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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 8: JUDGING & EVALUATION
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'judging' && (
        <div className="space-y-6">
          <div className="border-b border-stone-200/80 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-stone-800" />
              <span>Judging & Evaluation</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Configure evaluation rubrics, assign mentors and judges to tracks, and review scoring leaderboards.
            </p>
          </div>

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

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 9: SECURITY & AUDIT TRAIL
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="border-b border-stone-200/80 pb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-stone-800" />
              <span>Security & Audit Ledger</span>
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Cryptographic audit trail of all staff mutations, credential issuance, and turnstile scans.
            </p>
          </div>

          <EventAuditLogCard
            eventId={eventId}
          />
        </div>
      )}

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
