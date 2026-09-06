import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Ticket as TicketIcon } from 'lucide-react';
import { Ticket } from '../types';

export const VerifyTicket: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{
    status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'INVALID';
    ticket?: Ticket;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setResult({
        status: 'INVALID',
        message: 'No verification token provided.',
      });
      setLoading(false);
      return;
    }

    const fetchVerification = async () => {
      try {
        const res: any = await apiClient.get(`/tickets/verify/${token}`);
        if (res.success && res.data) {
          setResult(res.data);
        } else {
          setResult({
            status: 'INVALID',
            message: res.message || 'Ticket could not be verified.',
          });
        }
      } catch (err: any) {
        setResult({
          status: 'INVALID',
          message: err.message || 'Verification failed.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchVerification();
  }, [token]);

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col justify-between p-4 sm:p-6 font-sans">
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Official Verification Portal
          </div>
          <h1 className="text-xl font-extrabold text-surface-charcoal">Ticketification Verification</h1>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-surface-border p-8 text-center space-y-3 shadow-md">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-surface-muted">Authenticating credential with system records...</p>
          </div>
        ) : result?.status === 'ACTIVE' && result.ticket ? (
          <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-xl relative ticket-perforation-left ticket-perforation-right">
            {/* Status Banner */}
            <div className="flex items-center gap-3 text-emerald-800 bg-emerald-50 p-4 rounded-xl mb-5 border border-emerald-200">
              <CheckCircle2 className="w-9 h-9 shrink-0 text-emerald-600" />
              <div>
                <h2 className="text-lg font-extrabold leading-none">✓ VALID CREDENTIAL</h2>
                <p className="text-xs text-emerald-700 mt-1">This ticket is active and officially recognized.</p>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="space-y-3 text-xs divide-y divide-zinc-100">
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Guest Name</span>
                <span className="font-extrabold text-base text-surface-charcoal">{result.ticket.name}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Ticket ID</span>
                <span className="font-mono font-bold text-sm text-brand-600">{result.ticket.ticketId}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Event</span>
                <span className="font-bold text-zinc-800">{result.ticket.event}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Pass Type</span>
                <span className="font-bold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md">{result.ticket.ticketType}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-dashed border-zinc-200 text-center">
              <span className="text-[11px] text-zinc-400 font-mono">Verified by Ticketification Cryptographic Engine</span>
            </div>
          </div>
        ) : result?.status === 'USED' && result.ticket ? (
          <div className="bg-white rounded-2xl border-2 border-amber-500 p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-800 bg-amber-50 p-4 rounded-xl mb-5 border border-amber-200">
              <AlertTriangle className="w-9 h-9 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-lg font-extrabold leading-none">⚠ ALREADY CHECKED IN</h2>
                <p className="text-xs text-amber-700 mt-1">This ticket has already been used for event entry.</p>
              </div>
            </div>

            <div className="space-y-3 text-xs divide-y divide-zinc-100">
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Guest Name</span>
                <span className="font-bold text-surface-charcoal">{result.ticket.name}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Ticket ID</span>
                <span className="font-mono font-bold text-amber-700">{result.ticket.ticketId}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-surface-muted font-medium">Checked In At</span>
                <span className="font-semibold text-zinc-800 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {result.ticket.usedAt ? new Date(result.ticket.usedAt).toLocaleTimeString() : 'Earlier'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-rose-500 p-6 shadow-xl text-center space-y-4">
            <XCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <div>
              <h2 className="text-lg font-extrabold text-rose-900 uppercase">✕ INVALID TICKET</h2>
              <p className="text-xs text-surface-muted mt-1.5 max-w-xs mx-auto">
                {result?.message || 'This credential is not recognized by the system or has been cancelled.'}
              </p>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            to="/"
            className="text-xs font-semibold text-surface-muted hover:text-brand-600 transition-colors inline-flex items-center gap-1.5"
          >
            <TicketIcon className="w-3.5 h-3.5" /> Return to Ticketification Console
          </Link>
        </div>
      </div>
    </div>
  );
};
