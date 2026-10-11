import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Ticket,
  QrCode,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
  Calendar,
  MapPin,
  Wallet,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
  Compass,
  Building,
  Layers,
} from 'lucide-react';
import { publicApi, PublicEventSummary } from '../api/public';

/* ─── Types ─────────────────────────────────────────────── */
interface PublicLandingPageProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
}

/* ─── Constants ─────────────────────────────────────────── */
const EVENT_TYPE_TABS = [
  { label: 'All Gatherings', value: 'ALL' },
  { label: 'Hackathons', value: 'HACKATHON' },
  { label: 'Conferences', value: 'CONFERENCE' },
  { label: 'Concerts & Music', value: 'CONCERT' },
  { label: 'Festivals', value: 'FESTIVAL' },
  { label: 'Workshops', value: 'WORKSHOP' },
  { label: 'College Fests', value: 'COLLEGE_EVENT' },
];

const CREDENTIAL_PREVIEWS = [
  {
    id: 'hacker',
    title: 'Hackathon Participant Pass',
    subtitle: 'Track allocation, team roster, and offline QR token',
    eventTitle: 'GLOBAL AI BUILDERS HACKATHON',
    attendeeName: 'Rahul Sharma',
    attendeeRole: 'Track: AI Systems · Team: CyberNova',
    badgeText: 'HACKER PASS',
    badgeColor: 'bg-emerald-600 text-white',
    gate: 'GATE 04',
    zone: 'BAY A-12',
    date: 'OCT 02, 2026',
    time: '09:00 AM',
    serialNumber: 'HKR-2026-0842',
    tokenHint: '8f94e2...a17b',
    barcodeDigits: '8492 0184 9283 0842',
  },
  {
    id: 'partner',
    title: 'Partner & VIP Access Pass',
    subtitle: 'VIP networking access with sponsor suite admission',
    eventTitle: 'GLOBAL TECH & VENTURE SUMMIT',
    attendeeName: 'Priya Mehta',
    attendeeRole: 'Partner Lead · Apex Venture Capital',
    badgeText: 'SPONSOR VIP',
    badgeColor: 'bg-teal-700 text-white',
    gate: 'VIP ENTRY',
    zone: 'SUITE 3B',
    date: 'OCT 03, 2026',
    time: '10:30 AM',
    serialNumber: 'SPN-2026-0119',
    tokenHint: '4c21b9...90ea',
    barcodeDigits: '7721 9402 1193 0119',
  },
  {
    id: 'conference',
    title: 'Conference Delegate Pass',
    subtitle: 'Multi-track session badge with turnstile check-in',
    eventTitle: 'DEVELOPER ECOSYSTEM SUMMIT',
    attendeeName: 'Vikram Sengupta',
    attendeeRole: 'Senior Engineer · Cloud Platform',
    badgeText: 'ALL ACCESS',
    badgeColor: 'bg-stone-900 text-white',
    gate: 'GATE 01',
    zone: 'MAIN HALL',
    date: 'OCT 04, 2026',
    time: '14:00 PM',
    serialNumber: 'CNF-2026-0007',
    tokenHint: 'e391aa...742f',
    barcodeDigits: '9103 4810 5928 0007',
  },
];

