import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Ticket,
  Calendar,
  Compass,
  LayoutDashboard,
  FileSpreadsheet,
  QrCode,
  Wallet,
  Building2,
  Sparkles,
  Users,
  Award,
  ChevronDown,
  Plus,
  KeyRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useEvent } from '../../context/EventContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface SidebarProps {
  user: {
    id?: string;
    name: string;
    email: string;
    role?: string;
    isOnboarded?: boolean;
    organizationName?: string;
  } | null;
  onLogout: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  requiresEvent?: boolean;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  isMobile = false,
  onCloseMobile,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { events, currentEvent, setCurrentEvent } = useEvent();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Category-wise navigation configuration
  const categories: NavCategory[] = [
    {
      title: 'Core & Overview',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Events Catalog', path: '/events', icon: Calendar },
        { label: 'Explore Events', path: '/explore', icon: Compass },
      ],
    },
    {
      title: 'Event Operations',
      items: [
        { label: 'Import Guests', path: '/import', icon: FileSpreadsheet },
        { label: 'Issued Tickets', path: '/tickets', icon: Ticket },
        { label: 'Scan & Turnstiles', path: '/scan', icon: QrCode, badge: 'Live', badgeColor: 'bg-emerald-100 text-emerald-800' },
        ...(currentEvent
          ? [
              {
                label: 'Staff Console',
                path: `/events/${currentEvent.id}/staff-console`,
                icon: Users,
                requiresEvent: true,
              },
              {
                label: 'Judging & Mentors',
                path: `/events/${currentEvent.id}/review-workspace`,
                icon: Award,
                requiresEvent: true,
              },
            ]
          : []),
      ],
    },
    {
      title: 'Attendee & Wallet',
      items: [
        { label: 'My Pass Wallet', path: '/wallet', icon: Wallet },
      ],
    },
    {
      title: 'Workspace & Setup',
      items: [
        {
          label: 'Organizer Setup',
          path: '/onboarding',
          icon: Sparkles,
          badge: !user?.isOnboarded ? 'Required' : undefined,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
        { label: 'Organization Profile', path: '/settings/profile', icon: Building2 },
      ],
    },
  ];

  const handleLinkClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      <aside
        className={`bg-white border-r border-stone-200/90 flex flex-col transition-all duration-300 select-none z-30 ${
          isMobile
            ? 'w-72 h-full'
            : isCollapsed
            ? 'w-20 h-screen sticky top-0'
            : 'w-64 h-screen sticky top-0'
        }`}
      >
        {/* ── Brand Header ── */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-stone-200/80 shrink-0">
          <Link
            to="/dashboard"
            onClick={handleLinkClick}
            className="flex items-center gap-2.5 overflow-hidden group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30 shrink-0 group-hover:scale-105 transition-transform">
              <Ticket className="w-5 h-5 stroke-[2.2]" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="truncate">
                <span className="font-extrabold text-base tracking-tight text-zinc-900">
                  Ticketification<span className="text-emerald-500">.</span>
                </span>
                <span className="block text-[10px] font-semibold text-emerald-700 tracking-wider uppercase">
                  Event OS
                </span>
              </div>
            )}
          </Link>

          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-stone-100 transition-colors"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* ── Active Event Switcher Card ── */}
        {(!isCollapsed || isMobile) ? (
          <div className="p-3 border-b border-stone-200/80 bg-stone-50/60 shrink-0">
            <div className="relative">
              <button
                onClick={() => setEventMenuOpen(!eventMenuOpen)}
                className="w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-stone-200/90 text-left hover:border-emerald-500 shadow-xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Active Event
                    </div>
                    <div className="text-xs font-bold text-zinc-800 truncate">
                      {currentEvent ? currentEvent.name : 'Select Event'}
                    </div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-1" />
              </button>

              {/* Event Selector Dropdown */}
              {eventMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setEventMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100 flex items-center justify-between">
                      <span>Switch Active Event</span>
                      <span className="text-emerald-600">{events.length}</span>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1 space-y-0.5">
                      {events.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-stone-400">
                          No events found
                        </div>
                      ) : (
                        events.map((e) => {
                          const isSelected = currentEvent?.id === e.id;
                          return (
                            <button
                              key={e.id}
                              onClick={() => {
                                setCurrentEvent(e);
                                setEventMenuOpen(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80'
                                  : 'text-zinc-700 hover:bg-stone-50 hover:text-zinc-900'
                              }`}
                            >
                              <span className="truncate">{e.name}</span>
                              {isSelected && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="pt-1 mt-1 border-t border-stone-100">
                      <button
                        onClick={() => {
                          setEventMenuOpen(false);
                          handleLinkClick();
                          navigate('/events/create');
                        }}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Event</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 border-b border-stone-200/80 flex justify-center shrink-0">
            <button
              onClick={() => navigate('/events')}
              title={currentEvent ? currentEvent.name : 'Select Event'}
              className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Category-wise Navigation List ── */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {categories.map((category, catIdx) => (
            <div key={catIdx} className="space-y-1">
              {(!isCollapsed || isMobile) && (
                <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                  {category.title}
                </div>
              )}
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.path ||
                    (item.path === '/dashboard' && location.pathname === '/');

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                      title={isCollapsed && !isMobile ? item.label : undefined}
                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold shadow-xs border border-emerald-200/60'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-stone-50'
                      } ${isCollapsed && !isMobile ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-emerald-600'
                            : 'text-stone-400 group-hover:text-zinc-600'
                        }`}
                      />
                      {(!isCollapsed || isMobile) && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                item.badgeColor || 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── User & Workspace Bottom Footer ── */}
        <div className="p-3 border-t border-stone-200/90 bg-stone-50/50 shrink-0 space-y-2">
          {user && (!isCollapsed || isMobile) ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-stone-200/80 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-800 truncate">
                    {user.organizationName || user.name}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>
                      {user.role === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : user.role === 'ADMIN'
                        ? 'Admin'
                        : user.isOnboarded
                        ? 'Host'
                        : 'Setup Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  title="Change Password"
                  className="p-1.5 text-stone-400 hover:text-zinc-700 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                title="Change Password"
                className="w-9 h-9 rounded-xl text-stone-400 hover:text-zinc-700 hover:bg-stone-100 flex items-center justify-center transition-colors"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="w-9 h-9 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};
