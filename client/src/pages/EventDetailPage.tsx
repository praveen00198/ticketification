import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { eventsApi, UpdateEventPayload } from '../api/events';
import { EventItem, TicketType } from '../types';
import { useEvent } from '../context/EventContext';
import { canManageEventOperations } from '../utils/permissions';
import {
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { ContextAwareHostConsole } from '../components/events/ContextAwareHostConsole';

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const context = useOutletContext<{ user?: any }>();
  const user = context?.user;
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

      // If caller is an attendee without host management permissions, route to Attendee Workspace
      if (user && !canManageEventOperations(user, data)) {
        navigate(`/events/${eventId}/attendee`, { replace: true });
        return;
      }

      setEvent(data);
      setCurrentEvent(data);
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
      if (err?.response?.status === 403) {
        navigate(`/events/${eventId}/attendee`, { replace: true });
        return;
      }
      setError(err?.response?.data?.message || err.message || 'Failed to load event details');
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
    <div className="w-full">
      {/* 6-Pillar Context-Aware Adaptive Host Console */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-stone-200/90 w-full max-w-md rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200/80 pb-3">
              <h3 className="text-sm font-bold text-zinc-900">Add Custom Category / Tier</h3>
              <button
                onClick={() => setIsAddTypeOpen(false)}
                className="text-stone-400 hover:text-zinc-700 text-xs font-bold"
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
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Code / Name (uppercase)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP, PRESS, SPONSOR, SPEAKER"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Backstage Pass"
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Usage Policy</label>
                <select
                  value={newTypePolicy}
                  onChange={(e) =>
                    setNewTypePolicy(e.target.value as 'SINGLE_USE' | 'REUSABLE' | 'REUSABLE_WORKER')
                  }
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-400/20 shadow-xs"
                >
                  <option value="SINGLE_USE">SINGLE_USE (Standard Attendee)</option>
                  <option value="REUSABLE">REUSABLE (Multi-entry Staff / VIP)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddTypeOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-stone-500 hover:text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs"
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
