import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, UpdateEventPayload } from '../api/events';
import { EventItem, TicketType } from '../types';
import { useEvent } from '../context/EventContext';
import {
  ArrowLeft,
  Plus,
  Save,
  CheckCircle2,
  Tag,
  AlertCircle,
  FileSpreadsheet,
  Ticket,
  QrCode,
} from 'lucide-react';

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
              navigate('/scan');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Launch Scanner</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Event Settings Form */}
        <div className="lg:col-span-2 bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-surface-border pb-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Event Details</h2>
              <p className="text-xs text-zinc-500">Update event information and schedules</p>
            </div>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved successfully</span>
              </span>
            )}
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Event Name</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Event Date</label>
                <input
                  type="date"
                  required
                  value={formData.date || ''}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.time || ''}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Venue</label>
                <input
                  type="text"
                  value={formData.venue || ''}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Organizer</label>
                <input
                  type="text"
                  value={formData.organizerName || ''}
                  onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
              <select
                value={formData.status || 'UPCOMING'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
              >
                <option value="UPCOMING">UPCOMING</option>
                <option value="ACTIVE">ACTIVE (In Progress)</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Ticket Types Management */}
        <div className="bg-white border border-surface-border p-6 rounded-2xl shadow-sm space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-brand-600" />
                  <span>Ticket Categories</span>
                </h2>
                <p className="text-[11px] text-zinc-500">Rules & categories for this event</p>
              </div>

              <button
                onClick={() => setIsAddTypeOpen(true)}
                className="p-1.5 bg-zinc-100 hover:bg-zinc-200 text-brand-600 rounded-lg transition-colors border border-zinc-200"
                title="Add Ticket Type"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {ticketTypes.map((t) => (
                <div
                  key={t.id}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900">{t.name}</span>
                      <span
                        className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          t.usagePolicy === 'REUSABLE' || t.usagePolicy === 'REUSABLE_WORKER'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {t.usagePolicy === 'REUSABLE' || t.usagePolicy === 'REUSABLE_WORKER' ? 'Worker Reusable' : 'Single Use'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{t.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Ticket Type Modal */}
          {isAddTypeOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white border border-surface-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <h3 className="text-sm font-bold text-zinc-900">Add Custom Ticket Type</h3>
                  <button
                    onClick={() => setIsAddTypeOpen(false)}
                    className="text-zinc-400 hover:text-zinc-700 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {typeError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                    {typeError}
                  </div>
                )}

                <form onSubmit={handleAddTicketType} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Code / Name (uppercase)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PRESS, SPONSOR, EXHIBITOR"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Display Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Media & Press Pass"
                      value={newTypeLabel}
                      onChange={(e) => setNewTypeLabel(e.target.value)}
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Usage Policy</label>
                    <select
                      value={newTypePolicy}
                      onChange={(e) =>
                        setNewTypePolicy(e.target.value as 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER')
                      }
                      className="w-full bg-white border border-zinc-300 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                    >
                      <option value="SINGLE_USE">SINGLE_USE (Standard Guest)</option>
                      <option value="REUSABLE">REUSABLE (Multi-entry Staff)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddTypeOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm"
                    >
                      Add Type
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
