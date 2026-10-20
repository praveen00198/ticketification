import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { WifiOff, RotateCw, LogOut } from 'lucide-react';
import { ROUTES } from './paths';

export type AuthStatus =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'VERIFICATION_FAILED';

export interface ProtectedRouteProps {
  authStatus?: AuthStatus;
  authError?: string | null;
  onRetry?: () => void;
  onSignOut?: () => void;
  /** Backward-compatible flags */
  isAuthenticated?: boolean;
  isLoading?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  authStatus,
  authError,
  onRetry,
  onSignOut,
  isAuthenticated,
  isLoading,
}) => {
  const location = useLocation();

  // Resolve effective status supporting both explicit authStatus and legacy props
  const effectiveStatus: AuthStatus =
    authStatus ||
    (isLoading
      ? 'INITIALIZING'
      : isAuthenticated
      ? 'AUTHENTICATED'
      : 'UNAUTHENTICATED');

  // 1. Session verification in progress
  if (effectiveStatus === 'INITIALIZING') {
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

  // 2. Recoverable session verification error (network offline / timeout / server 5xx)
  // CRITICAL: Must NEVER clear stored token, claim account is invalid, or redirect to login.
  // Data is protected (Outlet is NOT rendered) until verification succeeds.
  if (effectiveStatus === 'VERIFICATION_FAILED') {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 sm:p-8 text-center space-y-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200/60 shadow-2xs">
            <WifiOff className="w-7 h-7 stroke-[2]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-stone-900 tracking-tight">
              Session Verification Paused
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
              We couldn't verify your account session due to a temporary network disruption or server timeout. Your credentials remain securely saved on this device.
            </p>
            {authError && (
              <div className="mt-3 p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 font-mono break-words text-left">
                <span className="font-semibold text-stone-800">Connection error: </span>
                {authError}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-black rounded-full shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign In Again</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Definitive unauthenticated state: redirect to login preserving intended target URL
  if (effectiveStatus === 'UNAUTHENTICATED') {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.LOGIN}?redirect=${returnUrl}`} replace />;
  }

  // 4. Authenticated & verified: render protected route tree
  return <Outlet />;
};
