import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ArrowRight,
  Sparkles,
  Sliders,
  Plus,
  X,
} from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { CallToActionSection } from '../components/sections';

interface PricingPageProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
}

type Currency = 'USD' | 'GBP' | 'INR';
type PricingTab = 'plans' | 'calculator';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  GBP: '£',
  INR: '₹',
};

// Rates relative to USD baseline
const RATES: Record<Currency, { multiplier: number; starter: number; plus: number; pro: number; plusOverage: string }> = {
  USD: { multiplier: 1, starter: 0, plus: 79, pro: 199, plusOverage: '$0.05' },
  GBP: { multiplier: 0.8, starter: 0, plus: 65, pro: 159, plusOverage: '£0.04' },
  INR: { multiplier: 85, starter: 0, plus: 5999, pro: 14999, plusOverage: '₹4.00' },
};

const PRICING_FAQS = [
  {
    id: 'what-does-ticketification-do',
    question: 'What does Ticketification do?',
    answer:
      'Ticketification is an all-in-one event operating and credential platform. It handles attendee registration, spreadsheet roster imports, tamper-proof visual badge generation with dynamic QR tokens, offline turnstile scanning, and multi-track evaluation rubrics—giving your team complete control on event day.',
  },
  {
    id: 'how-alternative-to-traditional',
    question: 'How is Ticketification an alternative to traditional ticketing tools?',
    answer:
      'Traditional ticketing platforms focus primarily on collecting fees and emailing static PDFs. Ticketification focuses on complete venue execution: atomic gate check-ins that prevent duplicate pass sharing, customizable visual badges with lanyard punch-slots, volunteer dispatch consoles, and judge rubrics for hackathons and summits.',
  },
  {
    id: 'do-we-have-to-pay-for-small-events',
    question: 'Do we have to pay for small or student events?',
    answer:
      'No. Educational hackathons, university student symposiums, and community meetups hosting under 250 attendees can use Ticketification completely free on our Starter tier—with full access to visual credentials, roster import, and turnstile check-ins with zero trial limits.',
  },
  {
    id: 'work-alongside-existing-team',
    question: 'Can you work alongside our existing staff and volunteer crew?',
    answer:
      'Yes. Ticketification includes role-based access control with dedicated consoles for Volunteers, Mentors, Evaluators, and Hosts. Your gate crew can scan passes using our mobile web app on any smartphone without installing native apps or accessing sensitive organizer settings.',
  },
  {
    id: 'offline-turnstiles',
    question: 'Can turnstile gates operate offline if venue Wi-Fi drops?',
    answer:
      'Yes. Our Turnstile Scanner PWA securely caches cryptographic verification tokens directly on device. When connectivity drops at underground exhibition halls or festival grounds, scanners continue clearing valid guests with offline anti-duplicate guarantees and automatically synchronize once reconnected.',
  },
  {
    id: 'what-does-it-cost',
    question: 'What does it cost as our attendance grows?',
    answer:
      'Our Plus plan starts at $79/mo for up to 1,500 attendees, and Pro is $199/mo for up to 5,000 attendees with multi-turnstile lanes and staff consoles. For large-scale festivals and enterprise summits over 5,000 guests, our Custom tier provides dedicated infrastructure, sub-50ms Redis turnstiles, and white-label attendee wallets.',
  },
];