/* ─── Helper Functions ──────────────────────────────────── */
function formatDate(str?: string) {
  if (!str) return 'Date TBA';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function venueLabel(event: PublicEventSummary) {
  if (event.venue?.type === 'ONLINE') return 'Virtual Event';
  if (event.venue?.city) return event.venue.city;
  if (event.venue?.name) return event.venue.name;
  return 'In-Person Venue';
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
  const [activeCredIndex, setActiveCredIndex] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const activeCred = CREDENTIAL_PREVIEWS[activeCredIndex];

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] font-sans selection:bg-emerald-100 selection:text-emerald-900 relative overflow-hidden">
      {/* ── Soft Ambient Background Glows ── */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[650px] h-[600px] rounded-full opacity-40 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 70% 30%, rgba(110, 231, 183, 0.4), rgba(167, 243, 208, 0.2) 50%, transparent 80%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-40 left-[-150px] w-[500px] h-[450px] rounded-full opacity-30 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(167, 243, 208, 0.3), transparent 70%)',
        }}
      />

      {/* ══════════════════════════════════════════════════════════
          1. NAVIGATION BAR
      ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Ticket className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#111827]">
              Ticketification
            </span>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <Link to="/explore" className="hover:text-emerald-700 transition-colors flex items-center gap-1.5">
              Explore Events
            </Link>
            <a href="#how-it-works" className="hover:text-emerald-700 transition-colors">
              How It Works
            </a>
            <a href="#credentials" className="hover:text-emerald-700 transition-colors">
              Smart Passes
            </a>
            <a href="#trust" className="hover:text-emerald-700 transition-colors">
              Trust & Security
            </a>
            <Link to="/wallet" className="hover:text-emerald-700 transition-colors">
              Pass Wallet
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link
                  to="/wallet"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200/80 transition-colors"
                >
                  My Passes
                </Link>
                <button
                  onClick={() => navigate('/events')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] text-white hover:bg-[#059669] shadow-sm transition-all"
                >
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={onNavigateToLogin}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={onNavigateToRegister}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#10B981] text-white hover:bg-[#059669] shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all active:scale-95"
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-stone-600 hover:text-stone-900 focus:outline-none"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-4 bg-white border-b border-stone-200 space-y-3">
            <Link
              to="/explore"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-700 py-1"
            >
              Explore Events
            </Link>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-700 py-1"
            >
              How It Works
            </a>
            <a
              href="#credentials"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-700 py-1"
            >
              Smart Passes
            </a>
            <Link
              to="/wallet"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-700 py-1"
            >
              Pass Wallet
            </Link>
            <div className="pt-3 border-t border-stone-200 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToLogin();
                }}
                className="w-full text-left text-sm font-medium text-stone-700 py-2"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigateToRegister();
                }}
                className="w-full text-center text-sm font-semibold bg-[#10B981] text-white py-2.5 rounded-lg shadow-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════
          2. HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headlines & Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Event Operating & Access Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-extrabold tracking-tight text-[#111827] leading-[1.12]">
              Discover Gatherings.<br />
              <span className="text-[#10B981]">Operate Flawless Events.</span>
            </h1>

            <p className="text-base sm:text-lg text-stone-600 max-w-xl leading-relaxed">
              Ticketification connects attendees with world-class events while giving organizers high-throughput gate operations, tamper-proof visual passes, and verified credential management.
            </p>

            {/* Quick Search */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center max-w-md pt-1">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hackathons, conferences, concerts..."
                  className="w-full pl-11 pr-14 py-3 bg-white border border-stone-200/90 rounded-full text-sm text-[#111827] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm transition-all"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#10B981] hover:bg-[#059669] text-white flex items-center justify-center transition-colors shadow-sm"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Dual CTAs for Attendee & Organizer */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => navigate('/explore')}
                className="px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Explore Events
              </button>
              <button
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="px-5 py-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <Ticket className="w-4 h-4 text-emerald-600" />
                Organize an Event
              </button>
            </div>

            {/* Authentic Feature Guarantees */}
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-stone-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>One account for attending & hosting</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sub-200ms QR check-in gates</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero duplicate ticket guarantee</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Pass Card Mockup */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-stone-200/90 shadow-xl shadow-stone-900/5 overflow-hidden transition-all">
              {/* Header */}
              <div className="p-4 pb-2 flex items-center justify-between border-b border-stone-100">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Verified Event
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Registration
                </span>
              </div>

              {/* Banner Graphic */}
              <div className="p-4 pb-3">
                <div className="w-full h-32 rounded-xl overflow-hidden relative shadow-inner bg-gradient-to-r from-emerald-600 via-teal-600 to-stone-800 flex items-center justify-center p-4">
                  <div className="text-center text-white space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-200">Flagship Gathering</p>
                    <p className="text-base font-extrabold tracking-tight">AI & Cloud Builders 2026</p>
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div className="px-4 pb-4 space-y-2.5">
                <div className="space-y-1 text-xs text-stone-600">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Convention Center · San Francisco, CA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Oct 2–4, 2026 · 09:00 AM PST</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                  <span className="inline-flex items-center text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
                    Free Attendee Pass
                  </span>
                  <button
                    onClick={() => navigate('/explore')}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                  >
                    View Details
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Floating QR Pass Overlay */}
            <div className="absolute -bottom-6 -right-2 sm:-right-4 z-20 bg-white rounded-xl border border-stone-200/90 shadow-xl p-3 w-40 flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 bg-stone-900 rounded-lg p-1.5 flex items-center justify-center shadow-inner">
                <QrCode className="w-full h-full text-white" />
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-stone-800 tracking-tight block">
                  TAMPER-PROOF QR
                </span>
                <span className="text-[8px] font-mono text-stone-400 block">
                  Single-use · Sub-200ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          3. HOW IT WORKS: THE DUAL-JOURNEY ARCHITECTURE
      ══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-16 bg-white border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
              Platform Architecture
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              Two Connected Journeys.<br />
              <span className="text-[#10B981]">One Verified Account.</span>
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              You never have to choose permanently between attending and hosting. A single Ticketification profile gives you full access to both experiences with backend-enforced permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Journey A: Attendee Experience */}
            <div className="bg-[#FAFAF9] rounded-2xl border border-stone-200/80 p-8 space-y-5 hover:border-emerald-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Experience Events as an Attendee</h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Discover gatherings that match your interests, register in seconds, and enter venues effortlessly.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Browse Public Events</h4>
                    <p className="text-xs text-stone-500">Search conferences, hackathons, and meetups with live schedules and verified host profiles.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Instant Smart Pass Issuance</h4>
                    <p className="text-xs text-stone-500">Receive high-resolution visual passes with cryptographic QR codes sent straight to your wallet.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Sub-200ms Turnstile Entry</h4>
                    <p className="text-xs text-stone-500">Present your mobile QR pass at venue gates for atomic single-scan verification.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/explore')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                >
                  Explore Live Events Catalog
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Journey B: Organizer Experience */}
            <div className="bg-[#FAFAF9] rounded-2xl border border-stone-200/80 p-8 space-y-5 hover:border-emerald-300 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-800 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-stone-900">Operate Gatherings as an Organizer</h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Launch an event anytime from your existing account without separate signups or siloed dashboards.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Configure Event Types & Taxonomy</h4>
                    <p className="text-xs text-stone-500">Select from 13 event types (Hackathon, Conference, Concert) with custom badge terminology.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Dual Attendee Ingestion</h4>
                    <p className="text-xs text-stone-500">Open native registration forms or upload spreadsheets (10k+ rows) with background worker processing.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">High-Concurrency Gate Operations</h4>
                    <p className="text-xs text-stone-500">Deploy staff mobile scanners with zero double-entry risk via conditional atomic updates.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800"
                >
                  Create Your Event Now
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          4. LIVE PUBLIC EVENTS CATALOG
      ══════════════════════════════════════════════════════════ */}
      <section className="py-16 bg-[#FAFAF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-1">
                Live Public Catalog
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
                Featured Upcoming Gatherings
              </h2>
              <p className="text-sm text-stone-600 mt-1">
                Real events published by verified organizers across academia, tech, and entertainment.
              </p>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              Browse entire catalog
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {EVENT_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === tab.value
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Catalog Content */}
          {eventsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-white border border-stone-200 animate-pulse p-4" />
              ))}
            </div>
          ) : eventsError ? (
            <div className="py-12 text-center space-y-2 border border-stone-200 rounded-2xl bg-white p-8 max-w-md mx-auto">
              <p className="text-sm text-stone-600">Unable to load featured events right now.</p>
              <button onClick={fetchEvents} className="text-xs font-semibold text-emerald-700 underline">
                Retry loading
              </button>
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white border border-stone-200/80 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 max-w-xl mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-900">No Public Events in this Category</h3>
              <p className="text-xs text-stone-500 max-w-sm leading-relaxed">
                Be the first to publish an event in this category or explore all available gatherings.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                >
                  View All Events
                </button>
                <button
                  onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                  className="px-4 py-2 rounded-lg bg-[#10B981] text-white text-xs font-semibold hover:bg-[#059669] transition-colors"
                >
                  Create Event
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}/public`)}
                  className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="relative h-44 bg-stone-100 overflow-hidden">
                    {event.bannerUrl ? (
                      <img
                        src={event.bannerUrl}
                        alt={event.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300">
                        <Ticket className="w-10 h-10 text-stone-300" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-white/95 text-stone-800 shadow-sm border border-stone-200/50">
                      {event.eventType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-base text-[#111827] group-hover:text-emerald-700 transition-colors line-clamp-1">
                        {event.name}
                      </h4>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                        {event.description || 'Join this exciting event and connect with organizers.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formatDate(event.schedule?.startAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        <span className="truncate">{venueLabel(event)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          5. CREDENTIALS SECTION: REAL VISUAL PASS ENGINE
      ══════════════════════════════════════════════════════════ */}
      <section id="credentials" className="py-20 bg-white border-t border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
              Visual Pass Engine
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              Tamper-Proof Visual Credentials.<br />
              <span className="text-[#10B981]">Rendered On-The-Fly.</span>
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Every pass is rendered on-the-fly with single-use cryptographic tokens. High-precision Sharp rasterization prevents ticket counterfeiting and screenshot reuse.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            {/* Left: Select Archetype (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                Select Credential Archetype
              </p>

              {CREDENTIAL_PREVIEWS.map((item, idx) => {
                const isActive = activeCredIndex === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveCredIndex(idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <p className={`text-sm font-bold ${isActive ? 'text-emerald-900' : 'text-[#111827]'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">{item.subtitle}</p>
                  </button>
                );
              })}

              <div className="pt-3 space-y-2 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Custom branding and event-specific taxonomies</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Cryptographic single-use validation tokens</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Instant wallet storage across all your events</span>
                </div>
              </div>
            </div>

            {/* Right: Authentic Real Ticket (7 cols) */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="w-full max-w-[360px] bg-white rounded-3xl border border-stone-200/90 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-emerald-500/10">
                {/* Lanyard Punch Slot */}
                <div className="pt-3.5 flex justify-center">
                  <div className="w-12 h-2 rounded-full bg-stone-200/80 border border-stone-300/70 shadow-inner" />
                </div>

                {/* Header */}
                <div className="px-6 pt-2 pb-3 border-b border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#10B981] flex items-center justify-center text-white shadow-sm">
                      <Ticket className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <span className="font-extrabold text-xs tracking-tight text-stone-900">
                      Ticketification
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm ${activeCred.badgeColor}`}>
                    {activeCred.badgeText}
                  </span>
                </div>

                {/* Attendee Info */}
                <div className="px-6 pt-4 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      EVENT ADMISSION PASS
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ACTIVE
                    </span>
                  </div>
                  <h4 className="text-2xl font-black text-[#111827] tracking-tight">
                    {activeCred.attendeeName}
                  </h4>
                  <p className="text-xs text-emerald-700 font-semibold truncate">
                    {activeCred.attendeeRole}
                  </p>
                </div>

                {/* Admission Grid */}
                <div className="px-6 pb-2">
                  <div className="bg-stone-50 border border-stone-200/70 rounded-xl p-2.5 grid grid-cols-4 gap-1 text-center">
                    <div className="border-r border-stone-200 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">GATE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.gate}</span>
                    </div>
                    <div className="border-r border-stone-200 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">ZONE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.zone}</span>
                    </div>
                    <div className="border-r border-stone-200 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">DATE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block truncate">{activeCred.date.split(',')[0]}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">TIME</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.time}</span>
                    </div>
                  </div>
                </div>

                {/* Perforated Tear Line with Real Ticket Notches */}
                <div className="relative py-2.5 flex items-center my-1">
                  <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#FAFAF9] border-r border-stone-200/90 shadow-inner z-10" />
                  <div className="w-full border-b-2 border-dashed border-stone-300 mx-5" />
                  <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#FAFAF9] border-l border-stone-200/90 shadow-inner z-10" />
                </div>

                {/* Lower Scannable Ticket Stub */}
                <div className="px-6 pb-6 pt-1 space-y-4">
                  <div className="relative bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 shadow-sm">
                    <div className="w-28 h-28 bg-stone-900 rounded-xl p-2 flex items-center justify-center shadow-inner">
                      <QrCode className="w-full h-full text-white" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-stone-500 tracking-wider">
                      SERIAL: {activeCred.serialNumber}
                    </span>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full border border-emerald-300 px-3 py-1 shadow-md flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Verify Pass</span>
                    </div>
                  </div>

                  {/* Linear Barcode */}
                  <div className="pt-1 flex flex-col items-center gap-1">
                    <svg className="w-48 h-7 text-stone-800" viewBox="0 0 160 24" fill="currentColor">
                      <rect x="0" y="0" width="2" height="24" />
                      <rect x="4" y="0" width="1" height="24" />
                      <rect x="7" y="0" width="3" height="24" />
                      <rect x="12" y="0" width="1" height="24" />
                      <rect x="15" y="0" width="4" height="24" />
                      <rect x="21" y="0" width="2" height="24" />
                      <rect x="25" y="0" width="1" height="24" />
                      <rect x="28" y="0" width="3" height="24" />
                      <rect x="33" y="0" width="2" height="24" />
                      <rect x="37" y="0" width="1" height="24" />
                      <rect x="40" y="0" width="4" height="24" />
                      <rect x="46" y="0" width="2" height="24" />
                      <rect x="50" y="0" width="1" height="24" />
                      <rect x="53" y="0" width="3" height="24" />
                      <rect x="58" y="0" width="2" height="24" />
                      <rect x="62" y="0" width="4" height="24" />
                      <rect x="68" y="0" width="1" height="24" />
                      <rect x="71" y="0" width="3" height="24" />
                      <rect x="76" y="0" width="2" height="24" />
                      <rect x="80" y="0" width="1" height="24" />
                      <rect x="83" y="0" width="4" height="24" />
                      <rect x="89" y="0" width="2" height="24" />
                      <rect x="93" y="0" width="3" height="24" />
                      <rect x="98" y="0" width="1" height="24" />
                      <rect x="101" y="0" width="2" height="24" />
                      <rect x="105" y="0" width="4" height="24" />
                      <rect x="111" y="0" width="2" height="24" />
                      <rect x="115" y="0" width="1" height="24" />
                      <rect x="118" y="0" width="3" height="24" />
                      <rect x="123" y="0" width="2" height="24" />
                      <rect x="127" y="0" width="4" height="24" />
                      <rect x="133" y="0" width="1" height="24" />
                      <rect x="136" y="0" width="3" height="24" />
                      <rect x="141" y="0" width="2" height="24" />
                      <rect x="145" y="0" width="1" height="24" />
                      <rect x="148" y="0" width="4" height="24" />
                      <rect x="154" y="0" width="2" height="24" />
                      <rect x="158" y="0" width="2" height="24" />
                    </svg>
                    <span className="text-[9px] font-mono tracking-widest text-stone-500 font-bold">
                      {activeCred.barcodeDigits}
                    </span>
                  </div>

                  <div className="text-center pt-0.5 border-t border-stone-100">
                    <p className="text-[9px] font-mono text-stone-400 uppercase tracking-tight">
                      AUTH TOKEN: {activeCred.tokenHint} • TAMPER EVIDENT
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          6. TRUST & SECURITY ARCHITECTURE
      ══════════════════════════════════════════════════════════ */}
      <section id="trust" className="py-16 bg-[#FAFAF9] border-t border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
              Engineered for Integrity
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              Why Organizers & Attendees<br />
              <span className="text-[#10B981]">Trust Ticketification.</span>
            </h2>
            <p className="text-sm text-stone-600">
              Built on four security pillars that protect attendee identity and guarantee operational reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Cryptographic Tokens</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                64-character opaque signed tokens replace raw attendee PII. Stolen screenshots cannot be forged or duplicated.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Atomic Gate Resolution</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Conditional database updates resolve simultaneous scans at venue gates. Exactly one scan succeeds; the rest are rejected.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Institutional Vetting</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Campus departments and verified companies undergo domain authentication before ticketing is activated.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Unified Wallet Storage</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Passes live securely in your attendee wallet. Present credentials on any device without downloading PDFs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          7. CALL TO ACTION BANNER
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-3xl p-10 sm:p-14 overflow-hidden text-center bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 border border-emerald-200/60 shadow-sm">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight">
              Ready to Attend or Host Your Next Event?
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
              Join students, developers, creators, and organizers building unforgettable gatherings with Ticketification.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/explore')}
                className="px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                <Compass className="w-4 h-4" />
                Explore Events
              </button>
              <button
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="px-6 py-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <Ticket className="w-4 h-4 text-emerald-600" />
                Create an Event
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. CLEAN LIGHT FOOTER
      ══════════════════════════════════════════════════════════ */}
      <footer className="bg-white border-t border-stone-200 py-12 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
            <div className="space-y-2">
              <p className="font-bold text-stone-900">Explore</p>
              <ul className="space-y-1.5">
                <li><Link to="/explore" className="hover:text-emerald-700">Events Catalog</Link></li>
                <li><Link to="/wallet" className="hover:text-emerald-700">Attendee Wallet</Link></li>
                <li><Link to="/events" className="hover:text-emerald-700">Organizer Dashboard</Link></li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-stone-900">Platform</p>
              <ul className="space-y-1.5">
                <li><a href="#credentials" className="hover:text-emerald-700">Smart Passes</a></li>
                <li><a href="#how-it-works" className="hover:text-emerald-700">How It Works</a></li>
                <li><a href="#trust" className="hover:text-emerald-700">Security & Trust</a></li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-stone-900">Account</p>
              <ul className="space-y-1.5">
                <li><button onClick={onNavigateToLogin} className="hover:text-emerald-700">Sign In</button></li>
                <li><button onClick={onNavigateToRegister} className="hover:text-emerald-700">Create Account</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-stone-900">Legal & Verification</p>
              <ul className="space-y-1.5">
                <li><span className="hover:text-emerald-700 cursor-pointer">Verification Standards</span></li>
                <li><span className="hover:text-emerald-700 cursor-pointer">Terms & Conditions</span></li>
                <li><span className="hover:text-emerald-700 cursor-pointer">Privacy Policy</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#10B981] flex items-center justify-center text-white text-[9px] font-bold">
                T
              </div>
              <span className="font-semibold text-stone-700">Ticketification</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <span>Event Operating, Credential, and Access Platform.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLandingPage;
