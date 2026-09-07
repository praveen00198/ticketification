import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { apiClient } from '../api/client';
import {
  QrCode,
  FileSpreadsheet,
  Ticket,
  Users,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();

  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!currentEvent) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res: any = await apiClient.get('/dashboard/stats', {
        params: { eventId: currentEvent.id },
      });
      if (res.success && res.data) {
        setStats(res.data.stats);
        setRecentActivity(res.data.recentActivity || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [currentEvent]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (!currentEvent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-surface-card border border-zinc-800 rounded-2xl p-8 space-y-4">
        <div className="w-14 h-14 bg-zinc-800 text-brand-400 rounded-full flex items-center justify-center mx-auto mb-2">
          <Calendar className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Welcome to Ticketification</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Create or select an event to unlock guest importing, verified ticket generation, and mobile scanning.
        </p>
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20"
        >
          <Calendar className="w-4 h-4" />
          <span>Create / Select Event</span>
        </button>
      </div>
    );
  }

  const total = stats?.totalGuests || 0;
  const used = stats?.ticketsUsed || 0;
  const generated = stats?.ticketsGenerated || 0;
  const active = stats?.ticketsActive || 0;
  const checkinRate = generated > 0 ? Math.round((used / generated) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-surface-card border border-zinc-800/80 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Operational Console</span>
            </span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs font-semibold text-zinc-300">
              Active Event: <span className="text-white font-bold">{currentEvent.name}</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Event Ticketing & Entry Control
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Import Excel guest data, batch generate verified QR credentials, and manage attendee check-ins on event day.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-bold px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-xs"
          >
            <KeyRound className="w-4 h-4 text-brand-400" />
            <span>Password</span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 text-xs active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            <span>Launch Scanner</span>
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-card border border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
            <span>Total Guests</span>
            <Users className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-black text-white">{total}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Imported in guest list</div>
        </div>

        <div className="bg-surface-card border border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
            <span>Tickets Generated</span>
            <Ticket className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{generated}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Cryptographic QR issued</div>
        </div>

        <div className="bg-surface-card border border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold mb-2">
            <span>Checked In</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{used}</div>
          <div className="text-[11px] text-zinc-500 mt-1">{checkinRate}% turnout rate</div>
        </div>

        <div className="bg-surface-card border border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
            <span>Remaining Passes</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-zinc-200">{active}</div>
          <div className="text-[11px] text-zinc-500 mt-1">Active for entry</div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/import')}
          className="group bg-surface-card border border-zinc-800/80 hover:border-brand-500/50 p-5 rounded-2xl cursor-pointer transition-all shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-brand-300">
                Import Guest Data
              </div>
              <div className="text-[11px] text-zinc-400">Excel / CSV Smart Wizard</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </div>

        <div
          onClick={() => navigate('/tickets')}
          className="group bg-surface-card border border-zinc-800/80 hover:border-brand-500/50 p-5 rounded-2xl cursor-pointer transition-all shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-blue-300">
                View & Generate Tickets
              </div>
              <div className="text-[11px] text-zinc-400">Manage credentials & passes</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </div>

        <div
          onClick={() => navigate('/scan')}
          className="group bg-surface-card border border-zinc-800/80 hover:border-brand-500/50 p-5 rounded-2xl cursor-pointer transition-all shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                Live Scanner Station
              </div>
              <div className="text-[11px] text-zinc-400">Scan & verify attendee QR</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-surface-card border border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-400" />
            <span>Recent Generated Credentials</span>
          </h2>
          <button
            onClick={fetchDashboard}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">
            No credentials generated yet for this event.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3"># Seq</th>
                  <th className="py-2.5 px-3">Guest Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recentActivity.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-brand-400">
                      #{t.sequenceNumber?.toString().padStart(5, '0')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{t.name || 'Staff Member'}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{t.email || t.phone || '—'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px]">
                      {new Date(t.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
