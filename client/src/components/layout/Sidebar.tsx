import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Ticket,
  Calendar,
  ChevronDown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  User,
} from "lucide-react";
import { useEvent } from "../../context/EventContext";
import {
  getNavigationCategories,
  getUserDisplayRole,
  isHostWorkspaceMode,
  isEventSwitcherVisible,
  NavCategory,
} from "../../utils/permissions";

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
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  isMobile = false,
  onCloseMobile,
  isCollapsed: propIsCollapsed,
  setIsCollapsed: propSetIsCollapsed,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { events, currentEvent, setCurrentEvent } = useEvent();

  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;
  const setIsCollapsed = propSetIsCollapsed || setInternalCollapsed;
  const [eventMenuOpen, setEventMenuOpen] = useState(false);

  const isInHostMode = isHostWorkspaceMode(location.pathname, currentEvent);

  // Event Switcher is exclusively for switching between existing events.
  // In Global User Dashboard (!isInHostMode), it is hidden if the user has created 0 events.
  // Once the user has at least one event they are authorized to access, it is displayed.
  // In Host Mode (isInHostMode), it is displayed to allow switching between managed events and exiting.
  const shouldShowEventSwitcher = isEventSwitcherVisible({
    isCollapsed,
    isMobile,
    isInHostMode,
    eventsCount: events.length,
  });

  // Category-wise dynamic navigation configuration filtered by user platform role and host capability
  const categories: NavCategory[] = getNavigationCategories({
    user,
    currentEvent,
    pathname: location.pathname,
  });

  const handleLinkClick = () => {
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      <aside
        className={`flex flex-col transition-all duration-300 select-none z-30 ${
          isMobile
            ? "w-64 h-full bg-[#FAFAF9]"
            : isCollapsed
              ? "w-16 h-screen sticky top-0 bg-transparent border-none"
              : "w-64 h-screen sticky top-0 bg-transparent border-none"
        }`}
      >
        {/* ── Brand Header (No Separation Line) ── */}
        <div className="h-14 sm:h-16 relative flex items-center justify-between px-3 shrink-0">
          <Link
            to="/dashboard"
            onClick={handleLinkClick}
            title={isCollapsed && !isMobile ? "Ticketification - Dashboard" : undefined}
            className={`flex items-center gap-2.5 overflow-hidden group ${
              isCollapsed && !isMobile ? "w-full justify-center" : ""
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-2xs shrink-0 group-hover:scale-105 transition-transform">
              <Ticket className="w-4 h-4 stroke-[2.2]" />
            </div>
            {(!isCollapsed || isMobile) && (
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-zinc-900">
                    Ticketification
                  </span>
                  {isInHostMode && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Host
                    </span>
                  )}
                </div>
                <span className="block text-[10px] font-semibold text-stone-500 tracking-wider uppercase font-mono">
                  {isInHostMode ? "Event Workspace" : "Event OS"}
                </span>
              </div>
            )}
          </Link>

          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`rounded-full bg-stone-50 hover:bg-stone-200 text-stone-700 border border-stone-50 transition-colors cursor-pointer shadow-2xs shrink-0 ${
                isCollapsed ? "absolute right-0.5 top-6" : ""
              }`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* ── Active Event Switcher (Exclusively for switching between existing events; hidden in Global User Dashboard when 0 events) ── */}
        {shouldShowEventSwitcher && (
          <div className="py-1.5 shrink-0 px-3">
            <div>
              <button
                onClick={() => setEventMenuOpen(!eventMenuOpen)}
                className="w-full flex items-center justify-between gap-2.5 py-2 rounded-xl text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded bg-stone-200/70 flex items-center justify-center text-stone-700 shrink-0 group-hover:bg-stone-300/60 transition-colors">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold tracking-wider text-stone-400">
                      Active Event
                    </div>
                    <div className="text-[13px] font-semibold leading-tight text-stone-900 truncate">
                      {currentEvent ? currentEvent.name : "Select Event"}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 shrink-0 ml-1 transition-transform duration-200 ${
                    eventMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Inline Event Selector (Shifts sidebar elements below instead of floating overlay) */}
              {eventMenuOpen && (
                <div className="mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-stone-400 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <span>Events You Manage</span>
                    <span className="text-stone-700 font-mono">
                      {events.length}
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto sidebar-scrollbar p-1 space-y-0.5">
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
                              navigate(`/events/${e.id}`);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-stone-900 text-white font-semibold"
                                : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                            }`}
                          >
                            <span className="truncate">{e.name}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Category-wise Navigation List ── */}
        <div
          className={`flex-1 overflow-y-auto sidebar-scrollbar py-3 space-y-4 ${
            isCollapsed && !isMobile ? "px-2" : "px-3"
          }`}
        >
          {categories.map((category, catIdx) => (
            <div
              key={catIdx}
              className={`space-y-1 ${
                isCollapsed && !isMobile ? "flex flex-col items-center" : ""
              }`}
            >
              {(!isCollapsed || isMobile) && (
                <div className="pb-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                  {category.title}
                </div>
              )}
              <div
                className={`space-y-1 ${
                  isCollapsed && !isMobile ? "flex flex-col items-center w-full" : "space-y-0.5"
                }`}
              >
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const itemPathOnly = item.path.split('?')[0].split('#')[0];
                  const itemQuery = item.path.includes('?') ? '?' + item.path.split('?')[1] : '';
                  const isActive = itemQuery
                    ? location.pathname === itemPathOnly && (location.search === itemQuery || (!location.search && itemQuery === '?tab=overview'))
                    : (location.pathname === item.path && !location.search) ||
                      (item.path === "/dashboard" && location.pathname === "/");

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                      title={isCollapsed && !isMobile ? item.label : undefined}
                      className={`group flex items-center transition-all ${
                        isCollapsed && !isMobile
                          ? "w-9 h-9 rounded-xl justify-center"
                          : "gap-2.5 px-3 py-2 rounded text-xs font-medium"
                      } ${
                        isActive
                          ? "bg-stone-900 text-white font-semibold shadow-2xs"
                          : "text-stone-600 hover:text-stone-950 hover:bg-stone-200/50"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-white"
                            : "text-stone-400 group-hover:text-stone-700"
                        }`}
                      />
                      {(!isCollapsed || isMobile) && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                item.badgeColor ||
                                "bg-stone-200/60 text-stone-700"
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

        {/* ── User & Workspace Bottom Footer (No Box, No Line) ── */}
        <div
          className={`${
            isCollapsed && !isMobile ? "px-2" : "px-3"
          } py-3 shrink-0`}
        >
          {user && (!isCollapsed || isMobile) ? (
            <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl hover:bg-stone-200/40 transition-colors">
              <Link
                to="/settings/profile"
                onClick={handleLinkClick}
                className="flex items-center gap-2.5 min-w-0 flex-1 group"
                title="View Profile"
              >
                <div className="w-8 h-8 rounded-full bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-900 truncate group-hover:text-stone-950">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate">
                      {isInHostMode ? getUserDisplayRole(user, currentEvent) : (user.role === 'ADMIN' ? 'Admin' : user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'User')}
                      {user.organizationName ? ` • ${user.organizationName}` : ''}
                    </span>
                  </div>
                </div>
              </Link>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <Link
                to="/settings/profile"
                onClick={handleLinkClick}
                title={user ? `${user.name} - Profile` : "Profile"}
                className="w-9 h-9 rounded-xl bg-stone-900 text-white font-bold text-xs flex items-center justify-center hover:bg-stone-800 transition-colors shadow-2xs cursor-pointer"
              >
                {user?.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
