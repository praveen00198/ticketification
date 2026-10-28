import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  ExternalLink,
  QrCode,
  Ticket,
  Users,
  Trophy,
  Zap,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Settings,
  FileSpreadsheet,
  X,
  History,
} from 'lucide-react';
import { EventItem, TicketType } from '../../types';
import { EventDashboardSummary, EventTypeFeatures, eventsApi, EventStatusHistoryItem } from '../../api/events';
import { formatVenueLabel } from '../../utils/venue';

interface EventOverviewDashboardProps {
  event: EventItem;
  ticketTypes: TicketType[];
  summary: EventDashboardSummary | null;
  loadingSummary: boolean;
  features: EventTypeFeatures;
  pluralCredentialTerm: string;
  onRefreshSummary: () => void;
  onOpenIssueModal: () => void;
  onNavigateTab: (tab: string) => void;
}

export const EventOverviewDashboard: React.FC<EventOverviewDashboardProps> = ({
  event,
  ticketTypes,
  summary,
  loadingSummary,
  features,
  pluralCredentialTerm,
  onRefreshSummary,
  onOpenIssueModal,
  onNavigateTab,
}) => {
  const navigate = useNavigate();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<EventStatusHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await eventsApi.getLifecycleHistory(event.id);
      setHistoryItems(res.statusHistory || []);
      setShowHistoryModal(true);
    } catch (err: any) {
      setHistoryError(err?.message || 'Could not load lifecycle history.');
      setShowHistoryModal(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Readiness calculations based on real event state
  const isConfigured = Boolean(event.name && event.date && event.venue);
  const isPublished = event.status === 'PUBLISHED' || event.status === 'REGISTRATION_OPEN' || event.status === 'EVENT_LIVE';
  const hasCredentialTypes = ticketTypes && ticketTypes.length > 0;
  const hasStaff = (summary?.staff.total ?? 0) > 0;
  const isScannerActive = event.status === 'EVENT_LIVE';

  const readinessScore = [
    isConfigured,
    hasCredentialTypes,
    isPublished,
    hasStaff || (summary?.staff.volunteers ?? 0) > 0,
    isScannerActive,
  ].filter(Boolean).length;

  const totalReadinessChecks = 5;
  const readinessPercent = Math.round((readinessScore / totalReadinessChecks) * 100);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'EVENT_LIVE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'PUBLISHED':
      case 'REGISTRATION_OPEN':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'COMPLETED':
        return 'bg-stone-100 text-stone-700 border-stone-300';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'SUSPENDED':
        return 'bg-red-50 text-red-800 border-red-300';
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Compact Operational Header ── */}
      <div className="bg-stone-50/60 border border-stone-200/80 rounded-2xl p-5 sm:p-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider inline-flex items-center gap-1 ${getStatusColor(
                  event.status
                )}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {event.status || 'DRAFT'}
              </span>

              <button
                onClick={fetchHistory}
                disabled={historyLoading}
                className="text-[11px] text-stone-500 hover:text-stone-900 inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-stone-200/50 transition-colors cursor-pointer"
                title="View immutable status audit ledger"
              >
                <History className="w-3 h-3 text-stone-400" />
                <span>Audit History</span>
              </button>

              <span className="text-[11px] text-stone-500 font-medium px-2 py-0.5 rounded-md bg-white border border-stone-200">
                {event.hostingType === 'INDIVIDUAL' ? 'Individual Host' : 'Institutional Host'}
              </span>

              <span className="text-[11px] text-stone-500 font-medium px-2 py-0.5 rounded-md bg-white border border-stone-200">
                Credential: {features.credentialTerm}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight truncate">
              {event.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{event.date || 'Date TBD'}</span>
                {event.time && <span className="text-stone-400">at {event.time}</span>}
              </span>
              {event.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{formatVenueLabel(event.venue)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Contextual Operational Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(`/events/${event.id}/public`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 text-stone-800 text-xs font-semibold rounded-xl border border-stone-300 transition-colors shadow-2xs cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-600" />
              <span>Public Page</span>
            </button>

            <button
              onClick={() => navigate('/scan')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Turnstiles</span>
            </button>

            <button
              onClick={onOpenIssueModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5 text-stone-200" />
              <span>Issue {features.credentialTerm}</span>
            </button>

            <button
              onClick={onRefreshSummary}
              disabled={loadingSummary}
              className="inline-flex items-center gap-1.5 p-2 bg-white hover:bg-stone-100 text-stone-600 hover:text-stone-900 text-xs rounded-xl border border-stone-200 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Refresh telemetry metrics"
              aria-label="Refresh telemetry metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Operational Metrics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Issued Credentials */}
        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Issued {pluralCredentialTerm}
            </span>
            <Ticket className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">{summary?.credentials.total ?? 0}</span>
            <span className="text-[11px] text-emerald-700 font-semibold">
              {summary?.credentials.checkInRatePercent ?? 0}% checked-in
            </span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">
            {summary?.credentials.active ?? 0} active, {summary?.credentials.checkedIn ?? 0} checked in
          </p>
        </div>

        {/* Metric 2: Turnstile Check-ins */}
        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Admissions
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">
              {summary?.checkins.successfulCheckins ?? 0}
            </span>
            <span className="text-[11px] text-stone-500 font-medium">scans</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">
            {(summary?.checkins.duplicateRejections ?? 0) + (summary?.checkins.revokedRejections ?? 0)} duplicate/invalid rejected
          </p>
        </div>

        {/* Metric 3: Gate Velocity */}
        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Gate Velocity
            </span>
            <Zap className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">
              {summary?.checkins.velocityLast15Mins ?? 0}
            </span>
            <span className="text-[11px] text-stone-500 font-medium">scans / 15m</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">Real-time turnstile throughput</p>
        </div>

        {/* Metric 4: Teams or Capacity */}
        {features.hasCompetition ? (
          <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors">
            <div className="flex items-center justify-between text-stone-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Registered Teams
              </span>
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-stone-900">
                {summary?.teams?.totalTeams ?? 0}
              </span>
              <span className="text-[11px] text-stone-500 font-medium">cohorts</span>
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              {summary?.teams?.totalMembers ?? 0} total participants
            </p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors">
            <div className="flex items-center justify-between text-stone-500 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Capacity
              </span>
              <Users className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-stone-900">
                {(event as any).capacity ? (event as any).capacity : 'Unlimited'}
              </span>
              {(event as any).capacity && (
                <span className="text-[11px] text-stone-500 font-medium">
                  ({Math.max(0, (event as any).capacity - (summary?.credentials.total ?? 0))} left)
                </span>
              )}
            </div>
            <p className="text-[10px] text-stone-400 mt-1">Venue attendance threshold</p>
          </div>
        )}

        {/* Metric 5: Staff on Duty */}
        <div className="bg-white border border-stone-200/90 p-4 rounded-xl shadow-2xs hover:border-stone-300 transition-colors col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Staff & Crew
            </span>
            <Users className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900">{summary?.staff.total ?? 0}</span>
            <span className="text-[11px] text-stone-500 font-medium">active members</span>
          </div>
          <p className="text-[10px] text-stone-400 mt-1">
            {summary?.staff.volunteers ?? 0} gate volunteers assigned
          </p>
        </div>
      </div>

      {/* ── Two-Column Operational Layout: Readiness & Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols): Operational Readiness & Attention Items */}
        <div className="lg:col-span-7 space-y-5">
          {/* Operational Readiness Checklist */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Operational Readiness Gate
                </h3>
                <p className="text-[11px] text-stone-500">
                  Pre-event checks for gates, tickets, and participant admission
                </p>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                {readinessPercent}% Ready
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      isConfigured ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    {isConfigured ? '✓' : '•'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Event Configuration</div>
                    <div className="text-[10px] text-stone-500">
                      {isConfigured ? 'Name, schedule, and venue verified' : 'Incomplete configuration'}
                    </div>
                  </div>
                </div>
                {!isConfigured && (
                  <button
                    onClick={() => onNavigateTab('configuration')}
                    className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline cursor-pointer"
                  >
                    Configure
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      hasCredentialTypes ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    {hasCredentialTypes ? '✓' : '•'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Pass Templates & Tiers</div>
                    <div className="text-[10px] text-stone-500">
                      {hasCredentialTypes
                        ? `${ticketTypes.length} pass categories active`
                        : 'No pass tiers configured yet'}
                    </div>
                  </div>
                </div>
                {!hasCredentialTypes && (
                  <button
                    onClick={() => onNavigateTab('attendees')}
                    className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline cursor-pointer"
                  >
                    Create Pass
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      isPublished ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    {isPublished ? '✓' : '•'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Public Discoverability</div>
                    <div className="text-[10px] text-stone-500">
                      {isPublished
                        ? 'Event is published and accepting registrations'
                        : 'Draft mode — hidden from public catalog'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      hasStaff ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    {hasStaff ? '✓' : '•'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Staff & Gate Personnel</div>
                    <div className="text-[10px] text-stone-500">
                      {hasStaff
                        ? `${summary?.staff.total} staff members registered`
                        : 'No staff coordinators or volunteers assigned'}
                    </div>
                  </div>
                </div>
                {!hasStaff && (
                  <button
                    onClick={() => navigate(`/events/${event.id}/staff-console`)}
                    className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline cursor-pointer"
                  >
                    Invite Staff
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50/70 border border-stone-200/60">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      isScannerActive ? 'bg-emerald-600' : 'bg-stone-300'
                    }`}
                  >
                    {isScannerActive ? '✓' : '•'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Turnstile Scanner Readiness</div>
                    <div className="text-[10px] text-stone-500">
                      {isScannerActive
                        ? 'Event is live — scanner gates actively processing tokens'
                        : 'Scanner gates standby until event marked live'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/scan')}
                  className="text-[11px] font-semibold text-stone-700 hover:text-stone-900 underline cursor-pointer"
                >
                  Test Scanner
                </button>
              </div>
            </div>
          </div>

          {/* Attention Items & Actionable Alerts */}
          {(!isPublished || !hasCredentialTypes || (summary?.credentials.total ?? 0) === 0) && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4.5 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Attention Needed Before Event Day</span>
              </div>
              <ul className="text-xs text-amber-900/80 space-y-1 list-disc list-inside pl-1 text-[11px]">
                {!isPublished && (
                  <li>Event status is currently {event.status || 'DRAFT'}. Complete configuration to publish.</li>
                )}
                {!hasCredentialTypes && (
                  <li>Configure at least one pass category so attendees can receive credentials.</li>
                )}
                {(summary?.credentials.total ?? 0) === 0 && (
                  <li>No tickets have been generated yet. Use Guest Roster import or issue passes.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Quick Action Shortcuts & Storage / Telemetry */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick Action Shortcuts */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider border-b border-stone-100 pb-2.5">
              Workspace Shortcuts
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => onNavigateTab('configuration')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Event Configuration</div>
                    <div className="text-[10px] text-stone-500">Edit schedule, venue, capacity</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigateTab('attendees')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <Ticket className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Pass Management</div>
                    <div className="text-[10px] text-stone-500">Design credentials & tier limits</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => navigate('/import')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Guest Roster Import</div>
                    <div className="text-[10px] text-stone-500">CSV bulk guest onboarding</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigateTab('team')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Team Console</div>
                    <div className="text-[10px] text-stone-500">Participant cohorts & rosters</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                onClick={() => onNavigateTab('operations')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-stone-900">Operations Console</div>
                    <div className="text-[10px] text-stone-500">Gate flow & scan telemetry</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>
          </div>

          {/* Cloud Storage & Asset Quota */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-stone-600" />
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  Asset Storage
                </h3>
              </div>
              <span className="text-xs font-bold text-stone-700 font-mono">
                {summary?.storage.usagePercent ?? 0}% Bound
              </span>
            </div>
            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-stone-900 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, summary?.storage.usagePercent ?? 0)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-500">
              <span>Direct Presigned S3/Supabase Storage</span>
              <span>1GB Quota per Event</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Read-only Status Audit Modal ── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-700" />
                <h3 className="text-sm font-bold text-stone-900">Lifecycle Audit History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-96 overflow-y-auto space-y-3">
              {historyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {historyError}
                </div>
              )}

              {historyItems.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-6">
                  No lifecycle transitions recorded yet for this event.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {historyItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-stone-900">
                          <span className="text-stone-500 font-mono text-[11px]">{item.fromStatus}</span>
                          <span className="text-stone-400">→</span>
                          <span className="text-emerald-700 font-mono text-[11px]">{item.toStatus}</span>
                        </div>
                        {item.reason && (
                          <p className="text-[11px] text-stone-600 italic">"{item.reason}"</p>
                        )}
                        <p className="text-[10px] text-stone-400 font-mono">
                          Actor: {item.changedBySupabaseId ? item.changedBySupabaseId.slice(0, 10) + '...' : 'System'}
                        </p>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
