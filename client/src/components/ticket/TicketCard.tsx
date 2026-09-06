import React from 'react';
import { Ticket as TicketType } from '../../types';
import { CheckCircle2, AlertTriangle, Clock, ExternalLink, Smartphone, Mail, Download } from 'lucide-react';
import { getTicketPreviewUrl } from '../../api/client';

interface TicketCardProps {
  ticket: TicketType;
  onDownload?: (ticket: TicketType) => void;
  onResend?: (ticketId: string) => void;
  isResending?: boolean;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onDownload }) => {
  const getStatusBadge = (status: TicketType['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> ACTIVE
          </span>
        );
      case 'USED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> USED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" /> CANCELLED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600">
            {status}
          </span>
        );
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(ticket);
    } else if (ticket.ticketImageUrl) {
      const previewUrl = getTicketPreviewUrl(ticket.ticketImageUrl);
      const safeName = ticket.name.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const a = document.createElement('a');
      a.href = previewUrl;
      a.download = `${safeName || 'Guest'}_${ticket.ticketId}.png`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden ticket-perforation-left ticket-perforation-right relative transition-all duration-300 hover:shadow-xl hover:border-brand-500/50 group">
      {/* Header Bar */}
      <div className="bg-surface-charcoal text-white px-5 py-3.5 flex justify-between items-center">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider block">Credential ID</span>
          <span className="font-mono text-sm font-bold text-brand-400">{ticket.ticketId}</span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(ticket.status)}
          <button
            onClick={handleDownloadClick}
            title="Download Ticket Image"
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-brand-600 text-zinc-300 hover:text-white transition-all transform hover:scale-105 flex items-center gap-1 text-xs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div className="flex-1 pr-2">
            <h4 className="font-bold text-base text-surface-charcoal group-hover:text-brand-700 transition-colors">
              {ticket.name}
            </h4>
            {ticket.phone ? (
              <p className="text-xs text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> {ticket.phone}
              </p>
            ) : ticket.email ? (
              <p className="text-xs text-surface-muted flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-zinc-400" /> {ticket.email}
              </p>
            ) : null}
          </div>
          <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0">
            {ticket.ticketType}
          </span>
        </div>

        <div className="mt-4 pt-3 border-t dashed-perforation flex justify-between items-center text-xs">
          <div>
            <span className="text-surface-muted block text-[10px] uppercase font-medium">Event Name</span>
            <span className="font-bold text-zinc-800 truncate block text-sm text-brand-700">{ticket.event}</span>
          </div>
          {ticket.organization && (
            <div className="text-right">
              <span className="text-surface-muted block text-[10px] uppercase font-medium">Organization</span>
              <span className="font-medium text-zinc-700">{ticket.organization}</span>
            </div>
          )}
        </div>

        {ticket.status === 'USED' && ticket.usedAt && (
          <div className="mt-3 bg-amber-50 border border-amber-200/60 rounded-lg p-2 text-[11px] text-amber-800">
            Checked in at: {new Date(ticket.usedAt).toLocaleTimeString()} by {ticket.verifiedBy || 'Admin'}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-surface-bg px-5 py-3 border-t border-surface-border flex justify-between items-center text-xs">
        {ticket.ticketImageUrl ? (
          <a
            href={getTicketPreviewUrl(ticket.ticketImageUrl)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-600 hover:text-brand-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Preview Card
          </a>
        ) : (
          <span className="text-[11px] text-zinc-400">Card Generated</span>
        )}

        <button
          onClick={handleDownloadClick}
          className="text-xs bg-brand-600 hover:bg-brand-700 text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all transform group-hover:scale-105"
        >
          <Download className="w-3.5 h-3.5" /> Download Ticket
        </button>
      </div>
    </div>
  );
};


