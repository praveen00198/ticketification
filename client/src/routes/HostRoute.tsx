import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ShieldAlert, Sparkles, Compass, Wallet, Calendar } from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { isHostOrOrganizer, UserIdentity } from '../utils/permissions';
import { Button } from '../components/ui';
import { ROUTES } from './paths';

interface HostRouteProps {
  user: UserIdentity | null;
}

export const HostRoute: React.FC<HostRouteProps> = ({ user }) => {
  const { currentEvent, loading } = useEvent();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Loading Workspace...</span>
        </div>
      </div>
    );
  }

  const isAuthorized = isHostOrOrganizer(user, currentEvent);

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto my-auto py-12 px-4 text-center space-y-6">
        <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <ShieldAlert className="w-7 h-7 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Event Management Access Required
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed max-w-md mx-auto">
            This module contains operational tools for managing a specific event (guest roster imports, issued ticket management, and live turnstiles). Select an event you organize from My Events, or create a new event.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(ROUTES.EVENTS)}
            iconLeft={<Calendar className="w-3.5 h-3.5 text-white" />}
            className="!rounded-full px-5 py-2.5 w-full sm:w-auto"
          >
            My Events
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(ROUTES.CREATE_EVENT)}
            iconLeft={<Sparkles className="w-3.5 h-3.5 text-stone-700" />}
            className="!rounded-full px-5 py-2.5 w-full sm:w-auto"
          >
            Create New Event
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.EXPLORE)}
            iconLeft={<Compass className="w-3.5 h-3.5 text-stone-600" />}
            className="!rounded-full px-5 py-2.5 w-full sm:w-auto"
          >
            Explore Events
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.WALLET)}
            iconLeft={<Wallet className="w-3.5 h-3.5 text-stone-500" />}
            className="!rounded-full px-4 py-2.5 w-full sm:w-auto"
          >
            My Pass Wallet
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};
