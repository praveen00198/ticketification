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
import { Button, Badge, Modal, Input, InView, AnimatedGroup } from '../components/ui';

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
      <InView direction="up" distance={12}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white border border-stone-200/90 p-5 sm:p-6 rounded-2xl shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="emerald">Event Management</Badge>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs text-stone-500 font-semibold">{events.length} Total Events</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">Your Events</h1>
            <p className="text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
              Manage your event configurations, ticket categories, and guest lists in one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/events/create')}
              iconLeft={<Sparkles className="w-4 h-4 text-emerald-100" />}
            >
              Create Event Wizard
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              iconLeft={<Plus className="w-3.5 h-3.5 text-stone-500" />}
            >
              Quick Add
            </Button>
          </div>
        </div>
      </InView>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-xs font-medium bg-white border border-stone-200/90 rounded-2xl p-8 shadow-xs">
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500/30 border-t-emerald-600 animate-spin mx-auto mb-2" />
          Loading your events...
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100/80 shadow-2xs">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 tracking-tight">You Haven&apos;t Created Any Events Yet</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Ticketification is your unified platform to attend and organize events. Choose your journey below:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50 hover:bg-white shadow-2xs group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 border border-emerald-200/80 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Host an Event</h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Configure custom credential badges, venue logistics, registration caps, and real-time gate turnstiles.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/events/create')}
                iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full"
              >
                Create Event Wizard
              </Button>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50 hover:bg-white shadow-2xs group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3 border border-sky-200/80 group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Discover Events to Attend</h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Explore published hackathons, conferences, and workshops. Check eligibility and claim your pass.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/explore')}
                iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full"
              >
                Explore Events Catalog
              </Button>
            </div>

            <div className="p-5 rounded-2xl border border-stone-200/90 hover:border-emerald-500/60 transition-all flex flex-col justify-between space-y-4 bg-stone-50/50 hover:bg-white shadow-2xs group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3 border border-amber-200/80 group-hover:scale-105 transition-transform">
                  <TicketIcon className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-zinc-900">Access Your Passes</h4>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  View your active registration credentials, dynamic QR entry tokens, and hackathon team rosters.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/wallet')}
                iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full"
              >
                Open Pass Wallet
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <AnimatedGroup staggerDelay={60} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                      <Badge
                        variant={
                          event.status === 'ACTIVE' || event.status === 'PUBLISHED'
                            ? 'emerald'
                            : event.status === 'DRAFT'
                            ? 'amber'
                            : event.status === 'COMPLETED'
                            ? 'neutral'
                            : 'sky'
                        }
                        size="sm"
                      >
                        {event.status}
                      </Badge>
                      {event.eventType && (
                        <Badge variant="neutral" size="sm">
                          {event.eventType}
                        </Badge>
                      )}
                    </div>

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Event Name */}
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors line-clamp-1 mb-2">
                    {event.name}
                  </h3>

                  {/* Description */}
                  {event.description && (
                    <p className="text-xs text-stone-500 line-clamp-2 mb-4 leading-relaxed">
                      {event.description}
                    </p>
                  )}

                  {/* Details */}
                  <div className="space-y-2 text-xs text-stone-600 mb-5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="font-medium text-zinc-800">{event.date}</span>
                      {event.time && (
                        <span className="flex items-center gap-1 text-stone-400">
                          <Clock className="w-3 h-3 ml-1" />
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
                        <Users className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="text-stone-500 truncate">Host: {event.organizerName}</span>
                      </div>
                    )}
                    {event.credentialTerminology && (
                      <div className="flex items-center gap-2">
                        <TicketIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 font-semibold">{event.credentialTerminology}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3.5 border-t border-stone-100 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${event.id}`);
                    }}
                    iconLeft={<Settings className="w-3.5 h-3.5 text-stone-400" />}
                  >
                    Manage
                  </Button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDelete(event.id, event.name, e)}
                      title="Delete Event"
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      aria-label="Delete Event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <Button
                      variant={isSelected ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => {
                        setCurrentEvent(event);
                        navigate('/dashboard');
                      }}
                      iconRight={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      {isSelected ? 'Dashboard' : 'Select'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </AnimatedGroup>
      )}

      {/* Quick Create Event Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Quick Create Event"
        description="Fill in the basic event parameters to quickly draft your event."
        maxWidth="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Event Name"
            name="name"
            required
            placeholder="e.g. Global Tech Expo 2026"
            value={formData.name}
            onChange={handleInputChange}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="date"
              label="Event Date"
              name="date"
              required
              value={formData.date}
              onChange={handleInputChange}
            />

            <Input
              type="time"
              label="Start Time"
              name="time"
              value={formData.time || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Venue / Location"
              name="venue"
              placeholder="e.g. Main Auditorium / Online"
              value={formData.venue || ''}
              onChange={handleInputChange}
            />

            <Input
              label="Organizer / Host Name"
              name="organizerName"
              placeholder="e.g. ACM Student Chapter"
              value={formData.organizerName || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-zinc-700 select-none">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Brief overview of event details..."
              value={formData.description || ''}
              onChange={handleInputChange}
              className="w-full bg-white border border-stone-200/90 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 shadow-2xs resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={creating}
            >
              Create Event
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
