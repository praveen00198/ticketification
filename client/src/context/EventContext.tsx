import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EventItem } from '../types';
import { eventsApi } from '../api/events';
import { getStoredAuthToken, extractErrorMessage } from '../api/client';

interface EventContextType {
  events: EventItem[];
  currentEvent: EventItem | null;
  loading: boolean;
  error: string | null;
  setCurrentEvent: (event: EventItem | null) => void;
  selectEventById: (eventId: string) => void;
  refreshEvents: (preferredId?: string) => Promise<void>;
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

  const refreshEvents = useCallback(async (preferredId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await eventsApi.getEvents();
      // Normalize API response data exactly once into a validated EventItem[]
      const eventsList: EventItem[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.events)
        ? (data as any).events
        : [];
      setEvents(eventsList);

      const targetId = preferredId || localStorage.getItem('selected_event_id');
      if (targetId) {
        const matched = eventsList.find((e) => e.id === targetId);
        if (matched) {
          setCurrentEventState(matched);
          localStorage.setItem('selected_event_id', matched.id);
          return;
        }
      }

      // Only default to first event if currently on an event-specific route; otherwise keep global context clean
      const isEventRoute = window.location.pathname.startsWith('/events/') && !window.location.pathname.startsWith('/events/create');
      if (eventsList.length > 0 && isEventRoute) {
        setCurrentEventState(eventsList[0]);
        localStorage.setItem('selected_event_id', eventsList[0].id);
      } else {
        setCurrentEventState(null);
        localStorage.removeItem('selected_event_id');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load events'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredAuthToken();
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
