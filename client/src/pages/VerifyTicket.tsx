import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyApi, VerificationResponse } from '../api/verify';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export const VerifyTicket: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setResult({
        status: 'INVALID',
        message: 'No verification token provided in URL.',
      });
      setLoading(false);
      return;
    }

    const fetchVerification = async () => {
      try {
        const res = await verifyApi.publicVerify(token);
        setResult(res);
      } catch (err: any) {
        setResult({
          status: 'INVALID',
          message: err.message || 'Ticket could not be verified.',
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Official Verification Portal
          </div>
          <h1 className="text-xl font-black text-white">Ticket Verification</h1>
        </div>

        {loading ? (
          <div className="bg-surface-card rounded-2xl border border-zinc-800 p-8 text-center space-y-3 shadow-md">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-zinc-400">
              Authenticating cryptographic signature...
            </p>
          </div>
        ) : (result?.status === 'VALID' || result?.status === 'VALID_WORKER') && result.ticket ? (
          <div className="bg-surface-card rounded-2xl border-2 border-emerald-500/80 p-6 shadow-xl space-y-5">
            {/* Status Banner */}
            <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8 shrink-0 text-emerald-400" />
              <div>
                <h2 className="text-base font-black leading-none">✓ VALID CREDENTIAL</h2>
                <p className="text-xs text-emerald-300 mt-1">
                  {result.status === 'VALID_WORKER'
                    ? 'Active reusable worker pass recognized.'
                    : 'This ticket is valid and officially recognized.'}
                </p>
              </div>
            </div>

            {/* Ticket Details */}
            <div className="space-y-3 text-xs divide-y divide-zinc-800/80">
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 font-medium">Guest Name</span>
                <span className="font-bold text-base text-white">{result.ticket.name}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 font-medium">Pass Sequence</span>
                <span className="font-mono font-bold text-sm text-brand-400">
                  #{result.ticket.sequenceNumber?.toString().padStart(5, '0')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 font-medium">Event</span>
                <span className="font-bold text-zinc-200">{result.ticket.eventName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-400 font-medium">Category</span>
                <span className="font-bold text-brand-300 bg-brand-500/10 px-2.5 py-0.5 rounded-md border border-brand-500/20">
                  {result.ticket.category}
                </span>
              </div>
              {result.ticket.organization && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400 font-medium">Organization</span>
                  <span className="font-semibold text-zinc-300">{result.ticket.organization}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-dashed border-zinc-800 text-center">
              <span className="text-[10px] text-zinc-500 font-mono">
                Verified by Ticketification Cryptographic Engine
              </span>
            </div>
          </div>
        ) : result?.status === 'ALREADY_USED' ? (
          <div className="bg-surface-card rounded-2xl border-2 border-rose-500/80 p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400 bg-rose-500/10 p-4 rounded-xl border border-rose-500/20">
              <Clock className="w-8 h-8 shrink-0 text-rose-400" />
              <div>
                <h2 className="text-base font-black leading-none">ALREADY USED</h2>
                <p className="text-xs text-rose-300 mt-1">{result.message}</p>
              </div>
            </div>

            {result.ticket && (
              <div className="space-y-3 text-xs divide-y divide-zinc-800/80">
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400 font-medium">Guest Name</span>
                  <span className="font-bold text-white">{result.ticket.name}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-zinc-400 font-medium">Category</span>
                  <span className="font-bold text-zinc-300">{result.ticket.category}</span>
                </div>
                {result.ticket.lastCheckinTime && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-zinc-400 font-medium">Checked In At</span>
                    <span className="font-mono text-rose-400">
                      {new Date(result.ticket.lastCheckinTime).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl border border-zinc-800 p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white">Verification Failed</h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">{result?.message}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-zinc-500">
          <Link to="/" className="text-brand-400 hover:underline">
            Go to Admin Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
