import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrScanner } from '../components/scanner/QrScanner';
import { apiClient } from '../api/client';
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, Clock, ShieldCheck, UserCheck, Ticket as TicketIcon } from 'lucide-react';
import { Ticket } from '../types';

export const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'INVALID';
    ticket?: Ticket;
    message?: string;
  } | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const handleScanSuccess = async (scannedPayload: string) => {
    // Extract token if scanned payload is a URL (e.g. https://.../verify/<TOKEN> or /api/tickets/verify/<TOKEN>)
    let token = scannedPayload.trim();
    if (token.includes('/verify/')) {
      const parts = token.split('/verify/');
      token = parts[parts.length - 1];
    }
    token = token.split('?')[0].split('#')[0].replace(/\/+$/, '').trim();

    setVerifying(true);
    setScanResult(null);
    setCheckInSuccess(null);
    setCheckInError(null);

    try {
      const res: any = await apiClient.get(`/tickets/verify/${token}`);
      if (res.success && res.data) {
        setScanResult(res.data);
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

  const handleCheckIn = async (ticketId: string) => {
    setCheckingIn(true);
    setCheckInError(null);
    try {
      const res: any = await apiClient.post(`/tickets/check-in/${ticketId}`, {
        verifiedBy: 'Admin Scanner',
      });
      if (res.success) {
        setCheckInSuccess(`✓ TICKET CHECKED IN SUCCESSFULLY! Guest marked as entered.`);
        // Update local status representation
        if (scanResult?.ticket) {
          setScanResult({
            ...scanResult,
            status: 'USED',
            ticket: {
              ...scanResult.ticket,
              status: 'USED',
              usedAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err: any) {
      setCheckInError(err.message || 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setCheckInSuccess(null);
    setCheckInError(null);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Top Controls & Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-surface-charcoal flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-600" /> Event-Day Scanner
          </h1>
          <p className="text-xs text-surface-muted">Scan QR tickets or enter verification tokens for instant entry.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/tickets')}
            className="text-xs font-semibold text-zinc-600 hover:text-surface-charcoal bg-white border border-surface-border px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <TicketIcon className="w-3.5 h-3.5" /> Tickets
          </button>

          {scanResult && (
            <button
              onClick={resetScanner}
              className="bg-surface-charcoal hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Next Ticket
            </button>
          )}
        </div>
      </div>

      {verifying && (
        <div className="p-6 bg-white rounded-2xl border border-surface-border text-center text-xs font-semibold text-surface-charcoal animate-pulse shadow-sm">
          Verifying ticket token with server...
        </div>
      )}

      {/* Camera Scanner View when no active result card */}
      {!scanResult && !verifying && <QrScanner onScanSuccess={handleScanSuccess} />}

      {/* Verification Result Card */}
      {scanResult && !verifying && (
        <div className="space-y-4">
          {/* Active / Valid State */}
          {scanResult.status === 'ACTIVE' && scanResult.ticket && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-lg ticket-perforation-left ticket-perforation-right relative">
              <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 p-4 rounded-xl mb-6">
                <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-extrabold leading-none">✓ VALID TICKET</h2>
                  <p className="text-xs text-emerald-800 mt-1">Ticket verified & active. Ready for check-in.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted font-medium">Guest Name</span>
                  <span className="font-extrabold text-sm text-surface-charcoal">{scanResult.ticket.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted font-medium">Ticket ID</span>
                  <span className="font-mono font-bold text-brand-600">{scanResult.ticket.ticketId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted font-medium">Event</span>
                  <span className="font-semibold text-zinc-800">{scanResult.ticket.event}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted font-medium">Pass Type</span>
                  <span className="font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">{scanResult.ticket.ticketType}</span>
                </div>
              </div>

              {checkInSuccess && (
                <div className="mb-4 p-3 bg-emerald-100 text-emerald-900 font-bold rounded-xl text-xs flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-700" /> {checkInSuccess}
                </div>
              )}

              {checkInError && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-800 font-bold rounded-xl text-xs">
                  {checkInError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleCheckIn(scanResult.ticket!._id)}
                  disabled={checkingIn || !!checkInSuccess}
                  className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UserCheck className="w-5 h-5" /> {checkingIn ? 'Checking In...' : 'Mark as Used'}
                </button>
                <button
                  onClick={resetScanner}
                  className="px-4 py-4 bg-zinc-100 hover:bg-zinc-200 text-surface-charcoal font-bold text-sm rounded-xl transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Already Used State */}
          {scanResult.status === 'USED' && scanResult.ticket && (
            <div className="bg-white rounded-2xl border-2 border-amber-500 p-6 shadow-lg">
              <div className="flex items-center gap-3 text-amber-800 bg-amber-50 p-4 rounded-xl mb-6 border border-amber-200">
                <AlertTriangle className="w-8 h-8 shrink-0 text-amber-600" />
                <div>
                  <h2 className="text-lg font-extrabold leading-none">⚠ ALREADY USED</h2>
                  <p className="text-xs text-amber-900 mt-1">This ticket has already been checked in.</p>
                </div>
              </div>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted">Guest Name</span>
                  <span className="font-bold text-surface-charcoal">{scanResult.ticket.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted">Ticket Reference</span>
                  <span className="font-mono font-bold text-amber-700">{scanResult.ticket.ticketId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100">
                  <span className="text-surface-muted">Checked In At</span>
                  <span className="font-semibold text-zinc-900 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {scanResult.ticket.usedAt ? new Date(scanResult.ticket.usedAt).toLocaleTimeString() : 'Earlier'}
                  </span>
                </div>
              </div>

              <button
                onClick={resetScanner}
                className="w-full py-3.5 bg-surface-charcoal hover:bg-black text-white font-bold text-sm rounded-xl transition-colors"
              >
                Return to Scanner
              </button>
            </div>
          )}

          {/* Invalid / Cancelled / Not Found State */}
          {(scanResult.status === 'INVALID' || scanResult.status === 'CANCELLED' || scanResult.status === 'EXPIRED') && (
            <div className="bg-white rounded-2xl border-2 border-rose-500 p-6 shadow-lg text-center">
              <XCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
              <h2 className="text-lg font-extrabold text-rose-900 uppercase">
                ✕ {scanResult.status} TICKET
              </h2>
              <p className="text-xs text-surface-muted mt-2 max-w-xs mx-auto">
                {scanResult.message || 'Ticket record is invalid, cancelled, or not recognized.'}
              </p>

              <button
                onClick={resetScanner}
                className="mt-6 w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors"
              >
                Scan Next Ticket
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
