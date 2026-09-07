import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { ticketsApi, TicketListItem } from '../api/tickets';
import {
  Ticket,
  Search,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  QrCode,
  Download,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  Eye,
} from 'lucide-react';

export const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingWorkers, setGeneratingWorkers] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [workerCount, setWorkerCount] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview Modal
  const [selectedTicket, setSelectedTicket] = useState<TicketListItem | null>(null);

  const fetchTickets = useCallback(async () => {
    if (!currentEvent) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await ticketsApi.getTickets(currentEvent.id, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        limit: 5000,
      });
      setTickets(data.tickets);
      setTotalCount(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }, [currentEvent, statusFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleDownloadZip = async () => {
    if (!currentEvent || downloadingZip) return;
    try {
      setDownloadingZip(true);
      setError(null);
      const blob = await ticketsApi.downloadTicketsZip(currentEvent.id);
      const safeEventName = (currentEvent.name || 'Event')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_');
      const filename = `${safeEventName}-Tickets.zip`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to download ZIP archive');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleGenerateTickets = async () => {
    if (!currentEvent) return;

    try {
      setGenerating(true);
      setError(null);
      setMessage(null);
      const result = await ticketsApi.generateTickets(currentEvent.id);
      setMessage(result.message || 'Tickets generated successfully!');
      await fetchTickets();
    } catch (err: any) {
      setError(err.message || 'Failed to generate tickets');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWorkers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent) return;

    try {
      setGeneratingWorkers(true);
      setError(null);
      const result = await ticketsApi.generateWorkerTickets(currentEvent.id, workerCount, 'WORKER');
      setIsWorkerModalOpen(false);
      setMessage(result.message || `Successfully generated ${workerCount} worker tickets!`);
      await fetchTickets();
    } catch (err: any) {
      setError(err.message || 'Failed to generate worker tickets');
    } finally {
      setGeneratingWorkers(false);
    }
  };

  if (!currentEvent) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center bg-white border border-surface-border rounded-2xl p-8 shadow-sm">
        <div className="w-12 h-12 bg-zinc-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">No Active Event Selected</h2>
        <p className="text-xs text-zinc-500 max-w-md mx-auto mb-6">
          Please select or create an event to view and generate tickets.
        </p>
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
        >
          <Calendar className="w-4 h-4" />
          <span>Manage Events</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-surface-border p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1">
              <Ticket className="w-3 h-3" />
              <span>Event Ticketing Engine</span>
            </span>
            <span className="text-xs text-zinc-400">•</span>
            <span className="text-xs font-semibold text-zinc-600">
              Event: <span className="text-zinc-900 font-bold">{currentEvent.name}</span>
            </span>
            <span className="text-xs text-zinc-400">•</span>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200">
              {totalCount} Total Tickets
            </span>
          </div>
          <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Verified QR Tickets</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Browse, inspect, and generate cryptographically verified tickets with deterministic sequence numbers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {(totalCount > 0 || tickets.length > 0) && (
            <button
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm disabled:opacity-50"
            >
              {downloadingZip ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-600" />
                  <span>Preparing ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-brand-600" />
                  <span>Download All (ZIP)</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setIsWorkerModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-700 text-xs font-bold rounded-xl border border-amber-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Worker Tickets</span>
          </button>

          <button
            onClick={handleGenerateTickets}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 active:scale-95 disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate All Tickets</span>
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold p-1">
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-surface-border p-4 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-zinc-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="USED">USED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            onClick={fetchTickets}
            title="Refresh"
            className="p-2 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-xl text-zinc-600 hover:text-zinc-900 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tickets Data Grid */}
      <div className="bg-white border border-surface-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-20 text-xs text-zinc-500">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 p-8">
            <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 mb-1">No Tickets Generated</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mb-5">
              No tickets have been generated for this event yet. Import your guest list and click "Generate All Tickets" to issue verified credentials.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/import')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-brand-600" />
                <span>Import Guests</span>
              </button>
              <button
                onClick={handleGenerateTickets}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-600/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Tickets</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 uppercase font-mono text-[10px]">
                  <th className="py-3 px-4"># Seq</th>
                  <th className="py-3 px-4">Guest Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-600">
                      #{t.sequenceNumber.toString().padStart(5, '0')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-zinc-900">
                        {t.guest?.name || 'UNASSIGNED STAFF'}
                      </div>
                      {t.guest?.organization && (
                        <div className="text-[11px] text-zinc-500">{t.guest.organization}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                        {t.ticketType?.label || t.ticketType?.name || 'Standard'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-700">
                      <div>{t.guest?.email || '—'}</div>
                      <div className="text-[11px] text-zinc-400">{t.guest?.phone || ''}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : t.status === 'USED'
                            ? 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {t.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{t.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          t.usagePolicy === 'REUSABLE' || t.usagePolicy === 'REUSABLE_WORKER'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                        }`}
                      >
                        {t.usagePolicy === 'REUSABLE' || t.usagePolicy === 'REUSABLE_WORKER' ? 'Reusable Worker' : 'Single Use'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTicket(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-lg border border-zinc-200 transition-colors shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-600" />
                          <span>Preview</span>
                        </button>
                        {t.assetUrl && (
                          <a
                            href={t.assetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={
                              t.guest?.name && t.guest.name !== 'UNASSIGNED'
                                ? `${t.guest.name.trim().replace(/[/\\?%*:|"<>]/g, '').replace(/[\s_]+/g, '-')}-${currentEvent.name.substring(0, 3).toUpperCase()}-${t.sequenceNumber.toString().padStart(5, '0')}.png`
                                : `${currentEvent.name.substring(0, 3).toUpperCase()}-${t.sequenceNumber.toString().padStart(5, '0')}.png`
                            }
                            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 rounded-lg border border-zinc-200 transition-colors shadow-sm"
                            title="Download PNG"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Preview Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Ticket #{selectedTicket.sequenceNumber.toString().padStart(5, '0')}</h3>
                <span className="text-[11px] text-zinc-500">{currentEvent.name}</span>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {selectedTicket.assetUrl ? (
              <div className="rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 flex justify-center p-2">
                <img
                  src={selectedTicket.assetUrl}
                  alt="Ticket Preview"
                  className="max-h-96 w-auto object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-zinc-50 rounded-xl border border-zinc-200">
                <QrCode className="w-12 h-12 text-brand-600 mx-auto mb-2" />
                <div className="text-xs font-bold text-zinc-900">Token:</div>
                <div className="text-[10px] font-mono text-zinc-600 break-all mt-1">
                  {selectedTicket.verificationToken}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              <a
                href={`/verify/${selectedTicket.verificationToken}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Open Verification Link</span>
                <ArrowRight className="w-3 h-3" />
              </a>

              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Worker Tickets Modal */}
      {isWorkerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">Generate Worker Passes</h3>
              </div>
              <button
                onClick={() => setIsWorkerModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateWorkers} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Number of Passes to Generate
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  value={workerCount}
                  onChange={(e) => setWorkerCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm font-mono"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Unassigned worker tickets support reusable check-ins and can be assigned a staff name upon scanning.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWorkerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingWorkers}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 disabled:opacity-50"
                >
                  {generatingWorkers ? 'Generating Passes...' : `Generate ${workerCount} Passes`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
