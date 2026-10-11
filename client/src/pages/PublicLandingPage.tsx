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
  Users,
  CheckCircle2,
  Menu,
  X,
  Sparkles,
  Globe,
  Play,
  Flame,
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
  { label: 'Conferences', value: 'CONFERENCE' },
  { label: 'Exhibitions', value: 'EXHIBITION' },
  { label: 'Tech Meetups', value: 'HACKATHON' },
  { label: 'Festivals', value: 'FESTIVAL' },
  { label: 'Special Interest', value: 'WORKSHOP' },
];

const CREDENTIAL_PREVIEWS = [
  {
    id: 'innovative',
    title: 'Innovative Participant',
    subtitle: 'Track allocation · Team roster with offline QR',
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
    title: 'Credential for Partner & Sponsor',
    subtitle: 'VIP networking pass with sponsor suite admission',
    eventTitle: 'GLOBAL TECH & VENTURE SUMMIT',
    attendeeName: 'Priya Mehta',
    attendeeRole: 'Partner Lead · Apex Venture Capital',
    badgeText: 'SPONSOR VIP',
    badgeColor: 'bg-indigo-600 text-white',
    gate: 'VIP ENTRY',
    zone: 'SUITE 3B',
    date: 'OCT 03, 2026',
    time: '10:30 AM',
    serialNumber: 'SPN-2026-0119',
    tokenHint: '4c21b9...90ea',
    barcodeDigits: '7721 9402 1193 0119',
  },
  {
    id: 'vip',
    title: 'VIP & Access Passes',
    subtitle: 'Turnstile gate admission · High-throughput ingress',
    eventTitle: 'MAIN STAGE TECH & MUSIC FESTIVAL',
    attendeeName: 'Vikram Sengupta',
    attendeeRole: 'Keynote Speaker · Autonomous Labs',
    badgeText: 'ALL ACCESS',
    badgeColor: 'bg-purple-600 text-white',
    gate: 'GATE 01',
    zone: 'STAGE ALL',
    date: 'OCT 04, 2026',
    time: '16:00 PM',
    serialNumber: 'VIP-2026-0007',
    tokenHint: 'e391aa...742f',
    barcodeDigits: '9103 4810 5928 0007',
  },
];