export const PricingPage: React.FC<PricingPageProps> = ({
  currentUser,
  onNavigateToLogin,
  onNavigateToRegister,
}) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<PricingTab>('plans');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [attendeeCount, setAttendeeCount] = useState<number>(1200);
  const [openFaqId, setOpenFaqId] = useState<string | null>('what-does-ticketification-do');

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  const currSymbol = CURRENCY_SYMBOLS[currency];
  const rateConfig = RATES[currency];

  const handleCtaClick = (tier: string) => {
    if (tier === 'custom') {
      window.location.href = 'mailto:enterprise@ticketification.internal?subject=Enterprise%20Event%20Inquiry';
      return;
    }
    if (currentUser) {
      navigate('/events/create');
    } else if (onNavigateToRegister) {
      onNavigateToRegister();
    } else {
      navigate('/register');
    }
  };

  // Calculator estimations
  const recommendedTier =
    attendeeCount <= 250
      ? 'Starter'
      : attendeeCount <= 1500
      ? 'Plus'
      : attendeeCount <= 5000
      ? 'Pro'
      : 'Custom';

  const estimatedTurnstiles = Math.max(1, Math.ceil(attendeeCount / 400));
  const estimatedRasterSec = Math.max(2, Math.round(attendeeCount * 0.035));

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-[#111827] font-sans selection:bg-stone-200 selection:text-stone-900 relative overflow-x-clip flex flex-col justify-between">
      {/* ── Soft Ambient Background Glows (Neutral Light) ── */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[600px] h-[550px] rounded-full opacity-30 blur-3xl z-0"
        style={{
          background:
            'radial-gradient(circle at 75% 25%, rgba(228, 228, 231, 0.45), rgba(244, 244, 245, 0.2) 50%, transparent 80%)',
        }}
      />
      <div
        className="pointer-events-none absolute top-40 left-[-150px] w-[500px] h-[450px] rounded-full opacity-20 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 40% 40%, rgba(228, 228, 231, 0.35), transparent 70%)',
        }}
      />

      {/* 1. Global Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToRegister={onNavigateToRegister}
      />

      {/* ══════════════════════════════════════════════════════════
          2. PRICING HERO & CONTROLS
      ══════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-stone-600" />
            <span>Event Operating Platform Pricing</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal tracking-tight text-stone-900 leading-[1.1]">
            Explore our pricing
          </h1>

          <p className="text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
            Plans engineered for every organizer, from university hackathons to high-throughput global festivals and multi-track summits.
          </p>

          {/* Segmented Toggles (Plans vs Calculator, Currency Switcher) */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            {/* View Mode Pill Toggle */}
            <div className="inline-flex items-center p-1 bg-stone-200/70 rounded-full border border-stone-300/50 shadow-inner text-xs font-semibold text-stone-600">
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  activeTab === 'plans'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Plans
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calculator')}
                className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                  activeTab === 'calculator'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Calculator</span>
              </button>
            </div>

            {/* Currency Selector Pill */}
            <div className="inline-flex items-center p-1 bg-stone-200/70 rounded-full border border-stone-300/50 shadow-inner text-xs font-semibold text-stone-600">
              {(['USD', 'GBP', 'INR'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-full transition-all uppercase ${
                    currency === c
                      ? 'bg-white text-stone-900 shadow-xs font-bold'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            3. MAIN PRICING TIERS GRID
        ══════════════════════════════════════════════════════════ */}
        {activeTab === 'plans' ? (
          <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
            {/* ── Tier 1: Starter ── */}
            <div className="bg-white border border-stone-200/90 rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-stone-400 transition-all duration-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-serif font-normal text-stone-900 tracking-tight">
                    Starter
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 leading-snug">
                    Perfect for hackathons & student clubs
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 font-sans tracking-tight">
                      {currSymbol}0
                    </span>
                    <span className="text-xs text-stone-500 font-medium">/mo</span>
                  </div>
                  <p className="text-xs font-semibold text-stone-700 mt-1">
                    250 verified attendees included
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Unlimited tamper-proof visual QR passes</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>1 high-speed turnstile gate scanner</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Spreadsheet roster import (.xlsx, .csv)</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Attendee pass wallet & mobile verification</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <p className="text-[11px] text-stone-400">
                  *Always 100% free for educational hackathons
                </p>
                <button
                  type="button"
                  onClick={() => handleCtaClick('starter')}
                  className="w-full py-3.5 px-4 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200/80 active:scale-[0.98] text-stone-900 font-semibold text-xs tracking-wide transition-all shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>Start free trial</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Tier 2: Plus ── */}
            <div className="bg-white border border-stone-200/90 rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-stone-400 transition-all duration-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-serif font-normal text-stone-900 tracking-tight">
                    Plus
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 leading-snug">
                    Perfect for growing conferences & summits
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 font-sans tracking-tight">
                      {currSymbol}{rateConfig.plus}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">/mo</span>
                  </div>
                  <p className="text-xs font-semibold text-stone-700 mt-1">
                    1,500 verified attendees included
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Multi-track session badges & tiers</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>5 concurrent turnstile scanner lanes</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Team formation, tracks & rubric scoring</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Auto duplicate detection & email alerts</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <p className="text-[11px] text-stone-400">
                  *Extra attendees at {rateConfig.plusOverage} per pass
                </p>
                <button
                  type="button"
                  onClick={() => handleCtaClick('plus')}
                  className="w-full py-3.5 px-4 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-200/80 active:scale-[0.98] text-stone-900 font-semibold text-xs tracking-wide transition-all shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>Start free trial</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Tier 3: Pro (Most Popular) ── */}
            <div className="bg-white border-2 border-stone-900 rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between shadow-md relative hover:shadow-lg transition-all duration-200">
              {/* Popularity Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-serif font-normal text-stone-900 tracking-tight">
                    Pro
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 leading-snug">
                    Perfect for large festivals & expos
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 font-sans tracking-tight">
                      {currSymbol}{rateConfig.pro}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">/mo</span>
                  </div>
                  <p className="text-xs font-semibold text-stone-700 mt-1">
                    5,000 verified attendees included
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Everything in Plus plan, plus:</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Unlimited turnstiles with offline sync</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Volunteer & staff dispatch console</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>High-throughput Sharp rasterization</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <p className="text-[11px] text-stone-400">
                  *Zero penalty overage & live telemetry
                </p>
                <button
                  type="button"
                  onClick={() => handleCtaClick('pro')}
                  className="w-full py-3.5 px-4 rounded-full bg-stone-900 hover:bg-black active:scale-[0.98] text-white font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <span>Start free trial</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Tier 4: Custom / Enterprise ── */}
            <div className="bg-white border border-stone-200/90 rounded-[2rem] p-7 sm:p-8 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-stone-400 transition-all duration-200">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-serif font-normal text-stone-900 tracking-tight">
                    Custom
                  </h3>
                  <p className="text-xs text-stone-500 mt-1 leading-snug">
                    Tailored for stadium & enterprise scale
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 font-sans tracking-tight">
                      Custom
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-stone-700 mt-1">
                    5,000+ to 100,000+ attendees as needed
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Tailored support from our in-house team</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Sub-50ms dedicated Redis turnstiles</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>White-label wallet & custom domains</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs text-stone-700">
                    <Check className="w-4 h-4 text-stone-900 shrink-0 mt-0.5 stroke-[2.5]" />
                    <span>Enterprise SSO & immutable audit logs</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <p className="text-[11px] text-stone-400">
                  *On-site turnstile hardware integration available
                </p>
                <button
                  type="button"
                  onClick={() => handleCtaClick('custom')}
                  className="w-full py-3.5 px-4 rounded-full bg-stone-900 hover:bg-black active:scale-[0.98] text-white font-semibold text-xs tracking-wide transition-all shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>Book a call</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════
              4. INTERACTIVE ATTENDANCE CALCULATOR TAB
          ══════════════════════════════════════════════════════════ */
          <div className="mt-12 sm:mt-16 max-w-4xl mx-auto bg-white border border-stone-200/90 rounded-[2.5rem] p-8 sm:p-12 shadow-sm space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-serif font-normal text-stone-900">
                Event Attendance & Gate Estimator
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
                Drag the slider to your expected attendee size to calculate turnstile lane requirements and recommended tier.
              </p>
            </div>

            {/* Slider Control */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-stone-600">Expected Guests / Hackers:</span>
                <span className="text-2xl font-black text-stone-900 font-mono">
                  {attendeeCount.toLocaleString()}
                </span>
              </div>

              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={attendeeCount}
                onChange={(e) => setAttendeeCount(parseInt(e.target.value, 10))}
                className="w-full h-2.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900 focus:outline-none"
              />

              <div className="flex justify-between text-[11px] text-stone-400 font-mono">
                <span>100 (Meetup)</span>
                <span>2,500 (Conference)</span>
                <span>5,000 (Festival)</span>
                <span>10,000+ (Stadium)</span>
              </div>
            </div>

            {/* Calculation Output Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 text-center space-y-1">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Recommended Tier
                </div>
                <div className="text-2xl font-serif font-normal text-stone-900">
                  {recommendedTier}
                </div>
                <div className="text-xs text-stone-900 font-semibold">
                  {recommendedTier === 'Starter'
                    ? 'Free'
                    : recommendedTier === 'Plus'
                    ? `${currSymbol}${rateConfig.plus}/mo`
                    : recommendedTier === 'Pro'
                    ? `${currSymbol}${rateConfig.pro}/mo`
                    : 'Custom Contract'}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 text-center space-y-1">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Recommended Turnstiles
                </div>
                <div className="text-2xl font-black text-stone-900 font-mono">
                  {estimatedTurnstiles} {estimatedTurnstiles === 1 ? 'Lane' : 'Lanes'}
                </div>
                <div className="text-xs text-stone-500">
                  Sub-200ms scan throughput
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 text-center space-y-1">
                <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Batch Generation Time
                </div>
                <div className="text-2xl font-black text-stone-900 font-mono">
                  ~{estimatedRasterSec}s
                </div>
                <div className="text-xs text-stone-500">
                  Sharp rasterization pipeline
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => handleCtaClick(recommendedTier.toLowerCase())}
                className="px-8 py-3.5 rounded-full bg-stone-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition-all"
              >
                Continue with {recommendedTier} Plan →
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            5. FAQS 2-COLUMN SPLIT ACCORDION SECTION
        ══════════════════════════════════════════════════════════ */}
        <section className="mt-24 sm:mt-32 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
            {/* Left Column: Two-tone classical serif headline */}
            <div className="lg:w-5/12 lg:sticky lg:top-28 self-start">
              <h2 className="font-serif tracking-tight leading-[1.12]">
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-950">
                  A few good questions.
                </span>
                <span className="block text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-400 mt-1 sm:mt-2">
                  Clear answers.
                </span>
              </h2>
              <p className="mt-4 text-xs sm:text-sm text-stone-500 max-w-sm">
                Everything you need to know about Ticketification passes, turnstiles, and subscriptions.
              </p>
            </div>

            {/* Right Column: Minimal hairline accordion list */}
            <div className="lg:w-7/12 w-full border-t border-stone-200/80">
              {PRICING_FAQS.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id} className="border-b border-stone-200/80">
                    <button
                      type="button"
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full py-5 sm:py-6 flex items-center justify-between text-left group transition-colors cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-stone-900 text-base sm:text-lg group-hover:text-stone-950 transition-colors pr-6">
                        {faq.question}
                      </span>
                      <span className="shrink-0 text-stone-900 group-hover:text-stone-950 transition-colors flex items-center justify-center w-6 h-6">
                        {isOpen ? (
                          <X className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </span>
                    </button>
                    <div
                      style={{
                        maxHeight: isOpen ? '500px' : '0px',
                      }}
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${
                        isOpen ? 'opacity-100 pb-6' : 'opacity-0 pb-0'
                      }`}
                    >
                      <p className="text-sm sm:text-base text-stone-600 leading-relaxed pr-6 sm:pr-8 font-normal">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════════════════════════
          6. ATMOSPHERIC CALL TO ACTION
      ══════════════════════════════════════════════════════════ */}
      <CallToActionSection
        currentUser={currentUser}
        onNavigateToRegister={onNavigateToRegister}
        onNavigateToLogin={onNavigateToLogin}
        titleLine1="Put your event scale to work."
        titleLine2="Your team welcomes every attendee."
        description="Not sure which plan matches your gate velocity and pass volume? Start free today or talk with our team for high-throughput turnstile configurations."
        primaryActionLabel="Start free today"
        secondaryActionLabel="Explore public events →"
        secondaryActionTo="/explore"
      />

      {/* ══════════════════════════════════════════════════════════
          7. SIGNATURE ATMOSPHERIC FOOTER
      ══════════════════════════════════════════════════════════ */}
      <Footer
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToRegister={onNavigateToRegister}
      />
    </div>
  );
};

export default PricingPage;
