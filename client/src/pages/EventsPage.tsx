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
import { Button, Badge, Modal, Input, InView, AnimatedGroup, EmptyEventsState } from '../components/ui';
import { formatLocalizedDate } from '../utils/date';

const formatVenueLabel = (venue: any): string => {
  if (!venue) return '';
  if (typeof venue === 'string') return venue.trim();
  if (typeof venue === 'object') {
    return (
      venue.name ||
      [venue.address, venue.city].filter(Boolean).join(', ') ||
      (venue.type === 'ONLINE' ? 'Online Virtual Event' : venue.type === 'HYBRID' ? 'Hybrid Event' : 'Physical Venue') ||
      ''
    );
  }
  return String(venue);
};

export const EventsPage: React.FC = () => {
  const { events, currentEvent, setCurrentEvent, refreshEvents, loading, error: eventLoadError } = useEvent();
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
      await refreshEvents(newEvent.id);
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
      {/* Top Banner (Seamless in single container box) */}
      <InView direction="up" distance={12}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="neutral">Event Management</Badge>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs text-stone-500 font-semibold">{events.length} {events.length === 1 ? 'Event' : 'Total Events'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">Your Events</h1>
            <p className="text-[10px] sm:text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
              Manage your event configurations, ticket categories, and guest lists in one place.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/events/create')}
              iconLeft={<Sparkles className="w-3.5 h-3.5 text-white" />}
              className="!rounded-full px-4 sm:px-5 py-2 shadow-xs hover:shadow-sm"
            >
              Create Event Wizard
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              iconLeft={<Plus className="w-3.5 h-3.5 text-stone-500" />}
              className="!rounded-full !border-0 text-stone-600 hover:text-stone-900 hover:bg-stone-100/80"
            >
              Quick Add
            </Button>
          </div>
        </div>
      </InView>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-xs font-medium p-8">
          <div className="w-7 h-7 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin mx-auto mb-2" />
          Loading your events...
        </div>
      ) : eventLoadError ? (
        <div className="p-8 rounded-2xl bg-white border border-stone-200/90 text-center space-y-4 max-w-lg mx-auto my-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900">Failed to Load Events</h3>
            <p className="text-xs text-stone-500 mt-1">{eventLoadError}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refreshEvents()}
            className="!rounded-full px-5 py-2"
          >
            Retry Loading Events
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="py-6 sm:py-10">
          <EmptyEventsState
            title="No Events Created Yet"
            description="Create your first event to start managing registrations and attendees."
            actionText="Create Event"
            onAction={() => navigate('/events/create')}
            actionIcon={<Sparkles className="w-3.5 h-3.5" />}
          />
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
                    ? 'border-stone-900 ring-2 ring-stone-900/10 shadow-md bg-stone-50/60'
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
                      <span className="flex items-center gap-1 text-[11px] font-bold text-white bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Event Name */}
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 group-hover:text-black transition-colors line-clamp-1 mb-2">
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
                      <span className="font-medium text-zinc-800">{formatLocalizedDate(event.date)}</span>
                      {event.time && (
                        <span className="flex items-center gap-1 text-stone-400">
                          <Clock className="w-3 h-3 ml-1" />
                          {event.time}
                        </span>
                      )}
                    </div>
                    {formatVenueLabel(event.venue) && (
                      <div className="flex items-center gap-2 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span className="truncate">{formatVenueLabel(event.venue)}</span>
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
                        <TicketIcon className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                        <span className="text-stone-800 font-semibold">{event.credentialTerminology}</span>
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
              className="w-full bg-white border border-stone-200/90 rounded-xl px-3.5 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-3 focus:ring-stone-400/20 shadow-2xs resize-none"
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
