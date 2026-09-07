import React, { useEffect, useState } from 'react';
import { Ticket } from '../../types';
import { renderTicketToDataUrl, downloadTicketPng } from '../../utils/ticketCanvas';
import { getTicketPreviewUrl } from '../../api/client';
import { X, Download, ExternalLink, RefreshCw } from 'lucide-react';

interface TicketPreviewModalProps {
  ticket: Ticket | null;
  onClose: () => void;
}

export const TicketPreviewModal: React.FC<TicketPreviewModalProps> = ({ ticket, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticket) {
      setDataUrl(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    // 1. Direct Base64 data (Canonical stored artifact)
    if (ticket.imageBase64 && ticket.imageBase64.startsWith('data:image/')) {
      setDataUrl(ticket.imageBase64);
      setLoading(false);
      return;
    }

    // 2. Direct Supabase / Backend Storage URL (Canonical stored artifact)
    if (ticket.ticketImageUrl) {
      const resolved = getTicketPreviewUrl(ticket.ticketImageUrl);
      setDataUrl(resolved);
      setLoading(false);
      return;
    }

    // 3. Fallback Canvas renderer (if legacy ticket lacks stored image)
    renderTicketToDataUrl(ticket)
      .then((url) => {
        if (isMounted) {
          setDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to render ticket preview:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [ticket]);

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-surface-border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-surface-border flex justify-between items-center text-zinc-900">
          <div>
            <h3 className="font-bold text-sm text-brand-600">{ticket.name || (ticket as any).guestName || 'Guest'}</h3>
            <p className="text-[11px] text-zinc-500 font-mono">{ticket.ticketId} • {ticket.event}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Ticket Card */}
        <div className="p-4 flex-1 overflow-y-auto flex items-center justify-center bg-zinc-50 min-h-[400px]">
          {loading || !dataUrl ? (
            <div className="flex flex-col items-center gap-3 text-zinc-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
              <span>Rendering high-resolution ticket card...</span>
            </div>
          ) : (
            <img
              src={dataUrl}
              alt={`Ticket for ${ticket.name || (ticket as any).guestName || 'Guest'}`}
              className="max-h-[68vh] w-auto object-contain rounded-xl shadow-lg border border-zinc-200"
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-surface-border bg-white flex justify-between items-center gap-3">
          {dataUrl ? (
            <a
              href={dataUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1.5 transition-colors font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Resolution Tab
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => ticket && downloadTicketPng(ticket)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-4 h-4" /> Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
