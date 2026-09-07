import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { eventsApi, CreateEventPayload } from '../api/events';
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Users,
  Settings,
} from 'lucide-react';

export const EventsPage: React.FC = () => {
  const { events, currentEvent, setCurrentEvent, refreshEvents, loading } = useEvent();
  const navigate = useNavigate();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateEventPayload>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    venue: '',
    organizerName: '',
    description: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      setError('Event name and date are required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const newEvent = await eventsApi.createEvent(formData);
      await refreshEvents();
      setCurrentEvent(newEvent);
      setIsCreateOpen(false);
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        venue: '',
        organizerName: '',
        description: '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (eventId: string, eventName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete event "${eventName}"? All associated tickets will be removed.`)) {
      return;
    }

    try {
      await eventsApi.deleteEvent(eventId);
      await refreshEvents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete event');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface-card border border-zinc-800/80 p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Event Management
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Your Events</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your event configurations, ticket categories, and guest lists in one place.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-600/20 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-16 text-zinc-500 text-xs font-medium">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 bg-surface-card border border-zinc-800/80 rounded-2xl p-8">
          <div className="w-12 h-12 bg-zinc-800 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No Events Found</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-5">
            You haven't created any events yet. Get started by creating your first event to import guests and issue tickets.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => {
            const isSelected = currentEvent?.id === event.id;
            return (
              <div
                key={event.id}
                onClick={() => setCurrentEvent(event)}
                className={`group relative bg-surface-card border rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand-500/60 ring-1 ring-brand-500/40 shadow-lg shadow-brand-500/5 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950'
                    : 'border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/60'
                }`}
              >
                <div>
                  {/* Card Header & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        event.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : event.status === 'COMPLETED'
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {event.status}
                    </span>

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Event Name */}
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors line-clamp-1 mb-2">
                    {event.name}
                  </h3>

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2 mb-4">
                      {event.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-zinc-300 mb-5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{event.date}</span>
                      {event.time && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock className="w-3 h-3 text-zinc-500 ml-1" />
                          {event.time}
                        </span>
                      )}
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                    {event.organizerName && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-zinc-400">Org: {event.organizerName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${event.id}`);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Manage</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(event.id, event.name, e)}
                      title="Delete Event"
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setCurrentEvent(event);
                        navigate('/');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600/90 hover:bg-brand-500 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      <span>Select</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Event Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white border border-surface-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-surface-border flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-brand-50 text-brand-600 border border-brand-200">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-surface-charcoal">Create New Event</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Event Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Global Tech Expo 2026"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Event Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time || ''}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Venue / Location
                  </label>
                  <input
                    type="text"
                    name="venue"
                    placeholder="e.g. Convention Hall B"
                    value={formData.venue || ''}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Organizer Name
                  </label>
                  <input
                    type="text"
                    name="organizerName"
                    placeholder="e.g. Tech Events Inc."
                    value={formData.organizerName || ''}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Brief overview of the event..."
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 shadow-sm resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
