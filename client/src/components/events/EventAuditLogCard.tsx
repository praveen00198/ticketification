import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  Activity,
  Trash2,
  UserPlus,
  UserX,
  XCircle,
} from 'lucide-react';
import { eventsApi, AuditLogItem } from '../../api/events';

interface EventAuditLogCardProps {
  eventId: string;
}

export const EventAuditLogCard: React.FC<EventAuditLogCardProps> = ({ eventId }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const res = await eventsApi.getEventAuditLogs(eventId, {
        action: selectedAction !== 'ALL' ? selectedAction : undefined,
        page,
        limit: 15,
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error('Failed to load event audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [eventId, selectedAction, page]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'STAFF_INVITED':
        return {
          icon: <UserPlus className="w-3.5 h-3.5" />,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          label: 'Staff Invited',
        };
      case 'STAFF_REMOVED':
        return {
          icon: <UserX className="w-3.5 h-3.5" />,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          label: 'Staff Removed',
        };
      case 'CREDENTIAL_REVOKED':
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          label: 'Pass Revoked',
        };
      case 'STORAGE_PURGED':
        return {
          icon: <Trash2 className="w-3.5 h-3.5" />,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          label: 'Storage Purged',
        };
      case 'EVENT_LIFECYCLE_TRANSITION':
        return {
          icon: <Activity className="w-3.5 h-3.5" />,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          label: 'Lifecycle Change',
        };
      default:
        return {
          icon: <Activity className="w-3.5 h-3.5" />,
          color: 'text-zinc-400 bg-zinc-800 border-zinc-700',
          label: action.replace(/_/g, ' '),
        };
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5 text-zinc-100">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-100">
                Immutable Audit Trail & Security Ledger
              </h3>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 18
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Append-only tamper-evident history of staff actions, pass revocations, and storage events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="bg-zinc-950/70 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="ALL">All Actions ({total})</option>
              <option value="STAFF_INVITED">Staff Invitations</option>
              <option value="STAFF_REMOVED">Staff Removals</option>
              <option value="CREDENTIAL_REVOKED">Pass Revocations</option>
              <option value="STORAGE_PURGED">Storage Purges</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Log Feed */}
      {loading && logs.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Verifying immutable security records...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/30">
          No security audit records logged for this scope yet.
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/40">
          {logs.map((log) => {
            const badge = getActionBadge(log.action);
            const isExpanded = expandedLogId === log._id;

            return (
              <div key={log._id} className="p-4 hover:bg-zinc-900/40 transition-colors">
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer select-none"
                  onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.color} mt-0.5`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200">
                          {log.actorEmail}
                        </span>
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                          {log.actorRole}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        Target: <span className="text-zinc-300 font-mono">{log.targetEntity}</span> ({log.targetId})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Accordion */}
                {isExpanded && (
                  <div className="mt-3.5 pt-3 border-t border-zinc-800/60 pl-8 space-y-2 text-xs">
                    <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                      <span>IP Address: <span className="font-mono text-zinc-300">{log.ipAddress || '127.0.0.1'}</span></span>
                      <span>User Agent: <span className="text-zinc-500 truncate max-w-xs">{log.userAgent || 'unknown'}</span></span>
                    </div>

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="bg-zinc-950 border border-zinc-800/90 rounded-lg p-2.5 font-mono text-[11px] text-emerald-400/90 overflow-x-auto">
                        <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
