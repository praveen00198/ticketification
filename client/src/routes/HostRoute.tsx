import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ShieldAlert, Sparkles, Compass, Wallet } from 'lucide-react';
import { useEvent } from '../context/EventContext';
import { isHostOrOrganizer, UserIdentity } from '../utils/permissions';
import { Button } from '../components/ui';
import { ROUTES } from './paths';

interface HostRouteProps {
  user: UserIdentity | null;
}

export const HostRoute: React.FC<HostRouteProps> = ({ user }) => {
  const { events } = useEvent();
  const navigate = useNavigate();

  const isAuthorized = isHostOrOrganizer(user, events.length > 0);

  if (!isAuthorized) {
    return (
      <div className="max-w-xl mx-auto my-auto py-12 px-4 text-center space-y-6">
        <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <ShieldAlert className="w-7 h-7 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">
            Organizer Access Required
          </h2>
          <p className="text-xs text-stone-500 leading-relaxed max-w-md mx-auto">
            This module contains operational tools for event hosts (guest roster imports, issued ticket management, and live gate turnstiles). Complete organizer setup or explore attendee features below.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(ROUTES.ONBOARDING)}
            iconLeft={<Sparkles className="w-3.5 h-3.5 text-white" />}
            className="!rounded-full px-5 py-2.5 w-full sm:w-auto"
          >
            Become an Organizer
          </Button>

          <Button
            variant="secondary"
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
