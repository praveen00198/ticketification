import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EventCreationWizard } from '../components/events/EventCreationWizard';
import { useEvent } from '../context/EventContext';
import { EventType, normalizeEventItem } from '../api/events';

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
        const normalized = normalizeEventItem(createdEvent);
        setCurrentEvent(normalized);
        navigate(`/events/${normalized.id}`);
        return;
      }
    } catch {
      // Ignore background refresh errors
    }
    navigate('/events');
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
