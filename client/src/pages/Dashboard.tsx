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
  Plus,
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
      <div className="max-w-2xl mx-auto py-16 text-center bg-white border border-stone-200/90 rounded-2xl p-8 space-y-4 shadow-xs">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100">
          <Calendar className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Welcome to Ticketification</h2>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          Create or select an event to unlock guest importing, verified ticket generation, and live turnstile check-ins.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/events/create')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Event</span>
          </button>
          <button
            onClick={() => navigate('/events')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all"
          >
            <Calendar className="w-4 h-4 text-stone-500" />
            <span>View Events Catalog</span>
          </button>
        </div>
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
      <div className="bg-white border border-stone-200/90 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Operational Console</span>
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs font-semibold text-stone-600">
              Active Event: <span className="text-zinc-900 font-bold">{currentEvent.name}</span>
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            Event Ticketing & Entry Control
          </h1>
          <p className="text-xs text-stone-500 mt-1 max-w-xl">
            Import guest lists, batch-generate tamper-proof QR passes, and oversee high-throughput turnstiles in real-time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="bg-stone-100 hover:bg-stone-200 text-zinc-700 border border-stone-200 font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 text-xs"
          >
            <KeyRound className="w-3.5 h-3.5 text-stone-500" />
            <span>Password</span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-2 text-xs active:scale-95"
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
        <div className="bg-white border border-stone-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Total Guests</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-zinc-900">{total}</div>
          <div className="text-[11px] text-stone-400 mt-1">Imported in guest roster</div>
        </div>

        <div className="bg-white border border-stone-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Passes Issued</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-zinc-900">{generated}</div>
          <div className="text-[11px] text-stone-400 mt-1">Cryptographic QR passes</div>
        </div>

        <div className="bg-white border border-stone-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold mb-2">
            <span>Checked In</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{used}</div>
          <div className="text-[11px] text-stone-400 mt-1">{checkinRate}% turnout rate</div>
        </div>

        <div className="bg-white border border-stone-200/90 p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
            <span>Remaining Passes</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-zinc-900">{active}</div>
          <div className="text-[11px] text-stone-400 mt-1">Active for entry scan</div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => navigate('/import')}
          className="group bg-white border border-stone-200/90 hover:border-emerald-500/80 p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                Import Guest Data
              </div>
              <div className="text-[11px] text-stone-400">Excel & CSV Upload Wizard</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors" />
        </div>

        <div
          onClick={() => navigate('/tickets')}
          className="group bg-white border border-stone-200/90 hover:border-blue-500/80 p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition-colors">
                View & Generate Tickets
              </div>
              <div className="text-[11px] text-stone-400">Manage credentials & export</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600 transition-colors" />
        </div>

        <div
          onClick={() => navigate('/scan')}
          className="group bg-white border border-stone-200/90 hover:border-emerald-500/80 p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                Turnstiles Scanner
              </div>
              <div className="text-[11px] text-stone-400">Fast sub-200ms scan engine</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors" />
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Recent Generated Credentials</span>
          </h2>
          <button
            onClick={fetchDashboard}
            className="text-xs text-stone-500 hover:text-zinc-900 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-stone-400">
            No credentials generated yet for this event.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200/80 text-stone-400 uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3"># Seq</th>
                  <th className="py-2.5 px-3">Guest Name</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentActivity.map((t) => (
                  <tr key={t.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                      #{t.sequenceNumber?.toString().padStart(5, '0')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-zinc-900">{t.name || 'Staff Member'}</td>
                    <td className="py-2.5 px-3 text-stone-600">{t.email || t.phone || '—'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : 'bg-stone-100 text-stone-600 border border-stone-200'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-stone-400 font-mono text-[11px]">
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
