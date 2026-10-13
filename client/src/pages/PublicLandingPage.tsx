import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi, PublicEventSummary } from '../api/public';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import {
  HeroSection,
  TwoConnectedJourneysSection,
  LiveEventsCatalogSection,
  VisualPassEngineSection,
  TrustAndSecuritySection,
  CallToActionSection,
} from '../components/sections';

/* ─── Types ─────────────────────────────────────────────── */
interface PublicLandingPageProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
}

/* ═══════════════════════════════════════════════════════════
   MAIN PUBLIC LANDING PAGE
═══════════════════════════════════════════════════════════ */
export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({
  currentUser,
  onNavigateToLogin,
  onNavigateToRegister,
}) => {
  const navigate = useNavigate();

  /* ── State ── */
  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Fetch Live Catalog ── */
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(false);
    try {
      const res = await publicApi.getPublicEvents({
        limit: 6,
        eventType: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      });
      setEvents(res?.events ?? []);
    } catch {
      setEventsError(true);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const featuredEvent = events && events.length > 0 ? events[0] : null;

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] font-sans selection:bg-stone-200 selection:text-stone-900 relative overflow-x-clip">
      {/* ── Neutral Atmospheric Background Glows ── */}
      <div
        className="pointer-events-none absolute top-[-60px] left-[-80px] w-[600px] h-[550px] rounded-full opacity-60 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(228, 228, 231, 0.45) 0%, rgba(244, 244, 245, 0.2) 40%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-12 right-[-100px] sm:right-[-60px] w-[750px] h-[700px] rounded-full opacity-40 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 75% 55%, rgba(228, 228, 231, 0.42) 0%, rgba(244, 244, 245, 0.2) 45%, transparent 75%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] rounded-full opacity-20 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(228, 228, 231, 0.35) 0%, transparent 60%)',
        }}
      />

      {/* 1. Global Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToRegister={onNavigateToRegister}
      />

      {/* 2. Hero Section */}
      <HeroSection
        currentUser={currentUser}
        onNavigateToRegister={onNavigateToRegister}
        featuredEvent={featuredEvent}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* 3. Two Connected Journeys (How It Works) */}
      <TwoConnectedJourneysSection
        currentUser={currentUser}
        onNavigateToRegister={onNavigateToRegister}
      />

      {/* 4. Live Public Events Catalog */}
      <LiveEventsCatalogSection
        events={events}
        eventsLoading={eventsLoading}
        eventsError={eventsError}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onRetry={fetchEvents}
        currentUser={currentUser}
        onNavigateToRegister={onNavigateToRegister}
      />

      {/* 5. Real Visual Pass Engine Preview */}
      <VisualPassEngineSection />

      {/* 6. Trust & Security Architecture */}
      <TrustAndSecuritySection />

      {/* 7. Call To Action Section */}
      <CallToActionSection
        currentUser={currentUser}
        onNavigateToRegister={onNavigateToRegister}
        onNavigateToLogin={onNavigateToLogin}
        titleLine1="Put your event ops to work."
        titleLine2="Your team welcomes the crowd."
        description="Show us how your venue or summit operates today. We'll show you what Ticketification takes off your plate first—from turnstile bottlenecks to duplicate pass fraud."
        primaryActionLabel="Start hosting for free"
        secondaryActionLabel="Explore public events →"
        secondaryActionTo="/explore"
      />

      {/* 8. Global Atmospheric Footer */}
      <Footer
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToRegister={onNavigateToRegister}
      />
    </div>
  );
};

export default PublicLandingPage;
