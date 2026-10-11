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
  Compass,
  Wallet,
  Sparkles,
  Settings,
} from 'lucide-react';
import { ChangePasswordModal } from '../components/auth/ChangePasswordModal';
import { Button, Card, Badge, StatCard, InView, AnimatedGroup } from '../components/ui';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentEvent, events, setCurrentEvent } = useEvent();

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
      <div className="max-w-4xl mx-auto space-y-6">
        <InView direction="up" distance={16}>
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-emerald-100/80 shadow-2xs">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <Badge variant="emerald" className="mb-2">Operational Command Center</Badge>
              <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
                Welcome to Ticketification
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 max-w-lg mx-auto leading-relaxed mt-1">
                Your unified platform for event discovery, digital credentialing, and live turnstile operations. Select an action below or pick an existing event:
              </p>
            </div>

            {events.length > 0 && (
              <div className="pt-2 pb-2 max-w-md mx-auto">
                <p className="text-xs font-semibold text-stone-500 mb-2">Switch to an existing event:</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {events.slice(0, 4).map((e) => (
                    <Button
                      key={e.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentEvent(e)}
                      iconLeft={<Calendar className="w-3.5 h-3.5 text-emerald-600" />}
                    >
                      <span className="truncate max-w-[140px]">{e.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
              <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 bg-stone-50/50 hover:bg-white transition-all flex flex-col justify-between space-y-4 shadow-2xs group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200/80 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900">Host an Event</h4>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Configure custom credentials, guest imports, turnstile scanning, and judging rubrics.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/events/create')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                  className="w-full"
                >
                  Create Event Wizard
                </Button>
              </div>

              <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 bg-stone-50/50 hover:bg-white transition-all flex flex-col justify-between space-y-4 shadow-2xs group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3 border border-sky-200/80 group-hover:scale-105 transition-transform">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900">Explore Catalog</h4>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Discover upcoming hackathons, conferences, and workshops open for attendance.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/explore')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                  className="w-full"
                >
                  Explore Events
                </Button>
              </div>

              <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 bg-stone-50/50 hover:bg-white transition-all flex flex-col justify-between space-y-4 shadow-2xs group">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 border border-amber-200/80 group-hover:scale-105 transition-transform">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900">My Pass Wallet</h4>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    View your confirmed registrations, scannable QR tokens, and team rosters.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/wallet')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                  className="w-full"
                >
                  Open Wallet
                </Button>
              </div>
            </div>
          </div>
        </InView>
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
      {/* Top Operational Header */}
      <InView direction="up" distance={12}>
        <div className="bg-white border border-stone-200/90 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 shadow-xs">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="emerald" dot>Operational Console</Badge>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs font-semibold text-stone-600 truncate">
                Active: <span className="text-zinc-900 font-bold">{currentEvent.name}</span>
              </span>
              {currentEvent.status && (
                <Badge variant={currentEvent.status === 'PUBLISHED' ? 'emerald' : 'neutral'} size="sm">
                  {currentEvent.status}
                </Badge>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
              Event Ticketing & Entry Control
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
              Import guest lists, batch-generate tamper-proof QR passes, and oversee high-throughput turnstiles in real-time.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/events/${currentEvent.id}`)}
              iconLeft={<Settings className="w-3.5 h-3.5 text-stone-500" />}
            >
              Manage Event
            </Button>

            <Button
              variant="neutral"
              size="sm"
              onClick={() => setIsChangePasswordOpen(true)}
              iconLeft={<KeyRound className="w-3.5 h-3.5 text-stone-500" />}
            >
              Password
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/scan')}
              iconLeft={<QrCode className="w-4 h-4" />}
            >
              Launch Scanner
            </Button>
          </div>
        </div>
      </InView>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Metrics Row (4-card grid, responsive 2 cols on mobile, 4 on desktop) */}
      <AnimatedGroup staggerDelay={70} className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Guests"
          value={total}
          icon={<Users className="w-4 h-4" />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
          subtext="Imported in guest roster"
        />

        <StatCard
          label="Passes Issued"
          value={generated}
          icon={<Ticket className="w-4 h-4" />}
          iconBg="bg-blue-50"
          iconColor="text-blue-700"
          subtext="Cryptographic QR passes"
        />

        <StatCard
          label="Checked In"
          value={used}
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
          badge={
            <Badge variant="emerald" size="sm">
              {checkinRate}% Turnout
            </Badge>
          }
          subtext={`${checkinRate}% turnout rate`}
        />

        <StatCard
          label="Remaining Passes"
          value={active}
          icon={<Clock className="w-4 h-4" />}
          iconBg="bg-amber-50"
          iconColor="text-amber-700"
          subtext="Active for entry scan"
        />
      </AnimatedGroup>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          onClick={() => navigate('/import')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/import')}
          className="group bg-white border border-stone-200/90 hover:border-emerald-500/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/80 group-hover:scale-105 transition-transform shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors truncate">
                Import Guest Data
              </div>
              <div className="text-[11px] text-stone-400 truncate">Excel & CSV Upload Wizard</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors shrink-0 ml-2" />
        </div>

        <div
          onClick={() => navigate('/tickets')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/tickets')}
          className="group bg-white border border-stone-200/90 hover:border-blue-500/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100/80 group-hover:scale-105 transition-transform shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition-colors truncate">
                View & Generate Tickets
              </div>
              <div className="text-[11px] text-stone-400 truncate">Credentials & ZIP Export</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
        </div>

        <div
          onClick={() => navigate('/scan')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/scan')}
          className="group bg-white border border-stone-200/90 hover:border-emerald-500/80 p-4 sm:p-5 rounded-2xl cursor-pointer transition-all shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/80 group-hover:scale-105 transition-transform shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors truncate">
                Turnstiles Scanner
              </div>
              <div className="text-[11px] text-stone-400 truncate">High-throughput gate scanner</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors shrink-0 ml-2" />
        </div>
      </div>

      {/* Recent Activity Table */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="text-xs sm:text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Recent Generated Credentials</span>
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDashboard}
            iconLeft={<RefreshCw className={`w-3.5 h-3.5 text-stone-400 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-xs text-stone-400">
            No credentials generated yet for this event. Use &quot;Import Guest Data&quot; to begin.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-left text-xs divide-y divide-stone-100">
                <thead>
                  <tr className="text-stone-400 uppercase font-mono text-[10px] bg-stone-50/50">
                    <th className="py-2.5 px-3 font-semibold"># Seq</th>
                    <th className="py-2.5 px-3 font-semibold">Guest Name</th>
                    <th className="py-2.5 px-3 font-semibold">Contact</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 bg-white">
                  {recentActivity.map((t) => (
                    <tr key={t.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        #{t.sequenceNumber?.toString().padStart(5, '0')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-zinc-900">{t.name || 'Staff Member'}</td>
                      <td className="py-2.5 px-3 text-stone-600">{t.email || t.phone || '—'}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={t.status === 'ACTIVE' ? 'emerald' : 'neutral'}
                          size="sm"
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-stone-400 font-mono text-[11px]">
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
