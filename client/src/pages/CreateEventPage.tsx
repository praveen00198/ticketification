import React from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { EventCreationWizard } from '../components/events/EventCreationWizard';
import { useEvent } from '../context/EventContext';
import { EventType } from '../api/events';

export const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const initialEventType = rawType ? (rawType.toUpperCase() as EventType) : undefined;
  const { refreshEvents, setCurrentEvent } = useEvent();

  const handleSuccess = async (createdEvent: any) => {
    try {
      await refreshEvents();
      if (createdEvent) {
        setCurrentEvent({
          id: createdEvent._id || createdEvent.id,
          name: createdEvent.name,
          date: createdEvent.schedule?.startAt || createdEvent.date || new Date().toISOString(),
          venue: createdEvent.venue?.name || createdEvent.venue || 'TBD',
          time: createdEvent.schedule?.startAt
            ? new Date(createdEvent.schedule.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '09:00',
          status: createdEvent.status || 'DRAFT',
          createdBy: createdEvent.ownerId || createdEvent.createdBy || '',
          createdAt: createdEvent.createdAt || new Date().toISOString(),
          updatedAt: createdEvent.updatedAt || new Date().toISOString(),
          eventType: createdEvent.eventType,
          credentialTerminology: createdEvent.credentialTerminology,
        });
      }
    } catch {
      // Ignore background refresh errors
    }
    navigate('/dashboard');
  };

  const handleCancel = () => {
    navigate('/events');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/events')}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-zinc-900 transition-colors"
            title="Return to Events"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <Link to="/events" className="hover:text-stone-900 transition-colors">
                Events
              </Link>
              <span>/</span>
              <span className="text-zinc-700 font-semibold">New Event Wizard</span>
            </div>
            <h1 className="text-xl font-bold text-zinc-900 mt-0.5">
              Create Event Draft
            </h1>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200/80 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-stone-600" />
          <span>Event Wizard</span>
        </div>
      </div>

      {/* Main Wizard Card */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
        <div className="p-6 sm:p-8">
          <EventCreationWizard
            initialEventType={initialEventType}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
};
