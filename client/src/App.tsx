import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { EventProvider } from './context/EventContext';
import { apiClient, getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from './api/client';
import { HostProfileData } from './api/host';

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

// ─── Minimal Suspense Fallback ────────────────────────────────────────────────
const PageLoader: React.FC = () => (
  <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
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
        } catch (err) {
          handleLogout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const handleLoginSuccess = (newToken: string, userData: { id?: string; name: string; email: string; role?: string; eventName?: string }) => {
    setStoredAuthToken(newToken);
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
            organizationName: data.hostProfile?.organizationName || prev.name,
          }
        : null
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
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
        {/* ── Flagship Public Landing Page ─────────────────────────────── */}
        <Route
          path="/"
          element={
            <PublicLandingPage
              currentUser={user}
              onNavigateToLogin={() => navigate('/login')}
              onNavigateToRegister={() => navigate('/register')}
            />
          }
        />

          {/* ── Public Event Discovery & Catalog ─────────────────────────── */}
          <Route
            path="/explore"
            element={
              user ? (
                <EventProvider>
                  <Layout user={user} onLogout={handleLogout}>
                    <PublicEventsPage />
                  </Layout>
                </EventProvider>
              ) : (
                <PublicEventsPage />
              )
            }
          />

          {/* ── Standalone Public Event Microsite ────────────────────────── */}
          <Route
            path="/events/:eventId/public"
            element={
              user ? (
                <EventProvider>
                  <Layout user={user} onLogout={handleLogout}>
                    <PublicEventDetailPage />
                  </Layout>
                </EventProvider>
              ) : (
                <PublicEventDetailPage />
              )
            }
          />

          {/* ── Public Event Pricing & Attendance Calculator ──────────── */}
          <Route
            path="/pricing"
            element={
              <PricingPage
                currentUser={user}
                onNavigateToLogin={() => navigate('/login')}
                onNavigateToRegister={() => navigate('/register')}
              />
            }
          />

          {/* ── Public Verification (open to any QR scan) ────────────────── */}
          <Route path="/verify/:token" element={<VerifyTicket />} />

          {/* ── Staff Invitation Acceptance ───────────────────────────────── */}
          <Route path="/invite/accept" element={<AcceptInvitationPage currentUser={user} />} />

          {/* ── Auth Routes ───────────────────────────────────────────────── */}
          <Route
            path="/login"
            element={
              token && user ? (
                <Navigate to={redirectTarget} replace />
              ) : (
                <Login
                  onLoginSuccess={handleLoginSuccess}
                  onNavigateToRegister={() => navigate('/register')}
                />
              )
            }
          />
          <Route
            path="/register"
            element={
              token && user ? (
                <Navigate to={redirectTarget} replace />
              ) : (
                <Register
                  onRegisterSuccess={handleLoginSuccess}
                  onNavigateToLogin={() => navigate('/login')}
                />
              )
            }
          />

          {/* ── Cross-Event Attendee Wallet ───────────────────────────────── */}
          <Route
            path="/wallet"
            element={
              user ? (
                <EventProvider>
                  <Layout user={user} onLogout={handleLogout}>
                    <AttendeeWalletPage />
                  </Layout>
                </EventProvider>
              ) : (
                <AttendeeWalletPage />
              )
            }
          />

          {/* ── Protected Organizer & Staff Console Routes ────────────────── */}
          {token && user ? (
            <Route
              path="/*"
              element={
                <EventProvider>
                  <Layout user={user} onLogout={handleLogout}>
                    <Routes>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/events" element={<EventsPage />} />
                      <Route path="/events/create" element={<CreateEventPage />} />
                      <Route path="/events/:eventId" element={<EventDetailPage />} />
                      <Route path="/events/:eventId/staff-console" element={<VolunteerConsolePage />} />
                      <Route path="/events/:eventId/review-workspace" element={<MentorEvaluatorWorkspacePage />} />
                      <Route
                        path="/onboarding"
                        element={<HostOnboardingPage onOnboardingComplete={handleOnboardingComplete} />}
                      />
                      <Route path="/settings/profile" element={<HostProfilePage />} />
                      <Route path="/import" element={<GuestImport />} />
                      <Route path="/tickets" element={<TicketList />} />
                      <Route path="/scan" element={<ScannerPage />} />
                      <Route path="*" element={<Navigate to="/events" replace />} />
                    </Routes>
                  </Layout>
                </EventProvider>
              }
            />
          ) : (
            /* Unauthenticated fallback → Home */
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Routes>
      </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
