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
  Trash2,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { attendeeApi, AttendeeWalletItem, AttendeeTeamData } from '../api/attendee';
import { ticketsApi, triggerBlobDownload } from '../api/tickets';
import QRCode from 'qrcode';
import { Button, Badge, Modal, EmptyEventsState, Input, InView, AnimatedGroup } from '../components/ui';

export const AttendeeWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<AttendeeWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'CHECKED_IN'>('ALL');

  // QR Inspection Modal state
  const [selectedPassForQr, setSelectedPassForQr] = useState<AttendeeWalletItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloadingPassId, setDownloadingPassId] = useState<string | null>(null);

  const handleDownloadPass = async (pass: AttendeeWalletItem) => {
    try {
      setDownloadingPassId(pass.credentialId);
      const { blob, fileName } = await ticketsApi.downloadTicket(pass.credentialId, pass.eventId);
      triggerBlobDownload(blob, fileName || `${pass.formattedId}.png`);
    } catch (err: any) {
      console.error('[AttendeeWallet] Failed to download pass:', err);
      if (pass.asset?.publicUrl) {
        window.open(pass.asset.publicUrl, '_blank');
      }
    } finally {
      setDownloadingPassId(null);
    }
  };

  useEffect(() => {
    if (selectedPassForQr) {
      const url = `${window.location.origin}/verify/${selectedPassForQr.verificationToken}`;
      QRCode.toDataURL(url, { width: 240, margin: 1 })
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
    } catch (_err) {
      setTeamData(null);
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
    <div className="flex-1 flex flex-col w-full min-h-full">
      <div className="flex-1 flex flex-col w-full max-w-6xl mx-auto">
        {/* Top Header */}
        <InView direction="up" distance={12} className="shrink-0 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-1">
            {/* Left: Icon, Title, Pass Count */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-900 shrink-0 shadow-2xs">
                <Wallet className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
                  My Credential Wallet
                </h1>
                <Badge variant="neutral" size="sm" className="font-semibold text-stone-600 bg-stone-100/90 border border-stone-200/80">
                  {wallet.length} {wallet.length === 1 ? 'Pass' : 'Passes'}
                </Badge>
              </div>
            </div>

            {/* Right: Filter Pills */}
            <div className="flex items-center gap-1 rounded-full bg-stone-100/90 border border-stone-200/80 self-start sm:self-auto overflow-hidden">
              {(['ALL', 'ACTIVE', 'CHECKED_IN'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilter(mode)}
                  className={`px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                    filter === mode
                      ? 'bg-white text-zinc-900 shadow-2xs'
                      : 'text-stone-500 hover:text-zinc-900'
                  }`}
                >
                  {mode === 'ALL' ? 'All Passes' : mode === 'ACTIVE' ? 'Active' : 'Checked In'}
                </button>
              ))}
            </div>
          </div>
        </InView>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-rose-700 text-xs shadow-2xs shrink-0">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchWallet}
              iconLeft={<RefreshCw className="w-3 h-3 text-rose-600" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-400 p-8 min-h-[360px]">
            <Loader2 className="w-8 h-8 animate-spin text-stone-900" />
            <p className="text-xs font-semibold text-stone-500">Loading your verified passes...</p>
          </div>
        ) : filteredWallet.length === 0 ? (
          /* Empty State - Centered vertically and horizontally in all available space */
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[420px] my-auto">
            <EmptyEventsState
              title={
                filter === 'ALL'
                  ? 'Your Pass Vault is Currently Empty'
                  : `No ${filter.charAt(0) + filter.slice(1).toLowerCase()} Passes in Vault`
              }
              description={
                filter === 'ALL'
                  ? 'When you register for an event on Ticketification, your verified pass with dynamic cryptographic QR credentials will be stored here.'
                  : 'No passes in your vault match the selected category filter. Try clearing the filter or exploring other upcoming live events.'
              }
              slotText={filter === 'ALL' ? 'VAULT EMPTY' : 'NO PASSES'}
              categoryText={filter === 'ALL' ? 'PERSONAL VAULT • 0 PASSES' : 'FILTER • 0 MATCHES'}
              actionText="Explore Live Events"
              onAction={() => navigate('/explore')}
              actionIcon={<Compass className="w-3.5 h-3.5" />}
              secondaryActionText="Host Your Own Event"
              onSecondaryAction={() => navigate('/events/create')}
            />
          </div>
        ) : (
          /* Passes Grid (Responsive 1 col mobile, 2 cols tablet/desktop) */
          <AnimatedGroup staggerDelay={70} className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {filteredWallet.map((pass) => {
            const isHackathon = ['HACKATHON', 'COMPETITION', 'COLLEGE_EVENT'].includes(
              pass.eventType.toUpperCase()
            );

            return (
              <div
                key={pass.credentialId}
                className="rounded-2xl bg-white border border-stone-200/90 hover:border-stone-900 transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden group relative"
              >
                {/* Perforation edge notches */}
                <div className="ticket-perforation-left" />
                <div className="ticket-perforation-right" />

                {/* Top Header with Category & Status */}
                <div className="p-4 px-5 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="neutral" size="sm">
                      {pass.eventType.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-stone-500">
                      {pass.formattedId}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        pass.status === 'ACTIVE'
                          ? 'emerald'
                          : pass.status === 'CHECKED_IN'
                          ? 'sky'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>{pass.status}</span>
                    </Badge>
                  </div>
                </div>

                {/* Pass Body */}
                <div className="p-5 space-y-4 flex-1">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-black transition-colors">
                      {pass.eventName}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {pass.credentialTerminology} • {pass.holder.category || 'Attendee'}
                    </p>
                  </div>

                  {/* Schedule & Venue Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="truncate">
                        {pass.schedule?.startAt
                          ? new Date(pass.schedule.startAt).toLocaleDateString()
                          : 'Date TBA'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
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
                        <span className="text-zinc-700 font-medium">{pass.holder.organization}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pass Actions Footer */}
                <div className="p-3.5 sm:p-4 bg-stone-50/70 border-t border-stone-200/90 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedPassForQr(pass)}
                      iconLeft={<QrCode className="w-3.5 h-3.5 text-stone-700" />}
                    >
                      View QR
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadPass(pass)}
                      disabled={downloadingPassId === pass.credentialId}
                      iconLeft={<Download className="w-3.5 h-3.5 text-stone-500" />}
                    >
                      {downloadingPassId === pass.credentialId ? 'Downloading...' : 'Pass PNG'}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {isHackathon && (
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => openTeamWorkspace(pass)}
                        iconLeft={<Users className="w-3.5 h-3.5 text-stone-700" />}
                      >
                        Team Hub
                      </Button>
                    )}

                    <button
                      onClick={() => setCancelPassTarget(pass)}
                      title="Cancel Registration"
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      aria-label="Cancel Registration"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </AnimatedGroup>
      )}

      {/* QR Inspection Modal */}
      <Modal
        isOpen={Boolean(selectedPassForQr)}
        onClose={() => setSelectedPassForQr(null)}
        title={selectedPassForQr?.eventName}
        description={`${selectedPassForQr?.credentialTerminology} • ${selectedPassForQr?.formattedId}`}
        maxWidth="sm"
      >
        <div className="text-center space-y-4">
          {/* High-Contrast QR Code container */}
          <div className="p-4 bg-white rounded-2xl border border-stone-200/90 inline-block mx-auto min-w-[220px] min-h-[220px] flex items-center justify-center shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Pass Entry QR"
                className="w-[200px] h-[200px] block mx-auto rounded-lg"
              />
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            )}
          </div>

          <div className="space-y-1 text-xs">
            <p className="font-bold text-zinc-900">{selectedPassForQr?.holder.name}</p>
            <p className="text-[11px] font-mono text-stone-400 truncate max-w-xs mx-auto">
              Token: {selectedPassForQr?.verificationToken.slice(0, 16)}...
            </p>
            <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-[11px] text-stone-800 font-semibold mt-2">
              Present this QR code at the event gate turnstile for admission.
            </div>
          </div>
        </div>
      </Modal>

      {/* Hackathon Teaming Workspace Modal */}
      <Modal
        isOpen={Boolean(activeTeamEvent)}
        onClose={() => setActiveTeamEvent(null)}
        title="Teaming & Project Hub"
        description={activeTeamEvent?.eventName}
        maxWidth="xl"
      >
        <div className="space-y-5">
          {teamError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{teamError}</span>
            </div>
          )}

          {teamSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{teamSuccess}</span>
            </div>
          )}

          {teamLoading ? (
            <div className="py-12 flex justify-center text-stone-900">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : teamData ? (
            /* Active Team Details & Project Submission */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    {teamData.teamName}
                    <Badge variant="neutral" size="sm">
                      {teamData.track || 'General'}
                    </Badge>
                  </h4>
                  <span className="text-[10px] font-bold uppercase text-stone-500">
                    Status: <span className="text-stone-900 font-semibold">{teamData.status}</span>
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
                        <span className="text-[10px] text-stone-600 font-semibold">
                          {m.role || 'Member'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Project Submission Form */}
              <form onSubmit={handleProjectSubmit} className="space-y-3 border-t border-stone-200 pt-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-stone-700" /> Project Submission
                </h5>

                <Input
                  label="Project Title"
                  placeholder="e.g. AI-Powered Fraud Sentinel"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                />

                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-zinc-700 select-none">
                    Short Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief overview of problem and architecture..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-zinc-900 text-xs placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-3 focus:ring-stone-400/20 resize-none shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="GitHub / Code Repository"
                    type="url"
                    placeholder="https://github.com/..."
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                  <Input
                    label="Live Demo / Video URL"
                    type="url"
                    placeholder="https://demo.app or video link"
                    value={demoUrl}
                    onChange={(e) => setDemoUrl(e.target.value)}
                  />
                </div>

                <div className="pt-2 text-right">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={teamLoading}
                  >
                    Save Project Submission
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* No Team Yet: Options to Create or Join */
            <div className="space-y-4">
              <div className="text-center py-2 space-y-1">
                <p className="text-xs text-stone-500">
                  You are not currently part of a team in this event.
                </p>
              </div>

              <div className="flex justify-center gap-2.5">
                <Button
                  type="button"
                  variant={teamAction === 'CREATE' ? 'primary' : 'neutral'}
                  size="sm"
                  onClick={() => setTeamAction('CREATE')}
                >
                  Create Team
                </Button>
                <Button
                  type="button"
                  variant={teamAction === 'JOIN' ? 'primary' : 'neutral'}
                  size="sm"
                  onClick={() => setTeamAction('JOIN')}
                >
                  Join Existing Team
                </Button>
              </div>

              {teamAction === 'CREATE' && (
                <form onSubmit={handleCreateTeam} className="space-y-3 pt-2">
                  <Input
                    label="Team Name"
                    required
                    placeholder="e.g. CodeFoundry"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                  />
                  <Input
                    label="Challenge Track"
                    placeholder="e.g. AI / Web3 / Open Innovation"
                    value={newTeamTrack}
                    onChange={(e) => setNewTeamTrack(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={teamLoading}
                    className="w-full mt-2"
                  >
                    Create Team
                  </Button>
                </form>
              )}

              {teamAction === 'JOIN' && (
                <form onSubmit={handleJoinTeam} className="space-y-3 pt-2">
                  <Input
                    label="Team Name or Code"
                    required
                    placeholder="Enter team name to join"
                    value={joinTeamNameOrId}
                    onChange={(e) => setJoinTeamNameOrId(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={teamLoading}
                    className="w-full mt-2"
                  >
                    Join Team
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Cancellation Confirmation Dialog */}
      <Modal
        isOpen={Boolean(cancelPassTarget)}
        onClose={() => setCancelPassTarget(null)}
        title="Cancel Registration?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Are you sure you want to surrender your pass for <strong className="text-zinc-800">{cancelPassTarget?.eventName}</strong>? Your slot will be released back into event capacity.
            </p>
          </div>
          <div className="flex items-center gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCancelPassTarget(null)}
              className="w-1/2"
            >
              Keep Pass
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={cancelling}
              onClick={handleCancelPass}
              className="w-1/2"
            >
              Confirm Cancel
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};

export default AttendeeWalletPage;