/* ─── Helper Functions ──────────────────────────────────── */
function formatDate(str?: string) {
  if (!str) return 'Oct 2, 2026';
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
  return 'San Francisco, CA';
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
      
      {/* ── Ambient Gradient Glow in Hero (Matching Reference Image) ── */}
      <div 
        className="pointer-events-none absolute top-0 right-0 w-[650px] h-[600px] rounded-full opacity-60 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 70% 30%, rgba(110, 231, 183, 0.45), rgba(167, 243, 208, 0.25) 50%, transparent 80%)',
        }}
      />
      <div 
        className="pointer-events-none absolute top-40 left-[-150px] w-[500px] h-[450px] rounded-full opacity-40 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(167, 243, 208, 0.35), transparent 70%)',
        }}
      />

      {/* ══════════════════════════════════════════════════════════
          1. NAVIGATION BAR
      ══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-lg bg-[#10B981] flex items-center justify-center text-white shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Ticket className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[#111827]">
              Ticketification
            </span>
          </Link>

          {/* Desktop Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4B5563]">
            <Link to="/explore" className="hover:text-[#059669] transition-colors flex items-center gap-1.5">
              Explore Events
            </Link>
            <a href="#features" className="hover:text-[#059669] transition-colors">
              Features
            </a>
            <a href="#credentials" className="hover:text-[#059669] transition-colors">
              Smart Passes
            </a>
            <Link to="/wallet" className="hover:text-[#059669] transition-colors">
              Support
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {currentUser ? (
              <button
                onClick={() => navigate('/events')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#10B981] text-white hover:bg-[#059669] shadow-sm transition-all"
              >
                Host Console
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={onNavigateToLogin}
                  className="px-3 py-2 text-sm font-medium text-[#4B5563] hover:text-[#111827] transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={onNavigateToRegister}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#10B981] text-white hover:bg-[#059669] shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all active:scale-95"
                >
                  Create Event
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
              className="block text-sm font-medium text-stone-700 hover:text-emerald-600 py-1"
            >
              Explore Events
            </Link>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-600 py-1"
            >
              Features
            </a>
            <a
              href="#credentials"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-600 py-1"
            >
              Smart Passes
            </a>
            <Link
              to="/wallet"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-700 hover:text-emerald-600 py-1"
            >
              Support & Wallet
            </Link>
            <div className="pt-3 border-t border-stone-200 flex flex-col gap-2">
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigateToLogin(); }}
                className="w-full text-left text-sm font-medium text-stone-700 py-2"
              >
                Sign In
              </button>
              <button
                onClick={() => { setMobileMenuOpen(false); onNavigateToRegister(); }}
                className="w-full text-center text-sm font-semibold bg-[#10B981] text-white py-2.5 rounded-lg shadow-sm"
              >
                Create Event
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ══════════════════════════════════════════════════════════
          2. HERO SECTION (Exact Reference Layout)
      ══════════════════════════════════════════════════════════ */}
      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-14 pb-20 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headlines & Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Pill: Next-Gen Event OS */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Next-Gen Event OS</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-extrabold tracking-tight text-[#111827] leading-[1.12]">
              Effortless Events.<br />
              <span className="text-[#10B981]">Flawless Turnout.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-[#4B5563] max-w-xl leading-relaxed">
              The modern ticketing and access engine for flagship events.
            </p>

            {/* Search Pill Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex items-center max-w-md pt-1">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for events..."
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

            {/* Action Buttons: Explore Gatherings & Create Event */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={() => navigate('/explore')}
                className="px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2"
              >
                Explore Gatherings
              </button>
              <button
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="px-5 py-3 rounded-xl bg-white hover:bg-stone-50 text-[#111827] border border-stone-200 text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-stone-500 fill-stone-500" />
                Create Event
              </button>
            </div>

            {/* Social Proof: Avatars & 5-Star Rating */}
            <div className="pt-4 flex items-center gap-3">
              <div className="flex -space-x-2">
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                  alt="Avatar 1"
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                  alt="Avatar 2"
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80"
                  alt="Avatar 3"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827]">
                  Trusted by 5,000+ creators
                </p>
                <div className="flex items-center text-amber-400 text-xs">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Hero Visual Mockup Composition (5 cols) */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            
            {/* Background Layer: Angled Dark Passport/Ticket Card */}
            <div className="absolute top-2 right-4 w-64 h-80 bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl transform rotate-6 shadow-xl opacity-90 border border-slate-700/50 hidden sm:block p-4">
              <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
                <span>PASSPORT</span>
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-8 flex justify-center">
                <div className="w-20 h-20 rounded-full border border-slate-700 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border border-dashed border-emerald-500/40" />
                </div>
              </div>
            </div>

            {/* Central Featured Event Card */}
            <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-stone-200/90 shadow-xl shadow-stone-900/5 overflow-hidden transition-all">
              
              {/* Top Banner Tag: Event Live */}
              <div className="p-4 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Featured Event
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Event Live
                </span>
              </div>

              {/* Colorful Aurora Banner Graphic */}
              <div className="px-4 pb-3">
                <div className="w-full h-32 rounded-xl overflow-hidden relative shadow-inner bg-gradient-to-r from-blue-600 via-indigo-600 via-purple-600 to-pink-500">
                  {/* Mesh Gradient Effect */}
                  <div className="absolute inset-0 opacity-80 mix-blend-overlay bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.6),transparent_70%)]" />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm text-[10px] font-semibold text-white">
                    Main Stage
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div className="px-4 pb-4 space-y-2.5">
                <h3 className="font-bold text-base text-[#111827]">
                  Main Stage Gathering
                </h3>
                <div className="space-y-1 text-xs text-[#6B7280]">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Live in Chicago</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Oct 2, 2026 · 16:00 PM</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/50">
                    Tickets Available
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-stone-600 bg-stone-100 px-2 py-1 rounded-full">
                    <Flame className="w-3 h-3 text-orange-500" />
                    Trending
                  </div>
                </div>
              </div>
            </div>

            {/* Overlapping Floating QR Pass Card (Bottom Right) */}
            <div className="absolute -bottom-6 -right-2 sm:-right-6 z-20 bg-white rounded-xl border border-stone-200/90 shadow-2xl p-3 w-40 flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 bg-stone-900 rounded-lg p-1.5 flex items-center justify-center shadow-inner">
                <QrCode className="w-full h-full text-white" />
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-stone-800 tracking-tight block">
                  VERIFIED PASS
                </span>
                <span className="text-[8px] font-mono text-stone-400 block">
                  ID: #080091 · single-use
                </span>
              </div>
            </div>

            {/* Overlapping Mini Floating Ticket (Top Right) */}
            <div className="absolute -top-4 -right-2 z-20 bg-white rounded-lg border border-stone-200 shadow-md p-1.5 px-3 flex items-center gap-2 hidden sm:flex">
              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-bold text-stone-700">Ticket Pass</span>
            </div>

          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          3. FOUR-COLUMN VALUE PROPOSITIONS (Matching Reference)
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Custom Registration OS */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#111827] mb-1">
              Custom Registration OS
            </h4>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Custom event portals with flexible registration forms and approval flows.
            </p>
          </div>

          {/* Card 2: Gate Turnstile Suite */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#111827] mb-1">
              Gate Turnstile Suite
            </h4>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Sub-200ms scan validation, offline support, and zero duplicate check-in.
            </p>
          </div>

          {/* Card 3: Trust Engine */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-3 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#111827] mb-1">
              Trust Engine
            </h4>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Domain-verified hosts, tamper-proof credentials, and anti-scalping.
            </p>
          </div>

          {/* Card 4: Secured & Fast Market */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-3 group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#111827] mb-1">
              Secured & Fast Market
            </h4>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Instant pass issuance, dynamic QR rotation, and seamless attendee wallet.
            </p>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          4. FEATURED PUBLIC GATHERINGS (Catalog & Empty State)
      ══════════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-stone-200/80 py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 space-y-8">
          
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#10B981] mb-1">
                Featured Public Gatherings
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
                Featured Public Gatherings
              </h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Discover tech conferences, hackathons, concerts, and campus festivals.
              </p>
            </div>
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              View all public events
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Category Filter Pills (Matching Reference Image) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {EVENT_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === tab.value
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-stone-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area: Loading, Error, Empty State, or Event Grid */}
          {eventsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : eventsError ? (
            <div className="py-14 text-center space-y-2 border border-dashed border-stone-200 rounded-3xl p-8">
              <p className="text-sm text-[#6B7280]">
                Unable to load events at this moment.
              </p>
              <button
                onClick={fetchEvents}
                className="text-xs font-semibold text-emerald-600 underline"
              >
                Retry
              </button>
            </div>
          ) : events.length === 0 ? (
            /* Clean Reference Empty State with Megaphone Illustration */
            <div className="bg-[#FAFAF9] border border-stone-200/80 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 max-w-4xl mx-auto shadow-sm">
              
              {/* Illustration: Modern Vector Graphics (Matching Reference Image) */}
              <div className="w-48 h-36 flex items-center justify-center">
                <svg viewBox="0 0 200 150" className="w-full h-full">
                  {/* Backdrop shapes */}
                  <circle cx="100" cy="75" r="55" fill="#E6F4EA" />
                  <circle cx="130" cy="50" r="15" fill="#FEF3C7" />
                  
                  {/* Megaphone / Horn */}
                  <polygon points="110,65 145,45 145,85" fill="#F59E0B" />
                  <ellipse cx="145" cy="65" rx="5" ry="20" fill="#EA580C" />
                  <rect x="100" y="60" width="12" height="10" rx="3" fill="#0D9488" />
                  <path d="M 104,70 L 100,85 L 108,85 Z" fill="#047857" />

                  {/* Friendly Character */}
                  <circle cx="75" cy="55" r="16" fill="#FDBA74" /> {/* Head */}
                  <path d="M 68,48 Q 75,40 82,48" stroke="#1F2937" strokeWidth="4" fill="none" strokeLinecap="round" /> {/* Hair */}
                  <path d="M 52,90 Q 75,70 98,90 L 95,120 L 55,120 Z" fill="#10B981" /> {/* Shirt */}
                  <circle cx="71" cy="54" r="1.5" fill="#111827" />
                  <circle cx="79" cy="54" r="1.5" fill="#111827" />
                  <path d="M 73,60 Q 75,63 77,60" stroke="#111827" strokeWidth="1" fill="none" />

                  {/* Sound waves / sparkle */}
                  <path d="M 155,55 Q 165,65 155,75" stroke="#10B981" strokeWidth="3" fill="none" strokeLinecap="round" />
                  <path d="M 163,48 Q 175,65 163,82" stroke="#10B981" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="3,3" />
                </svg>
              </div>

              {/* Headings */}
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base sm:text-lg font-bold text-[#111827]">
                  No Public Gatherings for this Category Yet
                </h3>
                <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">
                  New public events are added frequently in this category. You can also explore all upcoming gatherings or host your own.
                </p>
              </div>

              {/* Action */}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className="px-5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all"
                >
                  View All Events
                </button>
              </div>

            </div>
          ) : (
            /* Event Grid */
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
                      <div className="w-full h-full flex items-center justify-center bg-emerald-50/50">
                        <Ticket className="w-10 h-10 text-emerald-300" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-white/95 text-emerald-800 shadow-sm">
                      {event.eventType}
                    </span>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-base text-[#111827] group-hover:text-emerald-700 transition-colors line-clamp-1">
                        {event.name}
                      </h4>
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">
                        {event.description || 'Join this exciting event and connect with organizers.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-[#6B7280]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{formatDate(event.schedule?.startAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{venueLabel(event)}</span>
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
          5. CREDENTIALS SECTION (Matching Reference Image)
      ══════════════════════════════════════════════════════════ */}
      <section id="credentials" className="py-20 bg-[#FAFAF9]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 space-y-12">
          
          {/* Centered Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
              Next-Gen Credential Engine
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              Not Simple Tickets,<br />
              <span className="text-[#10B981]">Tamper-Proof Visual Credentials.</span>
            </h2>
            <p className="text-sm text-[#4B5563] leading-relaxed">
              Every pass is rendered on-the-fly with single-use cryptographic tokens. Native Sharp rasterization protects against screenshots and duplicates.
            </p>
          </div>

          {/* Interactive Credential Demo */}
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
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-emerald-50/80 border-emerald-400 shadow-sm'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <p className={`text-sm font-bold ${isActive ? 'text-emerald-900' : 'text-[#111827]'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {item.subtitle}
                    </p>
                  </button>
                );
              })}

              <div className="pt-3 space-y-1.5 text-xs text-stone-500">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Visual pass rasterization with custom badge branding</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Cryptographic single-use validation tokens with sub-200ms scan</span>
                </div>
              </div>
            </div>

            {/* Right: Authentic Real Ticket (7 cols) */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="w-full max-w-[360px] bg-white rounded-3xl border border-stone-200/90 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-emerald-500/10">
                
                {/* ── Top Lanyard Punch Slot ── */}
                <div className="pt-3.5 flex justify-center">
                  <div className="w-12 h-2 rounded-full bg-stone-200/80 border border-stone-300/70 shadow-inner" />
                </div>

                {/* ── Top Header / Brand & Tier ── */}
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

                {/* ── Event & Attendee Info ── */}
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
                  <p className="text-xs text-emerald-600 font-semibold truncate">
                    {activeCred.attendeeRole}
                  </p>
                </div>

                {/* ── Admission Data Grid (Boarding Pass / Ticket Fields) ── */}
                <div className="px-6 pb-2">
                  <div className="bg-stone-50/90 border border-stone-200/70 rounded-xl p-2.5 grid grid-cols-4 gap-1 text-center">
                    <div className="border-r border-stone-200/60 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">GATE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.gate}</span>
                    </div>
                    <div className="border-r border-stone-200/60 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">ZONE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.zone}</span>
                    </div>
                    <div className="border-r border-stone-200/60 pr-1">
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">DATE</span>
                      <span className="text-xs font-black text-stone-800 font-mono block truncate">{activeCred.date.split(',')[0]}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold uppercase text-stone-400 block tracking-tight">TIME</span>
                      <span className="text-xs font-black text-stone-800 font-mono block">{activeCred.time}</span>
                    </div>
                  </div>
                </div>

                {/* ── Perforated Tear Line with Real Ticket Circular Notches ── */}
                <div className="relative py-2.5 flex items-center my-1">
                  {/* Left Cutout Bite */}
                  <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#FAFAF9] border-r border-stone-200/90 shadow-inner z-10" />
                  
                  {/* Dashed Perforation Line */}
                  <div className="w-full border-b-2 border-dashed border-stone-300 mx-5" />

                  {/* Right Cutout Bite */}
                  <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-[#FAFAF9] border-l border-stone-200/90 shadow-inner z-10" />
                </div>

                {/* ── Lower Scannable Ticket Stub ── */}
                <div className="px-6 pb-6 pt-1 space-y-4">
                  
                  {/* QR Code Plate with Corner Target Brackets */}
                  <div className="relative bg-stone-50 border border-stone-200/80 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 shadow-sm">
                    
                    {/* Corner Target Accents */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-500 rounded-tl-sm" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-500 rounded-tr-sm" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-500 rounded-bl-sm" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-500 rounded-br-sm" />

                    {/* High-Contrast QR Code */}
                    <div className="w-28 h-28 bg-stone-900 rounded-xl p-2 flex items-center justify-center shadow-inner">
                      <QrCode className="w-full h-full text-white" />
                    </div>

                    <span className="text-[10px] font-mono font-bold text-stone-500 tracking-wider">
                      SERIAL: {activeCred.serialNumber}
                    </span>

                    {/* Floating Live Verification Badge */}
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full border border-emerald-300 px-3 py-1 shadow-lg flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Verify Pass</span>
                    </div>
                  </div>

                  {/* ── Authentic Linear Barcode ── */}
                  <div className="pt-1 flex flex-col items-center gap-1">
                    <svg className="w-48 h-7 text-stone-800" viewBox="0 0 160 24" fill="currentColor">
                      {/* Realistic barcode pattern */}
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

                  {/* Microprint security footer */}
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
          6. ONE UNIFIED CORE SECTION (Matching Reference)
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 bg-white border-t border-stone-200/80">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 space-y-12">
          
          {/* Centered Heading */}
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-[#10B981]">
              Built for Diverse Gatherings
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
              One Unified Core.<br />
              <span className="text-[#10B981]">Tailored for Every Event Type.</span>
            </h2>
            <p className="text-sm text-[#4B5563]">
              Ticketification adapts its operational engine to your gathering—whether a 50-person seminar or a 5,000-person tech summit.
            </p>
          </div>

          {/* 3 Large Showcase Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* 1. Hackathon & Teaming OS */}
            <div className="bg-[#FAFAF9] rounded-3xl border border-stone-200/80 p-8 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#111827]">
                Hackathon & Teaming OS
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Hackathon & teaming OS, live tracking, candidate auto-sorting, and online mentor/evaluator rubrics.
              </p>
            </div>

            {/* 2. High-Fidelity Turnstile */}
            <div className="bg-[#FAFAF9] rounded-3xl border border-stone-200/80 p-8 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-teal-100/70 text-teal-700 flex items-center justify-center">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#111827]">
                High-Fidelity Turnstile
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                High-speed scanning with sub-200ms latency, volunteer access delegation, and atomic access synchronization.
              </p>
            </div>

            {/* 3. Institutional Trust Engine */}
            <div className="bg-[#FAFAF9] rounded-3xl border border-stone-200/80 p-8 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[#111827]">
                Institutional Trust Engine
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">
                Tiered verification badges, anti-fraud safeguards, and tamper-resistant credentials for organizer credibility.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          7. CALL TO ACTION BANNER (Matching Reference Mint Gradient)
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-16">
        <div className="relative rounded-3xl p-10 sm:p-14 overflow-hidden text-center bg-gradient-to-r from-emerald-100 via-emerald-50 to-teal-100 border border-emerald-200/60 shadow-sm">
          
          {/* Watermark Ticket Art in Background */}
          <div className="absolute right-[-40px] bottom-[-40px] opacity-15 pointer-events-none transform rotate-12">
            <svg width="240" height="160" viewBox="0 0 240 160" fill="none">
              <rect x="10" y="10" width="220" height="140" rx="16" stroke="#047857" strokeWidth="4" strokeDasharray="8 8" />
              <circle cx="10" cy="80" r="14" fill="#047857" />
              <circle cx="230" cy="80" r="14" fill="#047857" />
            </svg>
          </div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight">
              Ready to Launch Your Next Flagship Event?
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563] max-w-lg mx-auto leading-relaxed">
              Join organizers, universities, and creators building unforgettable gatherings with Ticketification.
            </p>
            
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
                className="px-6 py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-sm font-semibold shadow-sm hover:shadow-md hover:shadow-emerald-500/20 transition-all"
              >
                Launch Platform
              </button>
              <button
                onClick={() => navigate('/explore')}
                className="px-6 py-3 rounded-xl bg-white hover:bg-stone-50 text-[#111827] border border-stone-200 text-sm font-semibold shadow-sm transition-all"
              >
                Explore Event Catalog
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. CLEAN LIGHT FOOTER (Matching Reference Image)
      ══════════════════════════════════════════════════════════ */}
      <footer className="bg-white border-t border-stone-200 py-12 text-xs text-[#6B7280]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-8">
            
            {/* Legal */}
            <div className="space-y-2">
              <p className="font-bold text-[#111827]">Legal</p>
              <ul className="space-y-1.5">
                <li><span className="hover:text-emerald-600 cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-emerald-600 cursor-pointer">Terms and Conditions</span></li>
              </ul>
            </div>

            {/* Explore */}
            <div className="space-y-2">
              <p className="font-bold text-[#111827]">Explore</p>
              <ul className="space-y-1.5">
                <li><Link to="/explore" className="hover:text-emerald-600">Online Services</Link></li>
                <li><Link to="/explore" className="hover:text-emerald-600">Browse Events</Link></li>
                <li><Link to="/wallet" className="hover:text-emerald-600">Attendee Wallet</Link></li>
              </ul>
            </div>

            {/* Social */}
            <div className="space-y-2">
              <p className="font-bold text-[#111827]">Social</p>
              <ul className="space-y-1.5">
                <li><span className="hover:text-emerald-600 cursor-pointer">About</span></li>
                <li><span className="hover:text-emerald-600 cursor-pointer">Community</span></li>
                <li><span className="hover:text-emerald-600 cursor-pointer">Instagram</span></li>
              </ul>
            </div>

          </div>

          <div className="pt-6 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#10B981] flex items-center justify-center text-white text-[9px] font-bold">
                T
              </div>
              <span className="font-medium text-stone-600">Ticketification</span>
              <span>© {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <span>Built with precision for next-gen events.</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PublicLandingPage;
