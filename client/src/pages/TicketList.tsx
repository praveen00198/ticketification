import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TicketCard } from '../components/ticket/TicketCard';
import { Ticket } from '../types';
import { apiClient, API_BASE_URL } from '../api/client';
import { Search, RefreshCw, AlertCircle, FileSpreadsheet, QrCode, FolderArchive } from 'lucide-react';

export const TicketList: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.get('/tickets');
      if (res.success && res.data) {
        setTickets(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleDownloadAllZip = async () => {
    if (tickets.length === 0) {
      setMessage('No tickets available to download.');
      return;
    }

    setDownloadingZip(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE_URL}/tickets/download-zip?token=${token || ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.error?.message || `Server returned status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ticketification-tickets-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage('✓ All ticket images downloaded successfully in ZIP archive!');
    } catch (err: any) {
      setMessage(`ZIP download error: ${err.message}`);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadSingleTicket = async (ticket: Ticket) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/tickets/${ticket.ticketId}/download?token=${token || ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to download ticket image.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = ticket.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
      a.download = `${safeName || 'Guest'}_${ticket.ticketId}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Download error:', err);
      if (ticket.ticketImageUrl) {
        window.open(ticket.ticketImageUrl, '_blank');
      }
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const s = search.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(s) ||
      (t.email && t.email.toLowerCase().includes(s)) ||
      (t.phone && t.phone.toLowerCase().includes(s)) ||
      t.ticketId.toLowerCase().includes(s);

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-surface-charcoal">Issued Credentials Database</h1>
          <p className="text-xs text-surface-muted mt-0.5">
            {tickets.length} total event tickets generated & downloadable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bulk Download ZIP Button */}
          <button
            onClick={handleDownloadAllZip}
            disabled={downloadingZip || tickets.length === 0}
            className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {downloadingZip ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Archiving ZIP...
              </>
            ) : (
              <>
                <FolderArchive className="w-4 h-4" /> Download All (ZIP)
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/import')}
            className="text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> + Import Guests
          </button>

          <button
            onClick={() => navigate('/scan')}
            className="text-xs font-semibold bg-surface-charcoal hover:bg-black text-white px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5" /> Scanner
          </button>

          <button
            onClick={fetchTickets}
            className="text-xs font-semibold bg-white border border-surface-border px-3.5 py-2.5 rounded-xl text-surface-charcoal hover:bg-surface-bg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-brand-50 border border-brand-200 text-brand-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-brand-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-surface-border shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by Name, Phone, Email, or Ticket ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-bg border border-surface-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['ALL', 'ACTIVE', 'USED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === st
                  ? 'bg-surface-charcoal text-white'
                  : 'bg-surface-bg text-surface-muted hover:text-surface-charcoal'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Tickets */}
      {loading ? (
        <div className="text-center py-16 text-xs text-surface-muted">
          Loading ticket repository...
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-border p-12 text-center text-xs text-surface-muted space-y-3">
          <p>No tickets found matching your search criteria.</p>
          <button
            onClick={() => navigate('/import')}
            className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel Guest List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket._id}
              ticket={ticket}
              onDownload={handleDownloadSingleTicket}
            />
          ))}
        </div>
      )}
    </div>
  );
};

