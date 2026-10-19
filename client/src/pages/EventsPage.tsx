import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../context/EventContext';
import { eventsApi, CreateEventPayload, EventType } from '../api/events';
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
  Compass,
  Wallet,
} from 'lucide-react';
import { RiMacbookLine, RiMicLine, RiMusic2Line, RiToolsLine } from '@remixicon/react';
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
      ) : events.length === 0 ? (
        <div className="py-2 sm:py-4 space-y-6">
          {/* Interactive Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
            {/* Card 1: Featured Host Card */}
            <div className="relative p-6 rounded-2xl border-2 border-stone-900/90 bg-gradient-to-b from-white to-stone-50/60 hover:shadow-lg transition-all flex flex-col justify-between space-y-5 shadow-xs group">
              <div className="absolute -top-3.5 left-6">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-900 text-white shadow-2xs tracking-wide uppercase">
                  Featured Action
                </span>
              </div>

              <div>
                <div className="w-11 h-11 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-3 shadow-2xs group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h4 className="text-base font-bold text-zinc-900">Host an Event</h4>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  Build custom credential badges, import guest rosters, configure live gate turnstiles, and coordinate staff.
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 pt-3">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Dynamic QR
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Live Turnstiles
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Staff Console
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/events/create')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
                  className="w-full !rounded-full py-2"
                >
                  Create Event Wizard
                </Button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="w-full text-center text-[11px] font-semibold text-stone-500 hover:text-stone-900 transition-colors py-1 cursor-pointer"
                >
                  Quick Add (Single Step)
                </button>
              </div>
            </div>

            {/* Card 2: Discover Events */}
            <div className="p-6 rounded-2xl border border-stone-200/90 hover:border-stone-400/80 bg-white hover:bg-stone-50/40 transition-all flex flex-col justify-between space-y-5 shadow-2xs hover:shadow-md group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-3 border border-stone-200/80 group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5 stroke-[2]" />
                </div>
                <h4 className="text-base font-bold text-zinc-900">Explore Catalog</h4>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  Discover published hackathons, developer conferences, and technical workshops open for registration.
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 pt-3">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Public Events
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Instant RSVP
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Schedule Sync
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/explore')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
                  className="w-full !rounded-full py-2"
                >
                  Browse Events
                </Button>
              </div>
            </div>

            {/* Card 3: Pass Wallet */}
            <div className="p-6 rounded-2xl border border-stone-200/90 hover:border-stone-400/80 bg-white hover:bg-stone-50/40 transition-all flex flex-col justify-between space-y-5 shadow-2xs hover:shadow-md group">
              <div>
                <div className="w-11 h-11 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-3 border border-stone-200/80 group-hover:scale-105 transition-transform">
                  <Wallet className="w-5 h-5 stroke-[2]" />
                </div>
                <h4 className="text-base font-bold text-zinc-900">My Pass Wallet</h4>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  Access your confirmed attendance passes, cryptographic QR entry tokens, and hackathon team rosters.
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-1.5 pt-3">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Offline Passes
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Team Roster
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold border border-stone-200/60">
                    Turnstile Ready
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/wallet')}
                  iconRight={<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
                  className="w-full !rounded-full py-2"
                >
                  Open Pass Wallet
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Template Starters */}
          <div className="py-3 text-center">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-2.5">
              Popular Event Types to Launch
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { label: 'Hackathon', type: 'HACKATHON' as EventType, icon: RiMacbookLine },
                { label: 'Conference', type: 'CONFERENCE' as EventType, icon: RiMicLine },
                { label: 'Concert & Music', type: 'CONCERT' as EventType, icon: RiMusic2Line },
                { label: 'Workshop & Bootcamp', type: 'WORKSHOP' as EventType, icon: RiToolsLine },
              ].map((template) => {
                const IconComponent = template.icon;
                return (
                  <button
                    key={template.label}
                    onClick={() => navigate(`/events/create?type=${template.type}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100/90 hover:bg-stone-200/80 text-stone-700 hover:text-stone-900 text-xs font-semibold border border-stone-200/70 transition-all cursor-pointer shadow-2xs hover:scale-102"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-stone-600" />
                    <span>{template.label}</span>
                  </button>
                );
              })}
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
