import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from './paths';

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  isLoading,
}) => {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">
            Restoring Session
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve requested return URL safely
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.LOGIN}?redirect=${returnUrl}`} replace />;
  }

  return <Outlet />;
};
