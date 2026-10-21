import React, { useState, useEffect } from 'react';
import {
  Bell,
  Calendar,
  Ticket,
  ShieldCheck,
  Info,
  Check,
  Trash2,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'REGISTRATION' | 'SECURITY' | 'SYSTEM' | 'EVENT';
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = 'ticketification_user_notifications';

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');

  useEffect(() => {
    // Load persisted notification state
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setNotifications(JSON.parse(saved));
        return;
      } catch (e) {
        // Fall back to bootstrapping from recent activity
      }
    }

    // Initialize with system notification + registration updates
    const initNotifications: NotificationItem[] = [
      {
        id: 'sys-welcome',
        title: 'Welcome to Ticketification',
        message: 'Your account is verified and ready. You can explore public conferences, hackathons, and generate verified credentials.',
        category: 'SYSTEM',
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: 'sys-sec-1',
        title: 'Cryptographic Credential Engine Active',
        message: 'Your passes utilize dynamic HMAC verification tokens for anti-screenshot fraud prevention at venue turnstiles.',
        category: 'SECURITY',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true,
      },
    ];

    setNotifications(initNotifications);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initNotifications));
  }, []);

  const saveNotifications = (items: NotificationItem[]) => {
    setNotifications(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };


  const toggleReadStatus = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    saveNotifications([]);
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
            Stay informed about your registrations, ticket approvals, and schedule updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors shadow-2xs"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
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

      {/* List */}
      {filteredNotifications.length === 0 ? (
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
              You are all caught up. Updates on registrations, event check-ins, and schedule alterations will arrive here.
            </p>
          </div>
        </div>
      ) : (
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
                    {new Date(notif.timestamp).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
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
