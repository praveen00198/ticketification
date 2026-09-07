import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EventItem } from '../types';
import { eventsApi } from '../api/events';

interface EventContextType {
  events: EventItem[];
  currentEvent: EventItem | null;
  loading: boolean;
  error: string | null;
  setCurrentEvent: (event: EventItem | null) => void;
  selectEventById: (eventId: string) => void;
  refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [currentEvent, setCurrentEventState] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setCurrentEvent = (event: EventItem | null) => {
    setCurrentEventState(event);
    if (event) {
      localStorage.setItem('selected_event_id', event.id);
    } else {
      localStorage.removeItem('selected_event_id');
    }
  };

  const selectEventById = (eventId: string) => {
    const found = events.find((e) => e.id === eventId);
    if (found) {
      setCurrentEvent(found);
    }
  };

  const refreshEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getEvents();
      setEvents(data);

      const savedId = localStorage.getItem('selected_event_id');
      if (savedId) {
        const matched = data.find((e) => e.id === savedId);
        if (matched) {
          setCurrentEventState(matched);
          return;
        }
      }

      // Default to first event if available
      if (data.length > 0) {
        setCurrentEventState(data[0]);
        localStorage.setItem('selected_event_id', data[0].id);
      } else {
        setCurrentEventState(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      refreshEvents();
    } else {
      setLoading(false);
    }
  }, [refreshEvents]);

  return (
    <EventContext.Provider
      value={{
        events,
        currentEvent,
        loading,
        error,
        setCurrentEvent,
        selectEventById,
        refreshEvents,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};
