import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Calendar,
  Ticket,
  ShieldCheck,
  Info,
  Check,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { attendeeApi } from '../api/attendee';
import { apiClient, extractErrorMessage } from '../api/client';
import { formatLocalizedDateTime } from '../utils/date';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'REGISTRATION' | 'SECURITY' | 'SYSTEM' | 'EVENT';
  timestamp: string | null;
  read: boolean;
}

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const getStorageKey = (uid: string) => `ticketification_read_notifications_${uid}`;

  const loadUserAndReadState = useCallback(async () => {
    try {
      const meRes: any = await apiClient.get('/auth/me');
      const user = meRes?.data || meRes?.user;
      if (user && user.id) {
        setCurrentUserId(user.id);
        const saved = localStorage.getItem(getStorageKey(user.id));
        if (saved) {
          try {
            setReadIds(new Set(JSON.parse(saved)));
          } catch {
            setReadIds(new Set());
          }
        }
        return user.id;
      }
    } catch {
      // In case of auth load error, continue with anonymous isolation
    }
    return null;
  }, []);

  const loadRealActivityNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Resolve user ID first to ensure proper per-user read/unread scoping
      const uid = await loadUserAndReadState();
      const currentReadSet = uid
        ? (() => {
            try {
              const saved = localStorage.getItem(getStorageKey(uid));
              return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
            } catch {
              return new Set<string>();
            }
          })()
        : new Set<string>();

      const [regRes, passesRes] = await Promise.all([
        attendeeApi.getMyRegistrations(),
        apiClient.get('/tickets/my-passes'),
      ]);

      const items: NotificationItem[] = [];

      // 1. Derive real notifications from confirmed/pending registrations
      if (regRes.success && Array.isArray(regRes.data)) {
        for (const reg of regRes.data) {
          const eventName = reg.event?.name || reg.eventId?.name || 'Registered Event';
          const regId = reg.id || reg._id;
          const status = reg.status || 'CONFIRMED';
          const rawDate = reg.createdAt || reg.registeredAt;
          const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());
          const dateStr = isValidDate ? new Date(rawDate).toISOString() : null;
          const notifId = `reg-${regId}`;

          items.push({
            id: notifId,
            title:
              status === 'CONFIRMED'
                ? `Registration Confirmed: ${eventName}`
                : status === 'CANCELLED'
                ? `Registration Cancelled: ${eventName}`
                : `Registration Pending: ${eventName}`,
            message:
              status === 'CONFIRMED'
                ? `Your registration is confirmed. Your digital credential is ready in your Attendee Wallet.`
                : status === 'CANCELLED'
                ? `Your registration for ${eventName} has been cancelled.`
                : `Your registration request is pending host review.`,
            category: 'REGISTRATION',
            timestamp: dateStr,
            read: currentReadSet.has(notifId),
          });
        }
      }

      // 2. Derive real notifications from verified turnstile check-in passes
      const passesData = passesRes?.data?.passes || passesRes?.data;
      if (Array.isArray(passesData)) {
        for (const pass of passesData) {
          if (pass.status === 'USED' || pass.checkedIn) {
            const passId = pass.id || pass._id;
            const eventName = pass.eventName || 'Event';
            const notifId = `checkin-${passId}`;
            const rawDate = pass.checkedInAt || pass.firstCheckedInAt || pass.updatedAt;
            const isValidDate = rawDate && !isNaN(new Date(rawDate).getTime());
            const dateStr = isValidDate ? new Date(rawDate).toISOString() : null;

            items.push({
              id: notifId,
              title: `Turnstile Check-In Verified: ${eventName}`,
              message: `Your gate credential was scanned and successfully verified at the venue turnstile.`,
              category: 'EVENT',
              timestamp: dateStr,
              read: currentReadSet.has(notifId),
            });
          }
        }
      }

      // Sort newest notifications first; items without timestamp sort to the bottom
      items.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });
      setNotifications(items);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to retrieve notification updates. Please retry.'));
    } finally {
      setLoading(false);
    }
  }, [loadUserAndReadState]);

  useEffect(() => {
    loadRealActivityNotifications();
  }, [loadRealActivityNotifications]);

  const persistReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    if (currentUserId) {
      localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(Array.from(newSet)));
    }
  };

  const toggleReadStatus = (id: string) => {
    const nextSet = new Set(readIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    persistReadIds(nextSet);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: nextSet.has(id) } : n))
    );
  };

  const markAllAsRead = () => {
    const nextSet = new Set(readIds);
    notifications.forEach((n) => nextSet.add(n.id));
    persistReadIds(nextSet);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'READ') return n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'REGISTRATION':
        return <Ticket className="w-4 h-4 text-emerald-600" />;
      case 'SECURITY':
        return <ShieldCheck className="w-4 h-4 text-blue-600" />;
      case 'EVENT':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      default:
        return <Info className="w-4 h-4 text-stone-600" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 mt-1">
            Real-time event updates, registration confirmations, and turnstile check-in records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRealActivityNotifications}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Count */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg border border-stone-200">
          {(['ALL', 'UNREAD', 'READ'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === tab
                  ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-zinc-900'
              }`}
            >
              {tab === 'ALL'
                ? `All (${notifications.length})`
                : tab === 'UNREAD'
                ? `Unread (${unreadCount})`
                : `Read (${notifications.length - unreadCount})`}
            </button>
          ))}
        </div>

        <span className="text-xs text-stone-400">
          Showing {filteredNotifications.length} items
        </span>
      </div>

      {/* Error state with explicit retry */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadRealActivityNotifications}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-300 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors shrink-0 shadow-2xs"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs font-medium text-stone-500">Checking for event updates...</p>
        </div>
      ) : !error && filteredNotifications.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50 p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900">
              {filter === 'UNREAD'
                ? 'No unread notifications'
                : filter === 'READ'
                ? 'No read notifications'
                : 'Notification center is empty'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              You are all caught up. Updates on event registrations, credential passes, and turnstile check-ins will arrive here.
            </p>
          </div>
        </div>
      ) : !error && (
        <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 overflow-hidden shadow-2xs">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 transition-colors flex items-start justify-between gap-4 ${
                notif.read ? 'bg-white' : 'bg-emerald-50/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${
                    notif.read
                      ? 'bg-stone-100 border-stone-200 text-stone-500'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {getCategoryIcon(notif.category)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4
                      className={`text-sm ${
                        notif.read ? 'font-medium text-zinc-700' : 'font-bold text-zinc-900'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                    {notif.message}
                  </p>
                  <span className="text-[11px] text-stone-400 block pt-0.5">
                    {notif.timestamp ? formatLocalizedDateTime(notif.timestamp) : 'Date unavailable'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-1">
                <button
                  onClick={() => toggleReadStatus(notif.id)}
                  title={notif.read ? 'Mark as unread' : 'Mark as read'}
                  className="px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:text-zinc-900 hover:bg-stone-100 rounded-md transition-colors border border-stone-200"
                >
                  {notif.read ? 'Mark unread' : 'Mark read'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default NotificationsPage;
