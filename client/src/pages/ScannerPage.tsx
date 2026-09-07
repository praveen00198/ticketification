import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { QrScanner } from '../components/scanner/QrScanner';
import { verifyApi, VerificationResponse } from '../api/verify';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Ticket as TicketIcon,
  Calendar,
  RotateCcw,
  UserPlus,
  RefreshCw,
} from 'lucide-react';

export const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();

  const [scannedToken, setScannedToken] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<VerificationResponse | null>(null);

  // Check-in state
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Unassigned worker input
  const [workerNameInput, setWorkerNameInput] = useState<string>('');

  // Live recent check-ins feed
  const [recentCheckins, setRecentCheckins] = useState<any[]>([]);
  const [checkinCount, setCheckinCount] = useState<number>(0);

  const fetchRecentCheckins = useCallback(async () => {
    if (!currentEvent) return;
    try {
      const list = await verifyApi.getRecentCheckins(currentEvent.id);
      setRecentCheckins(list);
      setCheckinCount(list.length);
    } catch (_err) {}
  }, [currentEvent]);

  useEffect(() => {
    fetchRecentCheckins();
  }, [fetchRecentCheckins]);

  const handleScanSuccess = async (scannedPayload: string) => {
    // Extract token if scanned payload is a URL
    let token = scannedPayload.trim();
    if (token.includes('/verify/')) {
      const parts = token.split('/verify/');
      token = parts[parts.length - 1];
    }
    token = token.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

    setScannedToken(token);
    setVerifying(true);
    setScanResult(null);
    setCheckInSuccess(null);
    setCheckInError(null);
    setWorkerNameInput('');

    try {
      // Authoritative combined scan & auto check-in on the server
      const res = await verifyApi.scanTicket(token, currentEvent?.id);
      setScanResult(res);

      if (res.status === 'VALID' || res.status === 'VALID_WORKER') {
        setCheckInSuccess(res.message);
        await fetchRecentCheckins();
      }
    } catch (err: any) {
      setScanResult({
        status: 'INVALID',
        message: err.message || 'Invalid or unrecognized QR token.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleAssignWorkerAndCheckIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scannedToken || !currentEvent) return;

    if (!workerNameInput.trim()) {
      setCheckInError('Please enter the worker/staff member name before checking in.');
      return;
    }

    setCheckingIn(true);
    setCheckInError(null);
    try {
      const res = await verifyApi.scanTicket(
        scannedToken,
        currentEvent.id,
        workerNameInput.trim()
      );

      setScanResult(res);
      setCheckInSuccess(res.message);
      await fetchRecentCheckins();
    } catch (err: any) {
      setCheckInError(err.message || 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const resetScanner = () => {
    setScannedToken('');
    setScanResult(null);
    setCheckInSuccess(null);
    setCheckInError(null);
    setWorkerNameInput('');
  };

  if (!currentEvent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-white border border-surface-border rounded-2xl p-8 shadow-sm">
        <div className="w-12 h-12 bg-zinc-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">No Active Event Selected</h2>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">
          Please select or create an event before launching the QR verification scanner.
        </p>
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
        >
          <Calendar className="w-4 h-4" />
          <span>Manage Events</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-surface-border p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Event-Day Scanner</span>
            </span>
            <span className="text-xs text-zinc-400">•</span>
            <span className="text-xs font-semibold text-zinc-600">
              Active: <span className="text-zinc-900 font-bold">{currentEvent.name}</span>
            </span>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">QR Ticket Verification & Entry</h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={resetScanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold rounded-xl border border-zinc-300 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Scanner</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Camera Scanner & Manual Input */}
        <div className="md:col-span-6 space-y-4">
          <div className="bg-white border border-surface-border rounded-2xl p-4 overflow-hidden shadow-sm">
            <QrScanner onScanSuccess={handleScanSuccess} />
          </div>

          {/* Real-Time Scan Status Feed (Always visible without scrolling) */}
          {verifying && (
            <div className="p-3 bg-brand-50 border border-brand-200 text-brand-800 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xs animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-600" />
              <span>Scanning & validating token...</span>
            </div>
          )}

          {!verifying && scanResult && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs border ${
                scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : scanResult.status === 'ALREADY_USED'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : scanResult.status === 'UNASSIGNED_WORKER'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-zinc-100 text-zinc-800 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {(scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER') && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                {scanResult.status === 'ALREADY_USED' && (
                  <Clock className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                {scanResult.status === 'UNASSIGNED_WORKER' && (
                  <UserPlus className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                {(scanResult.status === 'INVALID' || scanResult.status === 'CANCELLED' || scanResult.status === 'WRONG_EVENT') && (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="truncate">{scanResult.message}</span>
              </div>
              {scanResult.ticket?.name && (
                <span className="font-semibold text-[11px] opacity-80 shrink-0">
                  {scanResult.ticket.name}
                </span>
              )}
            </div>
          )}

          {/* Manual Token Input */}
          <div className="bg-white border border-surface-border rounded-2xl p-4 space-y-2 shadow-sm">
            <label className="block text-xs font-bold text-zinc-700">
              Manual Token Lookup
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste 64-char hex token or scan URL..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm font-mono"
              />
              <button
                onClick={() => handleScanSuccess(manualInput)}
                disabled={!manualInput.trim() || verifying}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 shadow-sm"
              >
                Verify
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Scan Result & Actions */}
        <div className="md:col-span-6 space-y-4">
          {verifying ? (
            <div className="bg-white border border-surface-border rounded-2xl p-12 text-center text-xs text-zinc-500 space-y-2 shadow-sm">
              <RefreshCw className="w-6 h-6 text-brand-600 animate-spin mx-auto" />
              <div>Verifying token cryptographically...</div>
            </div>
          ) : scanResult ? (
            <div className="bg-white border border-surface-border rounded-2xl p-5 space-y-5 shadow-sm animate-in fade-in zoom-in-95">
              {/* Status Header */}
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : scanResult.status === 'UNASSIGNED_WORKER'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : scanResult.status === 'ALREADY_USED'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                  }`}
                >
                  {scanResult.status === 'VALID' && <CheckCircle2 className="w-4 h-4" />}
                  {scanResult.status === 'VALID_WORKER' && <UserCheck className="w-4 h-4" />}
                  {scanResult.status === 'UNASSIGNED_WORKER' && <UserPlus className="w-4 h-4" />}
                  {scanResult.status === 'ALREADY_USED' && <Clock className="w-4 h-4" />}
                  {scanResult.status === 'INVALID' && <XCircle className="w-4 h-4" />}
                  {scanResult.status === 'WRONG_EVENT' && <AlertTriangle className="w-4 h-4" />}
                  <span>{scanResult.status.replace('_', ' ')}</span>
                </span>

                {scanResult.ticket?.sequenceNumber && (
                  <span className="font-mono font-bold text-xs text-brand-600">
                    #{scanResult.ticket.sequenceNumber.toString().padStart(5, '0')}
                  </span>
                )}
              </div>

              {/* Message Banner */}
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : scanResult.status === 'UNASSIGNED_WORKER'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {scanResult.message}
              </div>

              {/* Ticket Details */}
              {scanResult.ticket && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-2.5 text-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Guest Name:</span>
                    <span className="text-sm font-bold text-zinc-900">
                      {scanResult.ticket.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Category:</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                      {scanResult.ticket.category}
                    </span>
                  </div>

                  {scanResult.ticket.organization && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Company:</span>
                      <span className="text-xs text-zinc-700">
                        {scanResult.ticket.organization}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Usage Policy:</span>
                    <span className="text-xs font-mono text-zinc-700">
                      {scanResult.ticket.usagePolicy}
                    </span>
                  </div>

                  {scanResult.ticket.lastCheckinTime && (
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200">
                      <span className="text-xs text-rose-600 font-semibold">Checked-in Time:</span>
                      <span className="text-xs font-mono text-rose-700">
                        {new Date(scanResult.ticket.lastCheckinTime).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Unassigned Worker Name Input Form */}
              {scanResult.status === 'UNASSIGNED_WORKER' && (
                <form onSubmit={handleAssignWorkerAndCheckIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-amber-800">
                      Assign Staff Name (First Entry)
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter staff full name..."
                      value={workerNameInput}
                      onChange={(e) => setWorkerNameInput(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={checkingIn || !workerNameInput.trim()}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {checkingIn ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Assigning & Checking In...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Assign Name & Complete Entry</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {checkInSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{checkInSuccess}</span>
                </div>
              )}

              {checkInError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{checkInError}</span>
                </div>
              )}
            </div>
          ) : (
            /* Idle State Instructions */
            <div className="bg-white border border-surface-border rounded-2xl p-8 text-center space-y-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-brand-600">
                <TicketIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Scanner Active</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Point camera at a guest QR code or paste verification token above.
              </p>
            </div>
          )}

          {/* Recent Check-in Feed */}
          <div className="bg-white border border-surface-border rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-600" />
                <span>Recent Check-ins ({checkinCount})</span>
              </span>
              <button
                onClick={fetchRecentCheckins}
                className="text-[11px] text-zinc-500 hover:text-zinc-900 font-semibold"
              >
                Refresh
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {recentCheckins.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-zinc-400">
                  No check-ins recorded yet for this session.
                </div>
              ) : (
                recentCheckins.map((item) => (
                  <div
                    key={item.checkin.id}
                    className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900">
                        {item.guest?.name || item.checkin.workerNameAssigned || 'Staff'}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {item.ticketType?.label || item.ticketType?.name}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700 font-semibold">
                      {new Date(item.checkin.checkedInAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
