import React, { useState, useEffect } from 'react';
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
  Plus,
} from 'lucide-react';
import { attendeeApi, AttendeeWalletItem, AttendeeTeamData } from '../api/attendee';
import QRCode from 'qrcode';

export const AttendeeWalletPage: React.FC = () => {
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
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load attendee wallet');
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
      const res = await attendeeApi.joinTeam(activeTeamEvent.eventId, {
        teamName: joinTeamNameOrId,
      });
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

    try {
      const res = await attendeeApi.submitProject(activeTeamEvent.eventId, {
        projectTitle,
        projectDescription,
        repoUrl,
        demoUrl,
      });
      if (res.success && res.data) {
        setTeamData(res.data);
        setTeamSuccess('Project submission updated successfully!');
      }
    } catch (err: any) {
      setTeamError(err?.response?.data?.error?.message || err?.message || 'Failed to submit project');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!cancelPassTarget) return;
    setCancelling(true);
    try {
      const res = await attendeeApi.cancelRegistration(cancelPassTarget.eventId, 'Attendee voluntary cancellation');
      if (res.success) {
        setCancelPassTarget(null);
        await fetchWallet();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Failed to cancel registration');
    } finally {
      setCancelling(false);
    }
  };

  const filteredWallet = wallet.filter((item) => {
    if (filter === 'ALL') return true;
    return item.status === filter;
  });

  return (
    <div className="min-h-screen bg-[#090d16] text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">My Credential Wallet</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                  {wallet.length} Passes
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Your personal tamper-proof passes, dynamic QR entry tokens, and competition teams
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 self-start sm:self-auto">
            {(['ALL', 'ACTIVE', 'CHECKED_IN'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === mode
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {mode === 'ALL' ? 'All Passes' : mode === 'ACTIVE' ? 'Active' : 'Checked In'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2.5 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-semibold">Loading your verified passes...</p>
          </div>
        ) : filteredWallet.length === 0 ? (
          /* Empty State */
          <div className="py-20 text-center rounded-2xl bg-[#111622] border border-zinc-800 p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mx-auto">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No passes found in this view</h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                When you register for an event or receive a pass from an organizer, it will appear here in your personal credential wallet.
              </p>
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
                  className="rounded-2xl bg-[#111622] border border-zinc-800 hover:border-emerald-500/40 transition-all shadow-xl overflow-hidden flex flex-col justify-between group"
                >
                  {/* Top Bar with Category & Status */}
                  <div className="p-5 pb-4 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        {pass.eventType}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-zinc-400">
                        {pass.formattedId}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          pass.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : pass.status === 'CHECKED_IN'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" /> {pass.status}
                      </span>
                    </div>
                  </div>

                  {/* Pass Body */}
                  <div className="p-5 space-y-4 flex-1">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition">
                        {pass.eventName}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {pass.credentialTerminology} • {pass.holder.category || 'Attendee'}
                      </p>
                    </div>

                    {/* Schedule & Venue Meta */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/60">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {pass.schedule?.startAt
                            ? new Date(pass.schedule.startAt).toLocaleDateString()
                            : 'Date TBA'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {pass.venue?.city || pass.venue?.name || 'Venue TBA'}
                        </span>
                      </div>
                    </div>

                    {/* Holder Info */}
                    <div className="text-xs text-zinc-400 border-t border-zinc-800/60 pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                          Pass Holder
                        </span>
                        <span className="text-zinc-200 font-semibold">{pass.holder.name}</span>
                      </div>
                      {pass.holder.organization && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                            Organization
                          </span>
                          <span className="text-zinc-300">{pass.holder.organization}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pass Actions Footer */}
                  <div className="p-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedPassForQr(pass)}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-400" /> View QR
                      </button>

                      {pass.asset?.publicUrl && (
                        <a
                          href={pass.asset.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={`${pass.formattedId}.png`}
                          className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5 text-zinc-400" /> Pass PNG
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isHackathon && (
                        <button
                          onClick={() => openTeamWorkspace(pass)}
                          className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Users className="w-3.5 h-3.5" /> Team Hub
                        </button>
                      )}

                      <button
                        onClick={() => setCancelPassTarget(pass)}
                        title="Cancel Registration"
                        className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111622] border border-zinc-800 rounded-2xl w-full max-w-sm p-6 space-y-5 text-center shadow-2xl relative">
            <button
              onClick={() => setSelectedPassForQr(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                {selectedPassForQr.credentialTerminology}
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {selectedPassForQr.eventName}
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {selectedPassForQr.formattedId}
              </p>
            </div>

            {/* High-Contrast QR Code container */}
            <div className="p-4 bg-white rounded-2xl shadow-inner inline-block mx-auto min-w-[220px] min-h-[220px] flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Pass Entry QR"
                  className="w-[200px] h-[200px] rounded-lg block mx-auto"
                />
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
              )}
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-semibold text-zinc-200">{selectedPassForQr.holder.name}</p>
              <p className="text-[11px] font-mono text-zinc-500 truncate max-w-xs mx-auto">
                Token: {selectedPassForQr.verificationToken.slice(0, 16)}...
              </p>
              <p className="text-[11px] text-emerald-400 pt-1">
                Present this QR code at the event gate scanner for admission.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hackathon Teaming Workspace Modal */}
      {activeTeamEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111622] border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Teaming & Project Hub
                  </h3>
                  <p className="text-xs text-zinc-400">{activeTeamEvent.eventName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTeamEvent(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {teamError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{teamError}</span>
                </div>
              )}

              {teamSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{teamSuccess}</span>
                </div>
              )}

              {teamLoading ? (
                <div className="py-12 flex justify-center text-emerald-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : teamData ? (
                /* Active Team Details & Project Submission */
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {teamData.teamName}
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                          {teamData.track || 'General'}
                        </span>
                      </h4>
                      <span className="text-[10px] font-bold uppercase text-zinc-400">
                        Status: <span className="text-emerald-400">{teamData.status}</span>
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                        Team Roster ({teamData.members.length}/6)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {teamData.members.map((m, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 flex items-center justify-between"
                          >
                            <div>
                              <span className="text-zinc-200 font-semibold block">{m.name}</span>
                              <span className="text-[10px] text-zinc-500">{m.email}</span>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-medium">
                              {m.role || 'Member'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Project Submission Form */}
                  <form onSubmit={handleProjectSubmit} className="space-y-3 border-t border-zinc-800 pt-4">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" /> Project Submission
                    </h5>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                        Project Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AI-Powered Fraud Sentinel"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                        Short Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Brief overview of problem and architecture..."
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          GitHub / Code Repository
                        </label>
                        <input
                          type="url"
                          placeholder="https://github.com/..."
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Live Demo / Video URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://demo.app or video link"
                          value={demoUrl}
                          onChange={(e) => setDemoUrl(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2 text-right">
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition"
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
                    <p className="text-xs text-zinc-400">
                      You are not currently part of a team in this hackathon.
                    </p>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTeamAction('CREATE')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                        teamAction === 'CREATE'
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 inline mr-1" /> Create Team
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeamAction('JOIN')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                        teamAction === 'JOIN'
                          ? 'bg-emerald-500 text-zinc-950'
                          : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 inline mr-1" /> Join Existing Team
                    </button>
                  </div>

                  {teamAction === 'CREATE' && (
                    <form onSubmit={handleCreateTeam} className="space-y-3 p-4 bg-zinc-900 rounded-xl">
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Team Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. CyberKnights"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Track / Theme
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. AI/ML, FinTech, Web3"
                          value={newTeamTrack}
                          onChange={(e) => setNewTeamTrack(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition"
                      >
                        Create Team
                      </button>
                    </form>
                  )}

                  {teamAction === 'JOIN' && (
                    <form onSubmit={handleJoinTeam} className="space-y-3 p-4 bg-zinc-900 rounded-xl">
                      <div>
                        <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                          Team Name to Join
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter exact team name"
                          value={joinTeamNameOrId}
                          onChange={(e) => setJoinTeamNameOrId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={teamLoading}
                        className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition"
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

      {/* Cancellation Confirmation Modal */}
      {cancelPassTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#111622] border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Cancel Registration?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Cancelling will permanently revoke your pass ({cancelPassTarget.formattedId}) for{' '}
                <span className="text-zinc-200 font-semibold">{cancelPassTarget.eventName}</span>.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelPassTarget(null)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold"
              >
                Keep Pass
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelRegistration}
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs"
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
