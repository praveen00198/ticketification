import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Scan,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  UserCheck,
  Clock,
  DoorOpen,
  Volume2,
  VolumeX,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import {
  eventsApi,
  CheckinResponse,
  CredentialCheckinLog,
  CredentialCheckinStats,
} from '../../api/events';

interface EventCheckinScannerCardProps {
  eventId: string;
  isStaffOrHost?: boolean;
}

export const EventCheckinScannerCard: React.FC<EventCheckinScannerCardProps> = ({
  eventId,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [selectedGate, setSelectedGate] = useState('Main Gate');
  const [logs, setLogs] = useState<CredentialCheckinLog[]>([]);
  const [stats, setStats] = useState<CredentialCheckinStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Scanner alert banner state
  const [lastResult, setLastResult] = useState<CheckinResponse | null>(null);
  const [audioFeedback, setAudioFeedback] = useState(true);

  // Unassigned worker prompt modal state
  const [workerPromptOpen, setWorkerPromptOpen] = useState(false);
  const [workerNameInput, setWorkerNameInput] = useState('');
  const [pendingWorkerToken, setPendingWorkerToken] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Play synthetic audio chimes using Web Audio API
  const playChime = (type: 'SUCCESS' | 'ERROR' | 'PROMPT') => {
    if (!audioFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'SUCCESS') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'ERROR') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.0, audioCtx.currentTime); // A3
        osc.frequency.setValueAtTime(164.81, audioCtx.currentTime + 0.1); // E3
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440.0, audioCtx.currentTime); // A4
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [logsData, statsData] = await Promise.all([
        eventsApi.getCredentialCheckins(eventId, {
          gate: selectedGate === 'ALL' ? undefined : selectedGate,
          scanStatus: statusFilter === 'ALL' ? undefined : statusFilter,
          search: searchFilter.trim() || undefined,
          limit: 30,
        }),
        eventsApi.getCredentialCheckinStats(eventId),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load check-in data:', err);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId, selectedGate, statusFilter]);

  // Execute check-in
  const handleCheckIn = async (tokenToUse?: string, workerName?: string) => {
    const rawToken = tokenToUse || tokenInput.trim();
    if (!rawToken) return;

    // Extract token if user pasted a full URL (e.g. https://.../verify/<token>)
    let cleanToken = rawToken;
    if (rawToken.includes('/verify/')) {
      const parts = rawToken.split('/verify/');
      cleanToken = parts[parts.length - 1].split('?')[0].split('#')[0].trim();
    }

    setLoading(true);
    try {
      const response = await eventsApi.checkInCredential(eventId, {
        token: cleanToken,
        gate: selectedGate === 'ALL' ? 'Main Gate' : selectedGate,
        workerName: workerName || undefined,
      });

      setLastResult(response);

      if (response.code === 'WORKER_NAME_REQUIRED') {
        playChime('PROMPT');
        setPendingWorkerToken(cleanToken);
        setWorkerPromptOpen(true);
      } else if (response.success) {
        playChime('SUCCESS');
        setTokenInput('');
        loadData(true);
      } else {
        playChime('ERROR');
        loadData(true);
      }
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.message || 'Check-in failed';
      setLastResult({
        success: false,
        code: 'INVALID_TOKEN',
        message,
      });
      playChime('ERROR');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleWorkerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerNameInput.trim()) return;
    setWorkerPromptOpen(false);
    await handleCheckIn(pendingWorkerToken, workerNameInput.trim());
    setWorkerNameInput('');
    setPendingWorkerToken('');
  };

  return (
    <div className="bg-white border border-surface-border rounded-2xl shadow-sm overflow-hidden mb-6">
      {/* Header Banner */}
      <div className="p-6 border-b border-surface-border bg-gradient-to-r from-zinc-900 to-zinc-800 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-zinc-800 text-white rounded-lg border border-zinc-700">
              <Scan className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold">Day-of-Event Gate Verification & Check-In</h2>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              Phase 14 Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            High-throughput atomic check-in console with double-scan prevention and worker pass workflows
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAudioFeedback(!audioFeedback)}
            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
              audioFeedback
                ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioFeedback ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => loadData()}
            disabled={refreshing}
            className="p-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700 flex items-center gap-1.5 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-50 border-b border-surface-border">
          <div className="bg-white p-3.5 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Total Scans</span>
              <Scan className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-xl font-bold text-zinc-900">{stats.totalScans}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Admitted</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-600">{stats.successfulCheckins}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>Duplicates Blocked</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-rose-600">{stats.duplicateRejections}</div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-surface-border">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span>15-min Velocity</span>
              <Clock className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-xl font-bold text-teal-600">
              {stats.velocityLast15Mins} <span className="text-xs font-normal text-zinc-400">scans</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Scanner Control Section */}
      <div className="p-6 space-y-4">
        {/* Gate Selector & Token Entry Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>Gate Station</span>
            </label>
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900"
            >
              <option value="Main Gate">Main Gate</option>
              <option value="North Entrance">North Entrance</option>
              <option value="VIP Gate">VIP Gate</option>
              <option value="Stage Entrance">Stage Entrance</option>
              <option value="Backstage Door">Backstage Door</option>
              <option value="ALL">All Stations</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-zinc-500" />
                <span>Scan QR Token or Enter 64-Char Hash</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">
                Fast barcode scanner & clipboard auto-read ready
              </span>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckIn();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Paste verification token or full verification URL..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-stone-400/20 focus:border-stone-900"
                />
                <QrCode className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              </div>

              <button
                type="submit"
                disabled={loading || !tokenInput.trim()}
                className="px-5 py-2.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>Check In</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Feedback Banner */}
        {lastResult && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
              lastResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : lastResult.code === 'WORKER_NAME_REQUIRED'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-3">
              {lastResult.success ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : lastResult.code === 'WORKER_NAME_REQUIRED' ? (
                <UserCheck className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm">
                    {lastResult.success
                      ? lastResult.code === 'VALID_REUSABLE'
                        ? 'Reusable Admission Approved'
                        : 'Admission Granted'
                      : lastResult.code === 'ALREADY_CHECKED_IN'
                      ? 'Already Checked In'
                      : lastResult.code === 'CREDENTIAL_REVOKED'
                      ? 'Pass Revoked'
                      : lastResult.code === 'WORKER_NAME_REQUIRED'
                      ? 'Worker Name Required'
                      : 'Verification Failed'}
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-white/70 border border-current">
                    {lastResult.code}
                  </span>
                </div>
                <p className="text-xs opacity-90">{lastResult.message}</p>

                {lastResult.credential && (
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1 font-mono">
                    <span className="bg-white/80 px-2 py-0.5 rounded border border-current font-bold">
                      {(lastResult.credential as any).formattedId || lastResult.credential.sequenceFormatted}
                    </span>
                    <span className="font-sans font-semibold">
                      {lastResult.credential.holder?.name || 'Worker'}
                    </span>
                    <span className="opacity-75">
                      ({(lastResult.credential.holder as any)?.category || lastResult.credential.holder?.roleCategory || lastResult.credential.credentialType})
                    </span>
                    {lastResult.checkInCount !== undefined && (
                      <span className="bg-white/80 px-1.5 py-0.5 rounded border border-current text-[11px]">
                        Entry #{lastResult.checkInCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLastResult(null)}
              className="text-xs opacity-60 hover:opacity-100 p-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Scan Log Stream */}
        <div className="border border-surface-border rounded-xl overflow-hidden mt-4">
          <div className="p-4 bg-zinc-50 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Live Scan Activity Stream
              </h3>
              <span className="text-[10px] px-2 py-0.5 bg-zinc-200 text-zinc-700 font-bold rounded-full">
                {logs.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter name / id..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="ALREADY_CHECKED_IN">Duplicate</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-surface-border text-[11px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-50/50">
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4">Pass ID</th>
                  <th className="py-2.5 px-4">Attendee / Holder</th>
                  <th className="py-2.5 px-4">Gate</th>
                  <th className="py-2.5 px-4">Policy</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Scanner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-400">
                      No check-ins recorded yet. Scan a credential above.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-zinc-500 whitespace-nowrap">
                        {new Date(log.scannedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-zinc-900 whitespace-nowrap">
                        {log.holderSnapshot.formattedId}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-zinc-800">
                          {log.holderSnapshot.name}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {log.holderSnapshot.category}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap">
                        {log.gate}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                          {log.usagePolicy}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {log.scanStatus === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Admitted</span>
                          </span>
                        ) : log.scanStatus === 'ALREADY_CHECKED_IN' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Duplicate</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full border border-zinc-300">
                            <XCircle className="w-3 h-3" />
                            <span>{log.scanStatus}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500 text-[11px] truncate max-w-[120px]">
                        {log.scannerEmail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Unassigned Worker Assignment Modal */}
      {workerPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-surface-border space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 text-base">Unassigned Worker Pass</h3>
                <p className="text-xs text-zinc-500">
                  Assign crew member name before granting admission
                </p>
              </div>
            </div>

            <form onSubmit={handleWorkerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Worker / Crew Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={workerNameInput}
                  onChange={(e) => setWorkerNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setWorkerPromptOpen(false);
                    setWorkerNameInput('');
                    setPendingWorkerToken('');
                  }}
                  className="px-4 py-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!workerNameInput.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                >
                  Assign & Check In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
