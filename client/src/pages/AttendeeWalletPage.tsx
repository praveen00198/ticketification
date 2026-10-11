import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  QrCode,
  Download,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Users,
  Code2,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  Compass,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { attendeeApi, AttendeeWalletItem, AttendeeTeamData } from '../api/attendee';
import QRCode from 'qrcode';

export const AttendeeWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<AttendeeWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_IN'>('ALL');

  // QR Inspection Modal state
  const [selectedPassForQr, setSelectedPassForQr] = useState<AttendeeWalletItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPassForQr) {
      const url = `${window.location.origin}/verify/${selectedPassForQr.verificationToken}`;
      QRCode.toDataURL(url, { width: 220, margin: 1 })
        .then((dataUri) => setQrDataUrl(dataUri))
        .catch((err) => console.error('Failed to generate QR data URL:', err));
    } else {
      setQrDataUrl(null);
    }
  }, [selectedPassForQr]);

  // Teaming Workspace state
  const [activeTeamEvent, setActiveTeamEvent] = useState<AttendeeWalletItem | null>(null);
  const [teamData, setTeamData] = useState<AttendeeTeamData | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  // Team creation / joining inputs
  const [teamAction, setTeamAction] = useState<'VIEW' | 'CREATE' | 'JOIN'>('VIEW');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTrack, setNewTeamTrack] = useState('General');
  const [joinTeamNameOrId, setJoinTeamNameOrId] = useState('');

  // Project submission inputs
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');

  // Cancellation Modal state
  const [cancelPassTarget, setCancelPassTarget] = useState<AttendeeWalletItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await attendeeApi.getWallet();
      if (res.success && Array.isArray(res.data)) {
        setWallet(res.data);
      } else {
        setWallet([]);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load attendee wallet.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const openTeamWorkspace = async (pass: AttendeeWalletItem) => {
    setActiveTeamEvent(pass);
    setTeamLoading(true);
    setTeamError(null);
    setTeamSuccess(null);
    setTeamAction('VIEW');

    try {
      const res = await attendeeApi.getMyTeam(pass.eventId);
      if (res.success && res.data) {
        setTeamData(res.data);
        setProjectTitle(res.data.projectTitle || '');
        setProjectDescription(res.data.projectDescription || '');
        setRepoUrl(res.data.repoUrl || '');
        setDemoUrl(res.data.demoUrl || '');
      } else {
        setTeamData(null);
      }
    } catch (err: any) {
      setTeamError(err?.response?.data?.error?.message || 'Failed to load team details');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamEvent) return;
    setTeamLoading(true);
    setTeamError(null);

    try {
      const res = await attendeeApi.createTeam(activeTeamEvent.eventId, {
        teamName: newTeamName,
        track: newTeamTrack,
      });
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamAction('VIEW');
        setTeamSuccess(`Team "${res.data.teamName}" created successfully!`);
      }
    } catch (err: any) {
      setTeamError(err?.response?.data?.error?.message || err?.message || 'Failed to create team');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamEvent) return;
    setTeamLoading(true);
    setTeamError(null);

    try {
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(joinTeamNameOrId.trim());
      const payload = isMongoId
        ? { teamId: joinTeamNameOrId.trim() }
        : { teamName: joinTeamNameOrId.trim() };

      const res = await attendeeApi.joinTeam(activeTeamEvent.eventId, payload);
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamAction('VIEW');
        setTeamSuccess(`Successfully joined team "${res.data.teamName}"!`);
      }
    } catch (err: any) {
      setTeamError(err?.response?.data?.error?.message || err?.message || 'Failed to join team');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamEvent) return;
    setTeamLoading(true);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      const res = await attendeeApi.submitProject(activeTeamEvent.eventId, {
        projectTitle,
        projectDescription,
        repoUrl,
        demoUrl,
      });
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamSuccess('Project details saved successfully!');
      }
    } catch (err: any) {
      setTeamError(err?.response?.data?.error?.message || err?.message || 'Failed to submit project');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCancelPass = async () => {
    if (!cancelPassTarget) return;
    setCancelling(true);

    try {
      const res = await attendeeApi.cancelRegistration(cancelPassTarget.eventId);
      if (res.success) {
        setWallet((prev) => prev.filter((p) => p.credentialId !== cancelPassTarget.credentialId));
        setCancelPassTarget(null);
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || err?.message || 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  const filteredWallet = wallet.filter((item) => {
    if (filter === 'ACTIVE') return item.status === 'ACTIVE';
    if (filter === 'CHECKED_IN') return item.status === 'CHECKED_IN';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                  My Credential Wallet
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold">
                  {wallet.length} {wallet.length === 1 ? 'Pass' : 'Passes'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Your personal tamper-proof passes, dynamic QR entry tokens, and team workspaces.
              </p>
            </div>
          </div>

          {/* Filter Pills & Actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-100 border border-stone-200">
              {(['ALL', 'ACTIVE', 'CHECKED_IN'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === mode
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-stone-500 hover:text-zinc-900'
                  }`}
                >
                  {mode === 'ALL' ? 'All Passes' : mode === 'ACTIVE' ? 'Active' : 'Checked In'}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigate('/explore')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Events</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-rose-700 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchWallet}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-800 font-semibold hover:bg-rose-50"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400 bg-white border border-stone-200/90 rounded-2xl p-8">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold text-stone-500">Loading your verified passes...</p>
          </div>
        ) : filteredWallet.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center rounded-2xl bg-white border border-stone-200/90 p-8 space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                {filter === 'ALL'
                  ? 'Your pass wallet is currently empty'
                  : `No ${filter.toLowerCase()} passes found`}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                When you register for an event on Ticketification, your verified pass with an anti-collision QR token is automatically stored here.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/explore')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Events to Attend</span>
              </button>
              <button
                onClick={() => navigate('/events/create')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all border border-stone-200"
              >
                <Sparkles className="w-4 h-4 text-stone-500" />
                <span>Host Your Own Event</span>
              </button>
            </div>
          </div>
        ) : (
          /* Passes Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredWallet.map((pass) => {
              const isHackathon = ['HACKATHON', 'COMPETITION', 'COLLEGE_EVENT'].includes(
                pass.eventType.toUpperCase()
              );

              return (
                <div
                  key={pass.credentialId}
                  className="rounded-2xl bg-white border border-stone-200/90 hover:border-emerald-500/50 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Bar with Category & Status */}
                  <div className="p-4 px-5 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                        {pass.eventType.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono font-bold text-stone-500">
                        {pass.formattedId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          pass.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : pass.status === 'CHECKED_IN'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-stone-100 text-stone-500 border border-stone-200'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" /> {pass.status}
                      </span>
                    </div>
                  </div>

                  {/* Pass Body */}
                  <div className="p-5 space-y-4 flex-1">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                        {pass.eventName}
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {pass.credentialTerminology} • {pass.holder.category || 'Attendee'}
                      </p>
                    </div>

                    {/* Schedule & Venue Meta */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {pass.schedule?.startAt
                            ? new Date(pass.schedule.startAt).toLocaleDateString()
                            : 'Date TBA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {pass.venue?.city || pass.venue?.name || 'Venue TBA'}
                        </span>
                      </div>
                    </div>

                    {/* Holder Info */}
                    <div className="text-xs text-stone-500 border-t border-stone-100 pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">
                          Pass Holder
                        </span>
                        <span className="text-zinc-900 font-semibold">{pass.holder.name}</span>
                      </div>
                      {pass.holder.organization && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">
                            Organization
                          </span>
                          <span className="text-zinc-700">{pass.holder.organization}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pass Actions Footer */}
                  <div className="p-4 bg-stone-50/70 border-t border-stone-200/90 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPassForQr(pass)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" /> View QR
                      </button>

                      {pass.asset?.publicUrl && (
                        <a
                          href={pass.asset.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={`${pass.formattedId}.png`}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-stone-500" /> Pass PNG
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isHackathon && (
                        <button
                          onClick={() => openTeamWorkspace(pass)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-600" /> Team Hub
                        </button>
                      )}

                      <button
                        onClick={() => setCancelPassTarget(pass)}
                        title="Cancel Registration"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QR Inspection Modal */}
      {selectedPassForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center shadow-xl relative">
            <button
              onClick={() => setSelectedPassForQr(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-zinc-700 hover:bg-stone-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                {selectedPassForQr.credentialTerminology}
              </span>
              <h3 className="text-base font-bold text-zinc-900 mt-1">
                {selectedPassForQr.eventName}
              </h3>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                {selectedPassForQr.formattedId}
              </p>
            </div>

            {/* High-Contrast QR Code container */}
            <div className="p-4 bg-white rounded-2xl border border-stone-200 inline-block mx-auto min-w-[220px] min-h-[220px] flex items-center justify-center shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Pass Entry QR"
                  className="w-[200px] h-[200px] block mx-auto"
                />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
              )}
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-semibold text-zinc-900">{selectedPassForQr.holder.name}</p>
              <p className="text-[11px] font-mono text-stone-400 truncate max-w-xs mx-auto">
                Token: {selectedPassForQr.verificationToken.slice(0, 16)}...
              </p>
              <p className="text-[11px] text-emerald-700 font-medium pt-1">
                Present this QR code at the event gate scanner for admission.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hackathon Teaming Workspace Modal */}
      {activeTeamEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    Teaming & Project Hub
                  </h3>
                  <p className="text-xs text-stone-500">{activeTeamEvent.eventName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTeamEvent(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-zinc-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {teamError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teamError}</span>
                </div>
              )}

              {teamSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{teamSuccess}</span>
                </div>
              )}

              {teamLoading ? (
                <div className="py-12 flex justify-center text-emerald-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : teamData ? (
                /* Active Team Details & Project Submission */
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                        {teamData.teamName}
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                          {teamData.track || 'General'}
                        </span>
                      </h4>
                      <span className="text-[10px] font-bold uppercase text-stone-500">
                        Status: <span className="text-emerald-700">{teamData.status}</span>
                      </span>
                    </div>

                    <div className="text-xs text-stone-600">
                      <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                        Team Roster ({teamData.members.length}/6)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {teamData.members.map((m, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg bg-white border border-stone-200 flex items-center justify-between"
                          >
                            <div>
                              <span className="text-zinc-900 font-semibold block">{m.name}</span>
                              <span className="text-[10px] text-stone-400">{m.email}</span>
                            </div>
                            <span className="text-[10px] text-emerald-700 font-semibold">
                              {m.role || 'Member'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Project Submission Form */}
                  <form onSubmit={handleProjectSubmit} className="space-y-3 border-t border-stone-200 pt-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-emerald-600" /> Project Submission
                    </h5>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Project Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AI-Powered Fraud Sentinel"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Short Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brief overview of problem and architecture..."
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          GitHub / Code Repository
                        </label>
                        <input
                          type="url"
                          placeholder="https://github.com/..."
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Live Demo / Video URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://demo.app or video link"
                          value={demoUrl}
                          onChange={(e) => setDemoUrl(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 text-right">
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all"
                      >
                        Save Project Submission
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* No Team Yet: Options to Create or Join */
                <div className="space-y-4">
                  <div className="text-center py-4 space-y-1">
                    <p className="text-xs text-stone-500">
                      You are not currently part of a team in this event.
                    </p>
                  </div>

                  <div className="flex justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTeamAction('CREATE')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        teamAction === 'CREATE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Create Team
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamAction('JOIN')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                        teamAction === 'JOIN'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Join Existing Team
                    </button>
                  </div>

                  {teamAction === 'CREATE' && (
                    <form onSubmit={handleCreateTeam} className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Team Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. CodeFoundry"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Challenge Track
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AI / Web3 / Open Innovation"
                          value={newTeamTrack}
                          onChange={(e) => setNewTeamTrack(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
                      >
                        Create Team
                      </button>
                    </form>
                  )}

                  {teamAction === 'JOIN' && (
                    <form onSubmit={handleJoinTeam} className="space-y-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Team Name or Code
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter team name to join"
                          value={joinTeamNameOrId}
                          onChange={(e) => setJoinTeamNameOrId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs"
                      >
                        Join Team
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancelPassTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-bold text-zinc-900">Cancel Registration?</h4>
              <p className="text-xs text-stone-500 mt-1">
                Are you sure you want to surrender your pass for <strong className="text-zinc-800">{cancelPassTarget.eventName}</strong>? Your slot will be released back into event capacity.
              </p>
            </div>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelPassTarget(null)}
                className="w-1/2 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold border border-stone-200 transition-colors"
              >
                Keep Pass
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelPass}
                className="w-1/2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-xs"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendeeWalletPage;
