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
  Ticket as TicketIcon,
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
    if (
      !window.confirm(
        `Are you sure you want to delete "${eventName}"? All issued tickets and attendee lists associated with this event will be permanently deleted.`
      )
    ) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-stone-200/90 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Event Management
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Your Events</h1>
          <p className="text-xs text-stone-500 mt-1">
            Manage your event configurations, ticket categories, and guest lists in one place.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => navigate('/events/create')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-100" />
            <span>Create Event (Wizard)</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all border border-stone-200"
          >
            <Plus className="w-3.5 h-3.5 text-stone-500" />
            <span>Quick Add</span>
          </button>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-xs font-medium bg-white border border-stone-200/90 rounded-2xl p-8">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 animate-spin mx-auto mb-2" />
          Loading your events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-8 shadow-xs space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 tracking-tight">You Haven't Created Any Events Yet</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Ticketification is your unified platform to attend and organize events. Choose your journey below:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Pathway 1: Host an event */}
            <div className="p-5 rounded-xl border border-stone-200/90 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Host an Event</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Configure custom credential badges, venue logistics, registration caps, and real-time gate turnstiles.
                </p>
              </div>
              <button
                onClick={() => navigate('/events/create')}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
              >
                <span>Create Event Wizard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pathway 2: Discover and attend */}
            <div className="p-5 rounded-xl border border-stone-200/90 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200">
                  <Calendar className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Discover Events to Attend</h4>
                <p className="text-xs text-stone-500 mt-1">
                  Explore published hackathons, conferences, and workshops. Check eligibility and claim your pass.
                </p>
              </div>
              <button
                onClick={() => navigate('/explore')}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-white hover:bg-stone-100 text-zinc-800 text-xs font-semibold rounded-xl transition-all border border-stone-200 shadow-xs"
              >
                <span>Explore Events Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Pathway 3: Wallet */}
            <div className="p-5 rounded-xl border border-stone-200/90 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Access Your Passes</h4>
                <p className="text-xs text-stone-500 mt-1">
                  View your active registration credentials, dynamic QR entry tokens, and hackathon team rosters.
                </p>
              </div>
              <button
                onClick={() => navigate('/wallet')}
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 bg-white hover:bg-stone-100 text-zinc-800 text-xs font-semibold rounded-xl transition-all border border-stone-200 shadow-xs"
              >
                <span>Open Pass Wallet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {events.map((event) => {
            const isSelected = currentEvent?.id === event.id;
            return (
              <div
                key={event.id}
                onClick={() => setCurrentEvent(event)}
                className={`group relative bg-white border rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between shadow-xs ${
                  isSelected
                    ? 'border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-md bg-emerald-50/20'
                    : 'border-stone-200/90 hover:border-stone-300 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* Card Header & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          event.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            : event.status === 'DRAFT'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                            : event.status === 'COMPLETED'
                            ? 'bg-stone-100 text-stone-600 border border-stone-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200/80'
                        }`}
                      >
                        {event.status}
                      </span>
                      {event.eventType && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200/60">
                          {event.eventType}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Event Name */}
                  <h3 className="text-lg font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-1 mb-2">
                    {event.name}
                  </h3>

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-stone-500 line-clamp-2 mb-4">
                      {event.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-stone-600 mb-5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>{event.date}</span>
                      {event.time && (
                        <span className="flex items-center gap-1 text-stone-400">
                          <Clock className="w-3 h-3 text-stone-400 ml-1" />
                          {event.time}
                        </span>
                      )}
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                    )}
                    {event.organizerName && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        <span className="text-stone-500">Org: {event.organizerName}</span>
                      </div>
                    )}
                    {event.credentialTerminology && (
                      <div className="flex items-center gap-2">
                        <TicketIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-medium">{event.credentialTerminology}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${event.id}`);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-stone-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-stone-400" />
                    <span>Manage</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(event.id, event.name, e)}
                      title="Delete Event"
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setCurrentEvent(event);
                        navigate('/dashboard');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-2xs"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-zinc-900">Quick Create Event</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-stone-400 hover:text-zinc-700 text-sm font-bold"
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
                  className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
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
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
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
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
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
                    placeholder="e.g. Main Auditorium / Online"
                    value={formData.venue || ''}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Organizer / Host Name
                  </label>
                  <input
                    type="text"
                    name="organizerName"
                    placeholder="e.g. ACM Student Chapter"
                    value={formData.organizerName || ''}
                    onChange={handleInputChange}
                    className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
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
                  placeholder="Brief overview of event details..."
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  className="w-full bg-white border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-zinc-900 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all disabled:opacity-50"
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
