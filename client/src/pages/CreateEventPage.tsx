import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    <div className="w-full flex-1 flex flex-col min-h-full">
      <EventCreationWizard
        initialEventType={initialEventType}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};
