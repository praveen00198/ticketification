import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, UpdateEventPayload } from '../api/events';
import { EventItem, TicketType } from '../types';
import { useEvent } from '../context/EventContext';
import {
  ArrowLeft,
  AlertCircle,
  FileSpreadsheet,
  Ticket,
  QrCode,
  Shield,
  Award,
} from 'lucide-react';
import { ContextAwareHostConsole } from '../components/events/ContextAwareHostConsole';

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { setCurrentEvent, refreshEvents } = useEvent();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [formData, setFormData] = useState<UpdateEventPayload>({});

  // Add Ticket Type state
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypePolicy, setNewTypePolicy] = useState<'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER'>('SINGLE_USE');
  const [typeError, setTypeError] = useState<string | null>(null);

  const fetchEventData = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getEvent(eventId);
      setEvent(data);
      setTicketTypes(data.ticketTypes || []);
      setFormData({
        name: data.name,
        date: data.date,
        time: data.time || '',
        venue: data.venue || '',
        description: data.description || '',
        organizerName: data.organizerName || '',
        status: data.status,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    try {
      setSaving(true);
      setError(null);
      const updated = await eventsApi.updateEvent(eventId, formData);
      setEvent(updated);
      setSaveSuccess(true);
      await refreshEvents();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTicketType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !newTypeName.trim()) return;

    try {
      setTypeError(null);
      const created = await eventsApi.createTicketType(eventId, {
        name: newTypeName.trim(),
        label: newTypeLabel.trim() || newTypeName.trim(),
        usagePolicy: newTypePolicy,
      });

      setTicketTypes([...ticketTypes, created]);
      setIsAddTypeOpen(false);
      setNewTypeName('');
      setNewTypeLabel('');
      setNewTypePolicy('SINGLE_USE');
    } catch (err: any) {
      setTypeError(err.message || 'Failed to add ticket type');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-zinc-500 text-xs font-medium">
        Loading event details...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center bg-white border border-surface-border rounded-2xl p-8 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-zinc-900 mb-2">Event Not Found</h2>
        <p className="text-xs text-zinc-500 mb-6">{error || 'Could not find this event.'}</p>
        <button
          onClick={() => navigate('/events')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-surface-border p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/events')}
            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-600">Event Configuration</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                {event.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">{event.name}</h1>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setCurrentEvent(event);
              navigate('/import');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-brand-600" />
            <span>Import Guests</span>
          </button>

          <button
            onClick={() => {
              setCurrentEvent(event);
              navigate('/tickets');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
          >
            <Ticket className="w-3.5 h-3.5 text-blue-600" />
            <span>View Tickets</span>
          </button>

          <button
            onClick={() => {
              setCurrentEvent(event);
              navigate(`/events/${eventId}/staff-console`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Staff Console</span>
          </button>

          <button
            onClick={() => {
              setCurrentEvent(event);
              navigate(`/events/${eventId}/review-workspace`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold rounded-xl border border-zinc-300 transition-all shadow-sm"
          >
            <Award className="w-3.5 h-3.5 text-amber-600" />
            <span>Review Workspace</span>
          </button>

          <button
            onClick={() => {
              setCurrentEvent(event);
              navigate('/scan');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Launch Scanner</span>
          </button>
        </div>
      </div>

      {/* Phase 19: Context-Aware Adaptive Host Console */}
      <ContextAwareHostConsole
        event={event}
        ticketTypes={ticketTypes}
        onRefreshEvent={fetchEventData}
        formData={formData}
        setFormData={setFormData}
        onUpdateEvent={handleUpdate}
        saving={saving}
        saveSuccess={saveSuccess}
        onOpenAddTicketType={() => setIsAddTypeOpen(true)}
      />

      {/* Add Ticket Type Modal */}
      {isAddTypeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111622] border border-[#1f293d] w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1f293d] pb-3">
              <h3 className="text-sm font-bold text-white">Add Custom Category / Tier</h3>
              <button
                onClick={() => setIsAddTypeOpen(false)}
                className="text-zinc-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {typeError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
                {typeError}
              </div>
            )}

            <form onSubmit={handleAddTicketType} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Code / Name (uppercase)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP, PRESS, SPONSOR, SPEAKER"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 shadow-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Backstage Pass"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Usage Policy</label>
                <select
                  value={newTypePolicy}
                  onChange={(e) =>
                    setNewTypePolicy(e.target.value as 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER')
                  }
                  className="w-full bg-[#182030] border border-[#2a3650] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 shadow-sm"
                >
                  <option value="SINGLE_USE">SINGLE_USE (Standard Attendee)</option>
                  <option value="REUSABLE">REUSABLE (Multi-entry Staff / VIP)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Add Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
