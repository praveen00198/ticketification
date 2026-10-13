import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  QrCode,
  ShieldCheck,
  Plus,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
  Ban,
  Layers,
  Search,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import { EventImportBulkModal } from './EventImportBulkModal';
import {
  eventsApi,
  EventCredentialItem,
  CredentialMetrics,
  CredentialUsagePolicy,
  CredentialStatus,
  PublicTokenVerificationResult,
} from '../../api/events';

interface EventCredentialManagerCardProps {
  eventId: string;
  isHostOrCoordinator?: boolean;
}

export const EventCredentialManagerCard: React.FC<EventCredentialManagerCardProps> = ({
  eventId,
  isHostOrCoordinator = true,
}) => {
  const [credentials, setCredentials] = useState<EventCredentialItem[]>([]);
  const [metrics, setMetrics] = useState<CredentialMetrics>({
    totalIssued: 0,
    activeCount: 0,
    checkedInCount: 0,
    revokedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CredentialStatus>('ALL');
  const [policyFilter, setPolicyFilter] = useState<'ALL' | CredentialUsagePolicy>('ALL');

  // Modal States
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [assigningCredential, setAssigningCredential] = useState<EventCredentialItem | null>(null);
  const [revokingCredential, setRevokingCredential] = useState<EventCredentialItem | null>(null);
  const [verificationPreview, setVerificationPreview] = useState<PublicTokenVerificationResult | null>(null);
  const [verifyingLoading, setVerifyingLoading] = useState(false);

  // Issue Form State
  const [issueType, setIssueType] = useState('Ticket');
  const [holderName, setHolderName] = useState('');
  const [holderEmail, setHolderEmail] = useState('');
  const [holderRole, setHolderRole] = useState('PARTICIPANT');
  const [usagePolicy, setUsagePolicy] = useState<CredentialUsagePolicy>('SINGLE_USE');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Batch Form State
  const [batchQuantity, setBatchQuantity] = useState(10);
  const [batchRole, setBatchRole] = useState('WORKER');
  const [batchPrefix, setBatchPrefix] = useState('WRK');
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Assign Form State
  const [assignName, setAssignName] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Revoke Form State
  const [revokeReason, setRevokeReason] = useState('');
  const [submittingRevoke, setSubmittingRevoke] = useState(false);

  // Copy Feedback State
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const fetchCredentials = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await eventsApi.getEventCredentials(eventId, {
        limit: 100,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        usagePolicy: policyFilter !== 'ALL' ? policyFilter : undefined,
      });
      setCredentials(res.credentials);
      setMetrics(res.metrics);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, [eventId, statusFilter, policyFilter]);

  const handleCopyToken = (id: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleIssueSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    try {
      setSubmittingIssue(true);
      setError(null);
      await eventsApi.issueCredential(eventId, {
        credentialType: issueType,
        holder: {
          name: holderName.trim() || undefined,
          email: holderEmail.trim() || undefined,
          roleCategory: holderRole,
        },
        usagePolicy,
      });

      setSuccessMsg(`Successfully issued ${issueType} credential!`);
      setIsIssueModalOpen(false);
      setHolderName('');
      setHolderEmail('');
      setHolderRole('PARTICIPANT');
      await fetchCredentials();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to issue credential');
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleIssueBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    try {
      setSubmittingBatch(true);
      setError(null);
      const res = await eventsApi.issueWorkerBatch(eventId, {
        quantity: Number(batchQuantity),
        roleCategory: batchRole.trim() || 'WORKER',
        prefix: batchPrefix.trim().toUpperCase() || 'WRK',
      });

      setSuccessMsg(`Successfully provisioned batch of ${res.issuedCount} worker credentials!`);
      setIsBatchModalOpen(false);
      await fetchCredentials();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to issue worker batch');
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handleAssignHolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !assigningCredential) return;

    try {
      setSubmittingAssign(true);
      setError(null);
      await eventsApi.assignCredentialHolder(eventId, assigningCredential._id, {
        name: assignName.trim(),
        email: assignEmail.trim() || undefined,
        roleCategory: assignRole.trim() || undefined,
      });

      setSuccessMsg(`Credential ${assigningCredential.sequenceFormatted} assigned to ${assignName}!`);
      setAssigningCredential(null);
      setAssignName('');
      setAssignEmail('');
      setAssignRole('');
      await fetchCredentials();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to assign credential');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleRevokeCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !revokingCredential) return;

    try {
      setSubmittingRevoke(true);
      setError(null);
      await eventsApi.revokeCredential(eventId, revokingCredential._id, revokeReason.trim() || undefined);

      setSuccessMsg(`Credential ${revokingCredential.sequenceFormatted} has been revoked.`);
      setRevokingCredential(null);
      setRevokeReason('');
      await fetchCredentials();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to revoke credential');
    } finally {
      setSubmittingRevoke(false);
    }
  };

  const handleVerifyTokenPreview = async (token: string) => {
    try {
      setVerifyingLoading(true);
      setError(null);
      const res = await eventsApi.verifyCredentialToken(token);
      setVerificationPreview(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Verification token query failed');
    } finally {
      setVerifyingLoading(false);
    }
  };

  const filteredCredentials = useMemo(() => {
    if (!searchQuery.trim()) return credentials;
    const query = searchQuery.toLowerCase();
    return credentials.filter((c) => {
      const seqMatch = c.sequenceFormatted.toLowerCase().includes(query);
      const nameMatch = c.holder.name?.toLowerCase().includes(query);
      const emailMatch = c.holder.email?.toLowerCase().includes(query);
      const roleMatch = c.holder.roleCategory.toLowerCase().includes(query);
      const tokenMatch = c.verificationToken.toLowerCase().includes(query);
      return seqMatch || nameMatch || emailMatch || roleMatch || tokenMatch;
    });
  }, [credentials, searchQuery]);

  return (
    <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>Credential Management & Issuance</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Phase 12
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                Monotonic sequence counters, tamper-proof 64-char QR tokens, and generic pass abstraction.
              </p>
            </div>
          </div>
        </div>

        {isHostOrCoordinator && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsBulkImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-colors border border-emerald-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Roster / Bulk Jobs</span>
            </button>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors border border-zinc-200"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-600" />
              <span>Batch Worker Pass</span>
            </button>
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Credential</span>
            </button>
            <button
              onClick={fetchCredentials}
              disabled={loading}
              className="p-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 rounded-lg transition-colors border border-zinc-200 disabled:opacity-50"
              title="Refresh credentials"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Total Issued</div>
          <div className="text-xl font-bold text-zinc-900 mt-1">{metrics.totalIssued}</div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Active Passes</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{metrics.activeCount}</div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Checked In</div>
          <div className="text-xl font-bold text-zinc-800 mt-1">{metrics.checkedInCount}</div>
        </div>
        <div className="bg-rose-50/50 border border-rose-200/60 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Revoked</div>
          <div className="text-xl font-bold text-rose-700 mt-1">{metrics.revokedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, name, email, or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs">
            {(['ALL', 'ACTIVE', 'REVOKED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs">
            {(['ALL', 'SINGLE_USE', 'REUSABLE', 'WORKER_UNASSIGNED'] as const).map((policy) => (
              <button
                key={policy}
                onClick={() => setPolicyFilter(policy)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  policyFilter === policy
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {policy === 'WORKER_UNASSIGNED' ? 'WORKER' : policy}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credentials Table */}
      {loading && credentials.length === 0 ? (
        <div className="p-8 text-center text-xs text-zinc-400">Loading credentials...</div>
      ) : filteredCredentials.length === 0 ? (
        <div className="p-8 text-center bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-xs text-zinc-500">
          No credentials found matching the criteria. Click &quot;Issue Credential&quot; or &quot;Batch Worker Pass&quot; to begin.
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Sequence</th>
                <th className="py-2.5 px-3">Holder</th>
                <th className="py-2.5 px-3">Role & Policy</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Scans</th>
                <th className="py-2.5 px-3">Verification Token</th>
                {isHostOrCoordinator && <th className="py-2.5 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {filteredCredentials.map((c) => {
                const isUnassigned = !c.holder.name;
                const isRevoked = c.status === 'REVOKED';

                return (
                  <tr key={c._id} className="hover:bg-zinc-50/70 transition-colors">
                    {/* Sequence */}
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 text-[11px]">
                        {c.sequenceFormatted}
                      </span>
                    </td>

                    {/* Holder */}
                    <td className="py-3 px-3">
                      {isUnassigned ? (
                        <div className="flex items-center gap-1.5 text-amber-700">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-semibold text-[11px]">Unassigned Pass</span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-zinc-900">{c.holder.name}</div>
                          {c.holder.email && (
                            <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                              {c.holder.email}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Role & Policy */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wide bg-zinc-100 text-zinc-700 border border-zinc-200">
                          {c.holder.roleCategory}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wide ${
                            c.usagePolicy === 'SINGLE_USE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {c.usagePolicy.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isRevoked
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isRevoked ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                        <span>{c.status}</span>
                      </span>
                    </td>

                    {/* Scans */}
                    <td className="py-3 px-3 text-zinc-600 whitespace-nowrap">
                      <div className="font-semibold">{c.checkInCount} check-in{c.checkInCount === 1 ? '' : 's'}</div>
                      {c.lastCheckInAt && (
                        <div className="text-[10px] text-zinc-400">
                          {new Date(c.lastCheckInAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>

                    {/* Token */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200 max-w-[110px] truncate">
                          {c.verificationToken.slice(0, 8)}...{c.verificationToken.slice(-6)}
                        </span>
                        <button
                          onClick={() => handleCopyToken(c._id, c.verificationToken)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                          title="Copy 64-char verification token"
                        >
                          {copiedTokenId === c._id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleVerifyTokenPreview(c.verificationToken)}
                          disabled={verifyingLoading}
                          className="p-1 text-zinc-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                          title="Simulate zero-PII public verification query"
                        >
                          <ExternalLink className={`w-3.5 h-3.5 ${verifyingLoading ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </td>

                    {/* Actions */}
                    {isHostOrCoordinator && (
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isUnassigned && !isRevoked && (
                            <button
                              onClick={() => {
                                setAssigningCredential(c);
                                setAssignRole(c.holder.roleCategory);
                              }}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition-colors"
                            >
                              Assign
                            </button>
                          )}
                          {!isRevoked && (
                            <button
                              onClick={() => setRevokingCredential(c)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded-md transition-colors"
                              title="Revoke pass"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Issue Single Credential */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-emerald-600" />
                <span>Issue Generic Credential</span>
              </h3>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueSingle} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Credential Terminology / Type</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Ticket">Ticket (Concert / Festival / Event)</option>
                  <option value="Pass">Pass (Hackathon / Workshop / Expo)</option>
                  <option value="Badge">Badge (Conference / Executive)</option>
                  <option value="Wristband">Wristband (Access Control)</option>
                  <option value="Worker Pass">Worker Pass (Reusable Staff)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Holder Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan (leave blank if unassigned)"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Holder Email</label>
                <input
                  type="email"
                  placeholder="e.g. alex@example.com"
                  value={holderEmail}
                  onChange={(e) => setHolderEmail(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Role Category</label>
                  <select
                    value={holderRole}
                    onChange={(e) => setHolderRole(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PARTICIPANT">PARTICIPANT</option>
                    <option value="VIP">VIP</option>
                    <option value="SPEAKER">SPEAKER</option>
                    <option value="ORGANIZER">ORGANIZER</option>
                    <option value="VOLUNTEER">VOLUNTEER</option>
                    <option value="WORKER">WORKER</option>
                    <option value="PRESS">PRESS</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Usage Policy</label>
                  <select
                    value={usagePolicy}
                    onChange={(e) => setUsagePolicy(e.target.value as CredentialUsagePolicy)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="SINGLE_USE">SINGLE_USE (Once only)</option>
                    <option value="REUSABLE">REUSABLE (Multi-scan)</option>
                    <option value="MULTI_DAY">MULTI_DAY</option>
                    <option value="WORKER_UNASSIGNED">WORKER_UNASSIGNED</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingIssue ? 'Issuing...' : 'Issue Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Batch Worker Pass Provisioning */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Batch Provision Worker Credentials</span>
              </h3>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500">
              Generates unassigned passes with monotonic sequence tags. Workers scan repeatedly without single-use lockout, and passes can be bound to real names on-site.
            </p>

            <form onSubmit={handleIssueBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Quantity (Passes to generate)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Sequence Prefix</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 uppercase focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. WRK, STF, VOL"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Role Category</label>
                  <input
                    type="text"
                    required
                    value={batchRole}
                    onChange={(e) => setBatchRole(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 uppercase focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. WORKER, VOLUNTEER"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Atomic Sequence Guarantee</span>
                </div>
                <div>
                  Sequence numbers will monotonically increment without gaps using MongoDB counter atomicity.
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-3.5 py-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBatch}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingBatch ? 'Generating Batch...' : `Generate ${batchQuantity} Passes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Assign Holder */}
      {assigningCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-stone-700" />
                <span>Assign Credential {assigningCredential.sequenceFormatted}</span>
              </h3>
              <button
                onClick={() => setAssigningCredential(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignHolder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Attendee / Worker Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Lee"
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. jordan@example.com"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Role Category (optional override)</label>
                <input
                  type="text"
                  placeholder="e.g. WORKER, VOLUNTEER, CATERING"
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-stone-900 uppercase"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setAssigningCredential(null)}
                  className="px-3.5 py-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAssign}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingAssign ? 'Assigning...' : 'Assign Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Revoke Credential */}
      {revokingCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-600" />
                <span>Revoke Credential {revokingCredential.sequenceFormatted}</span>
              </h3>
              <button
                onClick={() => setRevokingCredential(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600">
              Revoking this credential will immediately prevent any day-of-event scanner from checking in this pass. This action cannot be reversed.
            </p>

            <form onSubmit={handleRevokeCredential} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Revocation Reason (Audit Log)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Lost physical badge, registration refunded, unauthorized duplicate"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setRevokingCredential(null)}
                  className="px-3.5 py-1.5 font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRevoke}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {submittingRevoke ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Zero-PII Public Token Verification Preview */}
      {verificationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Zero-PII Public Verification Result</span>
              </h3>
              <button
                onClick={() => setVerificationPreview(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Credential Status</div>
                <div className="text-base font-black text-emerald-900 mt-0.5">{verificationPreview.status}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Sequence Tag</div>
                <div className="text-base font-mono font-bold text-emerald-900 mt-0.5">{verificationPreview.sequenceFormatted}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-4">
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Event Name</span>
                <span className="font-bold text-zinc-900">{verificationPreview.eventName}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Holder Name</span>
                <span className="font-bold text-zinc-900">{verificationPreview.holderName}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Role Category</span>
                <span className="font-bold text-zinc-800">{verificationPreview.roleCategory}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Usage Policy</span>
                <span className="font-bold text-zinc-800">{verificationPreview.usagePolicy}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Check-in Count</span>
                <span className="font-bold text-zinc-800">{verificationPreview.checkInCount}</span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 uppercase font-bold block">Issued At</span>
                <span className="font-medium text-zinc-700">
                  {new Date(verificationPreview.issuedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-600 text-[11px] space-y-1">
              <div className="font-bold flex items-center gap-1 text-zinc-900">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero-PII Privacy Protection</span>
              </div>
              <div>
                This endpoint does not expose attendee email addresses, phone numbers, or private MongoDB database primary keys to public callers or physical QR scanners.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setVerificationPreview(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white font-bold rounded-xl text-xs transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 15: Bulk Ingestion & Sharp Rendering Modal */}
      <EventImportBulkModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        eventId={eventId}
        onJobCompleted={fetchCredentials}
      />
    </div>
  );
};
