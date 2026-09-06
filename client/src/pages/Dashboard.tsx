import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, FileSpreadsheet, Ticket, Users, CheckCircle2, RefreshCw, KeyRound } from 'lucide-react';
import { apiClient } from '../api/client';
import { DashboardStats } from '../types';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/dashboard/stats');
      if (res.success && res.data) {
        setStats(res.data.stats);
        setRecentActivity(res.data.recentActivity || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const activeCount = stats?.ticketsActive ?? (stats?.ticketsGenerated ? (stats.ticketsGenerated - (stats.ticketsUsed || 0)) : 0);

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden gap-6">
        <div className="z-10">
          <span className="text-xs font-semibold text-brand-500 tracking-widest block mb-2">
            Event Operations Console, Ticketification.
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide">
            Ticketing & Entry Operational Control
          </h1>
          <p className="text-sm text-zinc-600 mt-2 max-w-2xl">
            Import guest lists, generate personalized image tickets with scannable QR credentials, download individual or bulk tickets, and conduct entry scans on event day.
          </p>
        </div>

        {/* Action Buttons: Scan & Verify + Change Password */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className="bg-white hover:bg-zinc-50 text-surface-charcoal border border-surface-border font-bold px-4 py-3.5 rounded-2xl shadow-sm transition-all flex items-center gap-2 text-xs"
          >
            <KeyRound className="w-4 h-4 text-brand-600" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="bg-brand-600 hover:bg-brand-700 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-3 shrink-0 border border-brand-500/40"
          >
            <QrCode className="w-5 h-5" />
            <div className="text-left">
              <div className="text-[10px] text-brand-100 tracking-wider font-semibold">Event Day Action</div>
              <div className="text-sm font-semibold leading-none mt-0.5">Scan & Verify Ticket</div>
            </div>
          </button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Operational Statistics */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-surface-charcoal">Operational Summary</h2>
          <button
            onClick={fetchDashboard}
            className="text-xs text-surface-muted hover:text-surface-charcoal flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-semibold uppercase">Total Guests</span>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-extrabold text-surface-charcoal">
              {stats?.totalGuests ?? 0}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-semibold uppercase">Generated Tickets</span>
              <Ticket className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-2xl font-extrabold text-surface-charcoal">
              {stats?.ticketsGenerated ?? 0}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-semibold uppercase">Active / Valid</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-600">
              {activeCount}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 mb-2">
              <span className="text-xs font-semibold uppercase">Checked In</span>
              <CheckCircle2 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-amber-600">
              {stats?.ticketsUsed ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/import')}
          className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm cursor-pointer transition-all hover:border-brand-500/50 hover:shadow-md group"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-brand-50 text-zinc-700 group-hover:text-brand-600 flex items-center justify-center mb-4 transition-colors">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-surface-charcoal mb-1">Import Excel Guest List</h3>
          <p className="text-xs text-surface-muted leading-relaxed">
            Upload .xlsx guest spreadsheet, run contact validation checks, preview clean records, and batch generate image tickets.
          </p>
        </div>

        <div
          onClick={() => navigate('/tickets')}
          className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm cursor-pointer transition-all hover:border-brand-500/50 hover:shadow-md group"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-brand-50 text-zinc-700 group-hover:text-brand-600 flex items-center justify-center mb-4 transition-colors">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-surface-charcoal mb-1">View & Download Tickets</h3>
          <p className="text-xs text-surface-muted leading-relaxed">
            Manage existing ticket database, download all tickets in bulk (ZIP), or download individual tickets on hover.
          </p>
        </div>

        <div
          onClick={() => navigate('/scan')}
          className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm cursor-pointer transition-all hover:border-brand-500/50 hover:shadow-md group"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-100 group-hover:bg-brand-50 text-zinc-700 group-hover:text-brand-600 flex items-center justify-center mb-4 transition-colors">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-surface-charcoal mb-1">Event Entry Scanner</h3>
          <p className="text-xs text-surface-muted leading-relaxed">
            Use smartphone camera to scan guest QR tokens or enter reference IDs to execute instantaneous check-ins.
          </p>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-surface-border shadow-sm p-6">
        <h3 className="font-bold text-base text-surface-charcoal mb-4">Recent Issued Tickets</h3>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-surface-muted">
            No tickets issued yet. Start by importing your guest list.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-surface-muted font-semibold uppercase">
                  <th className="pb-3">Ticket Reference</th>
                  <th className="pb-3">Guest Name</th>
                  <th className="pb-3">Contact</th>
                  <th className="pb-3">Ticket Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {recentActivity.map((t) => {
                  return (
                    <tr key={t.id} className="hover:bg-surface-bg/50">
                      <td className="py-3 font-mono font-bold text-brand-600">{t.ticketId}</td>
                      <td className="py-3 font-medium text-surface-charcoal">{t.name}</td>
                      <td className="py-3 text-surface-muted">{t.phone || t.email || '—'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded font-semibold ${
                          t.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          t.status === 'USED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
