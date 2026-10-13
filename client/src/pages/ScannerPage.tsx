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
  UserCheck,
  Ticket as TicketIcon,
  Calendar,
  RotateCcw,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { Button, Badge, Card, InView } from '../components/ui';

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
      <div className="max-w-2xl mx-auto py-16 text-center bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="w-12 h-12 bg-stone-100 text-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-stone-200/80 shadow-2xs">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-base sm:text-lg font-bold text-zinc-900 mb-1.5">No Active Event Selected</h2>
        <p className="text-xs text-stone-500 max-w-md mx-auto mb-6 leading-relaxed">
          Please select or create an event before launching the turnstile verification scanner.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/events')}
          iconLeft={<Calendar className="w-4 h-4" />}
        >
          Manage Events
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <InView direction="up" distance={12}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-stone-200/90 p-5 sm:p-6 rounded-2xl shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="neutral" dot>Event-Day Turnstiles</Badge>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs font-semibold text-stone-600 truncate">
                Event: <span className="text-zinc-900 font-bold">{currentEvent.name}</span>
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
              QR Ticket Verification & Entry
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Atomic sub-200ms scan validation with tamper-proof single-use check-ins.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetScanner}
              iconLeft={<RotateCcw className="w-3.5 h-3.5 text-stone-500" />}
            >
              Reset View
            </Button>
          </div>
        </div>
      </InView>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Camera Scanner & Manual Input */}
        <div className="md:col-span-6 space-y-4">
          <Card padding="sm" className="overflow-hidden">
            <QrScanner onScanSuccess={handleScanSuccess} />
          </Card>

          {/* Real-Time Scan Status Feed */}
          {verifying && (
            <div className="p-3.5 bg-stone-100 border border-stone-200 text-stone-900 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-2xs animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-stone-900" />
              <span>Validating cryptographic QR token...</span>
            </div>
          )}

          {!verifying && scanResult && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2.5 shadow-2xs border ${
                scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : scanResult.status === 'ALREADY_USED'
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : scanResult.status === 'UNASSIGNED_WORKER'
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-stone-100 text-zinc-800 border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {(scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER') && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                )}
                {scanResult.status === 'ALREADY_USED' && (
                  <Clock className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                {scanResult.status === 'UNASSIGNED_WORKER' && (
                  <UserPlus className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                {(scanResult.status === 'INVALID' ||
                  scanResult.status === 'CANCELLED' ||
                  scanResult.status === 'WRONG_EVENT') && (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
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
          <Card padding="md" className="space-y-2.5">
            <label className="block text-xs font-semibold text-zinc-700">
              Manual Token Lookup
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste 64-char hex token or URL..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScanSuccess(manualInput)}
                className="w-full bg-stone-50 border border-stone-200/90 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-3 focus:ring-stone-400/20 shadow-2xs font-mono"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleScanSuccess(manualInput)}
                disabled={!manualInput.trim() || verifying}
              >
                Verify
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Scan Result & Actions */}
        <div className="md:col-span-6 space-y-4">
          {verifying ? (
            <Card padding="lg" className="text-center text-xs text-stone-500 space-y-3">
              <RefreshCw className="w-7 h-7 text-stone-900 animate-spin mx-auto" />
              <div>Verifying token cryptographically...</div>
            </Card>
          ) : scanResult ? (
            <Card padding="md" className="space-y-4 animate-in fade-in duration-200">
              {/* Status Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <Badge
                  variant={
                    scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                      ? 'emerald'
                      : scanResult.status === 'UNASSIGNED_WORKER'
                      ? 'amber'
                      : scanResult.status === 'ALREADY_USED'
                      ? 'rose'
                      : 'neutral'
                  }
                  size="md"
                >
                  {scanResult.status === 'VALID' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {scanResult.status === 'VALID_WORKER' && <UserCheck className="w-3.5 h-3.5" />}
                  {scanResult.status === 'UNASSIGNED_WORKER' && <UserPlus className="w-3.5 h-3.5" />}
                  {scanResult.status === 'ALREADY_USED' && <Clock className="w-3.5 h-3.5" />}
                  {scanResult.status === 'INVALID' && <XCircle className="w-3.5 h-3.5" />}
                  {scanResult.status === 'WRONG_EVENT' && <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>{scanResult.status.replace('_', ' ')}</span>
                </Badge>

                {scanResult.ticket?.sequenceNumber && (
                  <span className="font-mono font-bold text-xs text-stone-900 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200/80">
                    #{scanResult.ticket.sequenceNumber.toString().padStart(5, '0')}
                  </span>
                )}
              </div>

              {/* Message Banner */}
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed ${
                  scanResult.status === 'VALID' || scanResult.status === 'VALID_WORKER'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : scanResult.status === 'UNASSIGNED_WORKER'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}
              >
                {scanResult.message}
              </div>

              {/* Ticket Details */}
              {scanResult.ticket && (
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 space-y-2.5 text-zinc-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Guest Name:</span>
                    <span className="font-bold text-zinc-900 text-sm">
                      {scanResult.ticket.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Category:</span>
                    <Badge variant="neutral" size="sm">
                      {scanResult.ticket.category}
                    </Badge>
                  </div>

                  {scanResult.ticket.organization && (
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Organization:</span>
                      <span className="font-medium text-zinc-800">
                        {scanResult.ticket.organization}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">Usage Policy:</span>
                    <span className="font-mono text-zinc-700">
                      {scanResult.ticket.usagePolicy}
                    </span>
                  </div>

                  {scanResult.ticket.lastCheckinTime && (
                    <div className="flex items-center justify-between pt-2 border-t border-stone-200/70">
                      <span className="text-rose-600 font-semibold">Checked-in At:</span>
                      <span className="font-mono text-rose-700">
                        {new Date(scanResult.ticket.lastCheckinTime).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Unassigned Worker Name Input Form */}
              {scanResult.status === 'UNASSIGNED_WORKER' && (
                <form onSubmit={handleAssignWorkerAndCheckIn} className="space-y-3 pt-2 border-t border-stone-100">
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
                      className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-3 focus:ring-amber-500/20 shadow-2xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={checkingIn}
                    disabled={!workerNameInput.trim()}
                    iconLeft={<UserPlus className="w-4 h-4" />}
                    className="w-full bg-amber-600 hover:bg-amber-700 border-amber-600"
                  >
                    Assign Name & Complete Entry
                  </Button>
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
            </Card>
          ) : (
            /* Idle State Instructions */
            <Card padding="lg" className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200/80 flex items-center justify-center mx-auto text-stone-900 shadow-2xs">
                <TicketIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900">Scanner Ready</h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                Aim device camera at attendee QR pass or enter verification token manually on the left.
              </p>
            </Card>
          )}

          {/* Recent Check-in Feed */}
          <Card padding="md" className="space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>Recent Check-ins ({checkinCount})</span>
              </span>
              <button
                onClick={fetchRecentCheckins}
                className="text-[11px] text-stone-500 hover:text-zinc-900 font-semibold transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5">
              {recentCheckins.length === 0 ? (
                <div className="text-center py-5 text-[11px] text-stone-400">
                  No check-ins recorded yet for this session.
                </div>
              ) : (
                recentCheckins.map((item) => (
                  <div
                    key={item.checkin.id}
                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900">
                        {item.guest?.name || item.checkin.workerNameAssigned || 'Staff'}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        {item.ticketType?.label || item.ticketType?.name}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-stone-700 font-semibold bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/60">
                      {new Date(item.checkin.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
