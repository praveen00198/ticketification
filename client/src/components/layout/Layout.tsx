import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import {
  ChevronRight,
  Home,
  FileSpreadsheet,
  Ticket,
  QrCode,
  Calendar,
  Sparkles,
  Menu,
  X,
  Plus,
  Compass,
  Wallet,
  Building2,
  Users,
  Award,
} from 'lucide-react';
import { useEvent } from '../../context/EventContext';

interface LayoutProps {
  user: {
    id?: string;
    name: string;
    email: string;
    role?: string;
    isOnboarded?: boolean;
    organizationName?: string;
  } | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentEvent } = useEvent();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Dynamic breadcrumb resolution
  const getBreadcrumbs = () => {
    const path = location.pathname;

    if (path === '/dashboard' || path === '/') {
      return [{ label: 'Dashboard', path: '/dashboard', icon: Home }];
    }
    if (path === '/events') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Events Catalog', path: '/events', icon: Calendar },
      ];
    }
    if (path === '/events/create') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Events', path: '/events' },
        { label: 'New Event Wizard', path: '/events/create', icon: Sparkles },
      ];
    }
    if (path.startsWith('/events/') && path.includes('/staff-console')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: currentEvent ? currentEvent.name : 'Event', path: `/events/${currentEvent?.id || ''}` },
        { label: 'Staff Console', path, icon: Users },
      ];
    }
    if (path.startsWith('/events/') && path.includes('/review-workspace')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: currentEvent ? currentEvent.name : 'Event', path: `/events/${currentEvent?.id || ''}` },
        { label: 'Judging & Mentors', path, icon: Award },
      ];
    }
    if (path.startsWith('/events/')) {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Events', path: '/events' },
        { label: currentEvent ? currentEvent.name : 'Event Details', path, icon: Calendar },
      ];
    }
    if (path === '/import') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Import Guests', path: '/import', icon: FileSpreadsheet },
      ];
    }
    if (path === '/tickets') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Issued Tickets', path: '/tickets', icon: Ticket },
      ];
    }
    if (path === '/scan') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Scan & Turnstiles', path: '/scan', icon: QrCode },
      ];
    }
    if (path === '/wallet') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'My Pass Wallet', path: '/wallet', icon: Wallet },
      ];
    }
    if (path === '/explore') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Explore Events', path: '/explore', icon: Compass },
      ];
    }
    if (path === '/onboarding') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Organizer Onboarding', path: '/onboarding', icon: Sparkles },
      ];
    }
    if (path === '/settings/profile') {
      return [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Organizer Settings', path: '/settings/profile', icon: Building2 },
      ];
    }

    return [{ label: 'Dashboard', path: '/dashboard', icon: Home }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen flex bg-[#FAFAF9] text-[#18181B] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Desktop Fixed Sidebar ── */}
      <div className="hidden md:block shrink-0">
        <Sidebar user={user} onLogout={onLogout} />
      </div>

      {/* ── Mobile Sidebar Drawer & Overlay ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 flex max-w-[85vw] animate-in slide-in-from-left duration-250">
            <Sidebar
              user={user}
              onLogout={onLogout}
              isMobile
              onCloseMobile={() => setMobileSidebarOpen(false)}
            />
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="m-2.5 p-2 bg-white/95 rounded-full text-stone-500 hover:text-stone-900 shadow-md h-9 w-9 flex items-center justify-center shrink-0 self-start border border-stone-200"
              aria-label="Close mobile sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header / Bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-3.5 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 -ml-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-stone-100 rounded-xl transition-colors shrink-0"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Path */}
            <nav className="flex items-center gap-1 sm:gap-1.5 text-xs overflow-hidden" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                const Icon = crumb.icon;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    )}
                    {isLast ? (
                      <span className="font-bold text-zinc-900 truncate flex items-center gap-1.5 bg-stone-100/80 px-2 py-0.5 rounded-md text-[11px] sm:text-xs">
                        {Icon && <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                        <span className="truncate">{crumb.label}</span>
                      </span>
                    ) : (
                      <Link
                        to={crumb.path}
                        className="text-stone-500 hover:text-zinc-900 transition-colors font-medium truncate flex items-center gap-1 text-[11px] sm:text-xs hidden sm:flex"
                      >
                        {Icon && <Icon className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
                        <span>{crumb.label}</span>
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Onboarding Alert Pill */}
            {user && !user.isOnboarded && (
              <button
                onClick={() => navigate('/onboarding')}
                className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-full hover:bg-amber-100 transition-colors shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Finish Setup</span>
              </button>
            )}

            {/* Quick Action: New Event */}
            <button
              onClick={() => navigate('/events/create')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Event</span>
            </button>

            {/* Quick Action: Scan */}
            <button
              onClick={() => navigate('/scan')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-stone-100/90 hover:bg-stone-200 hover:text-zinc-900 rounded-xl border border-stone-200/80 transition-colors shadow-2xs"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Turnstiles</span>
              <span className="sm:hidden text-[11px]">Scan</span>
            </button>
          </div>
        </header>

        {/* ── Page Content Container ── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6">
          {children}
        </main>

        {/* ── Global Footer ── */}
        <footer className="bg-white/80 border-t border-stone-200/80 py-3 px-4 text-center text-[11px] text-stone-400">
          Ticketification OS &bull; Operational Event Credential & Verification Platform &bull; 2026
        </footer>
      </div>
    </div>
  );
};
