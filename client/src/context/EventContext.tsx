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

      // Check if user is currently on an explicit event-scoped route
      const pathname = window.location.pathname;
      const isEventRoute =
        (pathname.startsWith('/events/') && !pathname.startsWith('/events/create')) ||
        ['/import', '/tickets', '/scan', '/reports'].includes(pathname);

      // 1. Explicit event selection (e.g. from Event Switcher or creation)
      if (preferredId) {
        const matched = eventsList.find((e) => e.id === preferredId);
        if (matched) {
          setCurrentEventState(matched);
          localStorage.setItem('selected_event_id', matched.id);
          return;
        }
      } else if (isEventRoute) {
        // 2. Explicit event-scoped URL navigation: resolve event ID from URL path or stored ID
        const eventIdMatch = pathname.match(/^\/events\/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)/);
        const urlEventId = eventIdMatch ? eventIdMatch[1] : null;
        const targetId = urlEventId || localStorage.getItem('selected_event_id');

        if (targetId) {
          const matched = eventsList.find((e) => e.id === targetId);
          if (matched) {
            setCurrentEventState(matched);
            localStorage.setItem('selected_event_id', matched.id);
            return;
          }
        }

        // Direct server-side verification for direct URL navigation
        if (urlEventId && urlEventId !== 'create') {
          try {
            const directEvent = await eventsApi.getEvent(urlEventId);
            if (directEvent) {
              setCurrentEventState(directEvent);
              localStorage.setItem('selected_event_id', directEvent.id);
              return;
            }
          } catch {
            // Inaccessible, deleted, or unauthorized event: fail closed
            setCurrentEventState(null);
            localStorage.removeItem('selected_event_id');
            return;
          }
        }
      }

      // 3. Global workspace routes: keep global context clean without silent host workspace mode
      setCurrentEventState(null);
      localStorage.removeItem('selected_event_id');
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
