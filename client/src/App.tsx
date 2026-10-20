import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { EventProvider } from './context/EventContext';
import { apiClient, getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from './api/client';
import { HostProfileData } from './api/host';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// ─── Eagerly loaded (critical path — needed immediately on first paint) ───────
import { PublicLandingPage } from './pages/PublicLandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// ─── Lazily loaded (downloaded only when user navigates to the route) ─────────
const Dashboard                  = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const EventsPage                 = lazy(() => import('./pages/EventsPage').then(m => ({ default: m.EventsPage })));
const EventDetailPage            = lazy(() => import('./pages/EventDetailPage').then(m => ({ default: m.EventDetailPage })));
const GuestImport                = lazy(() => import('./pages/GuestImport').then(m => ({ default: m.GuestImport })));
const TicketList                 = lazy(() => import('./pages/TicketList').then(m => ({ default: m.TicketList })));
const ScannerPage                = lazy(() => import('./pages/ScannerPage').then(m => ({ default: m.ScannerPage })));
const VerifyTicket               = lazy(() => import('./pages/VerifyTicket').then(m => ({ default: m.VerifyTicket })));
const HostOnboardingPage         = lazy(() => import('./pages/HostOnboardingPage').then(m => ({ default: m.HostOnboardingPage })));
const HostProfilePage            = lazy(() => import('./pages/HostProfilePage').then(m => ({ default: m.HostProfilePage })));
const CreateEventPage            = lazy(() => import('./pages/CreateEventPage').then(m => ({ default: m.CreateEventPage })));
const AcceptInvitationPage       = lazy(() => import('./pages/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })));
const VolunteerConsolePage       = lazy(() => import('./pages/VolunteerConsolePage').then(m => ({ default: m.VolunteerConsolePage })));
const MentorEvaluatorWorkspacePage = lazy(() => import('./pages/MentorEvaluatorWorkspacePage').then(m => ({ default: m.MentorEvaluatorWorkspacePage })));
const AttendeeWalletPage         = lazy(() => import('./pages/AttendeeWalletPage').then(m => ({ default: m.AttendeeWalletPage })));
const PublicEventsPage           = lazy(() => import('./pages/PublicEventsPage').then(m => ({ default: m.PublicEventsPage })));
const PublicEventDetailPage      = lazy(() => import('./pages/PublicEventDetailPage').then(m => ({ default: m.PublicEventDetailPage })));
const PricingPage                = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const NotFoundPage               = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

import { ProtectedRoute } from './routes/ProtectedRoute';
import { HostRoute } from './routes/HostRoute';
import { ROUTES } from './routes/paths';

// ─── Minimal Suspense Fallback ────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
      <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Loading</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(getStoredAuthToken());
  const [user, setUser] = useState<{
    id?: string;
    name: string;
    email: string;
    role?: string;
    eventName?: string;
    isOnboarded?: boolean;
    organizationName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res: any = await apiClient.get('/auth/me');
          if (res.success && res.data) {
            setUser(res.data);
          } else {
            handleLogout();
          }
        } catch (err: any) {
          const status = err?.response?.status;
          // Only clear session on explicit authentication rejection (401/403).
          // Network errors, timeouts, or 5xx must NEVER log the user out or claim the account does not exist.
          if (status === 401 || status === 403) {
            handleLogout();
          } else {
            console.warn('[Ticketification Auth] /auth/me verification unreachable. Preserving stored session.');
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const handleLoginSuccess = (
    newToken: string,
    userData: { id?: string; name: string; email: string; role?: string; eventName?: string },
    refreshToken?: string
  ) => {
    setStoredAuthToken(newToken, refreshToken);
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    localStorage.removeItem('selected_event_id');
    setToken(null);
    setUser(null);
  };

  const handleOnboardingComplete = (data: HostProfileData) => {
    setUser((prev) =>
      prev
        ? {
            ...prev,
            isOnboarded: true,
            // Personal name is NEVER overwritten by organization name
            organizationName: data.hostProfile?.organizationName || prev.organizationName,
          }
        : null
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-stone-300 border-t-stone-900 animate-spin" />
          <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">
            Initializing Ticketification
          </span>
        </div>
      </div>
    );
  }

  const redirectTarget = new URLSearchParams(window.location.search).get('redirect') || '/events';

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── 1. Public Landing & Marketing Pages ─────────────────────── */}
        <Route
          path={ROUTES.HOME}
          element={
            <PublicLandingPage
              currentUser={user}
              onNavigateToLogin={() => navigate(ROUTES.LOGIN)}
              onNavigateToRegister={() => navigate(ROUTES.REGISTER)}
            />
          }
        />
        <Route
          path={ROUTES.PRICING}
          element={
            <PricingPage
              currentUser={user}
              onNavigateToLogin={() => navigate(ROUTES.LOGIN)}
              onNavigateToRegister={() => navigate(ROUTES.REGISTER)}
            />
          }
        />

        {/* ── 2. Public Event Microsites & Verification ────────────────── */}
        <Route path={ROUTES.PUBLIC_EVENT_DETAIL} element={<PublicEventDetailPage />} />
        <Route path={ROUTES.VERIFY_TICKET} element={<VerifyTicket />} />
        <Route path={ROUTES.INVITE_ACCEPT} element={<AcceptInvitationPage currentUser={user} />} />

        {/* ── 3. Authentication Routes (Redirect if session already exists) ─ */}
        <Route
          path={ROUTES.LOGIN}
          element={
            token && user ? (
              <Navigate to={redirectTarget} replace />
            ) : (
              <Login
                onLoginSuccess={handleLoginSuccess}
                onNavigateToRegister={() => navigate(ROUTES.REGISTER)}
              />
            )
          }
        />
        <Route
          path={ROUTES.REGISTER}
          element={
            token && user ? (
              <Navigate to={redirectTarget} replace />
            ) : (
              <Register
                onRegisterSuccess={handleLoginSuccess}
                onNavigateToLogin={() => navigate(ROUTES.LOGIN)}
              />
            )
          }
        />

        {/* ── 4. Authenticated User Dashboard Layout (Nested with Outlet) ── */}
        <Route element={<ProtectedRoute isAuthenticated={Boolean(token && user)} isLoading={loading} />}>
          <Route
            element={
              <EventProvider>
                <Layout user={user} onLogout={handleLogout} />
              </EventProvider>
            }
          >
            {/* Core & Overview */}
            <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
            <Route path={ROUTES.EVENTS} element={<EventsPage />} />
            <Route path={ROUTES.CREATE_EVENT} element={<CreateEventPage />} />
            <Route path={ROUTES.EVENT_DETAIL} element={<EventDetailPage />} />

            {/* Attendee Pass Wallet & Event Discovery */}
            <Route path={ROUTES.WALLET} element={<AttendeeWalletPage />} />
            <Route path={ROUTES.EXPLORE} element={<PublicEventsPage />} />

            {/* Workspace & Settings */}
            <Route
              path={ROUTES.ONBOARDING}
              element={<HostOnboardingPage onOnboardingComplete={handleOnboardingComplete} />}
            />
            <Route path={ROUTES.PROFILE_SETTINGS} element={<HostProfilePage />} />

            {/* Organizer Operations (Guarded by HostRoute) */}
            <Route element={<HostRoute user={user} />}>
              <Route path={ROUTES.IMPORT} element={<GuestImport />} />
              <Route path={ROUTES.TICKETS} element={<TicketList />} />
              <Route path={ROUTES.SCAN} element={<ScannerPage />} />
              <Route path={ROUTES.STAFF_CONSOLE} element={<VolunteerConsolePage />} />
              <Route path={ROUTES.REVIEW_WORKSPACE} element={<MentorEvaluatorWorkspacePage />} />
            </Route>

            {/* In-Dashboard 404 fallback */}
            <Route path="/app/*" element={<NotFoundPage isInsideDashboard />} />
          </Route>
        </Route>

        {/* ── 5. Public Fallback for /explore when unauthenticated ───────── */}
        {!token && <Route path={ROUTES.EXPLORE} element={<PublicEventsPage />} />}

        {/* ── 6. Root Fallback for Unknown Routes ──────────────────────── */}
        <Route path="*" element={<NotFoundPage isInsideDashboard={Boolean(token && user)} />} />
      </Routes>
      </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
};

export default App;
