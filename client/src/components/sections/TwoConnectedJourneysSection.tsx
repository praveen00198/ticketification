import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Search,
  Filter,
  Download,
  Compass,
  ArrowRight,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface TwoConnectedJourneysSectionProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToRegister?: () => void;
}

interface FeatureTab {
  id: string;
  title: string;
  description: string;
  targetView: 'attendee' | 'organizer' | 'gate' | 'analytics';
}

const FEATURE_TABS: FeatureTab[] = [
  {
    id: 'pass-wallet',
    title: 'Attendee Pass Wallet',
    description: 'Instant cryptographic passes issued directly to attendee devices with offline-ready dynamic QR tokens.',
    targetView: 'attendee',
  },
  {
    id: 'organizer-console',
    title: 'Organizer Operations',
    description: 'Bulk spreadsheet roster ingestions, customized badge taxonomies, and multi-track staff allocations.',
    targetView: 'organizer',
  },
  {
    id: 'turnstile-scanners',
    title: 'Sub-200ms Turnstiles',
    description: 'Atomic conditional database updates eliminate double-entry fraud even across high-concurrency venue gates.',
    targetView: 'gate',
  },
  {
    id: 'live-telemetry',
    title: 'Real-Time Gate Telemetry',
    description: 'Live attendance curves, turnstile throughput benchmarks, and multi-zone capacity distributions.',
    targetView: 'analytics',
  },
];

export const TwoConnectedJourneysSection: React.FC<TwoConnectedJourneysSectionProps> = ({
  currentUser,
  onNavigateToRegister,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<number>(1); // Default to center organizer console

  return (
    <section id="how-it-works" className="py-14 sm:py-20 bg-white border-y border-stone-200/80 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
        {/* ── Top Header Section (Inspired by Reference) ── */}
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-stone-700" />
            <span>Platform Architecture</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#111827] tracking-tight">
            Two Connected Journeys.<br />
            <span className="text-stone-900 font-serif italic tracking-wide">One Unified Platform.</span>
          </h2>

          <p className="text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
            Whether you are presenting a credential at venue turnstiles or coordinating thousands of attendees, Ticketification powers the entire lifecycle.
          </p>
        </div>

        {/* ── Center 3-Phone Overlapping Showcase (Exact Layout of Reference Image) ── */}
        <div className="relative py-4 flex items-center justify-center">
          <div className="relative w-full max-w-4xl flex items-center justify-center">

            {/* ── PHONE 1 (LEFT): Attendee Pass Wallet ── */}
            <div
              onClick={() => setActiveTab(0)}
              className={`transition-all duration-300 cursor-pointer ${
                activeTab === 0
                  ? 'scale-105 z-30 ring-2 ring-stone-900 shadow-2xl'
                  : 'scale-95 opacity-85 hover:opacity-100 z-10'
              } -mr-8 sm:-mr-12 md:-mr-16 hidden sm:block w-[260px] md:w-[280px] h-[500px] md:h-[530px] rounded-[36px] bg-white border-[6px] border-stone-200 shadow-xl overflow-hidden flex flex-col`}
            >
              {/* Speaker Notch */}
              <div className="pt-2.5 pb-1 flex justify-center">
                <div className="w-16 h-3 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 mr-2" />
                  <div className="w-8 h-1 rounded-full bg-stone-300" />
                </div>
              </div>

              {/* App Header */}
              <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold">
                    T
                  </div>
                  <span className="text-xs font-extrabold text-stone-900">ticketification</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                </div>
              </div>

              {/* Internal Content: Attendee Pass Wallet */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-stone-400 font-mono tracking-wider">WALLET &gt; PASSES</div>
                  <div className="flex items-center justify-between mt-1">
                    <h4 className="text-base font-bold text-stone-900">My Passes</h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-900 text-white">
                      3 Active
                    </span>
                  </div>

                  {/* Search bar inside mockup */}
                  <div className="mt-2.5 relative">
                    <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <div className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200 text-[10px] text-stone-400">
                      Search pass ID or event...
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white text-[9px] font-semibold">
                      All Passes
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[9px]">
                      Upcoming
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[9px]">
                      Archived
                    </span>
                  </div>
                </div>

                {/* Sample Pass Cards in Wallet */}
                <div className="space-y-2 pt-1 flex-1">
                  <div className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                        GLOBAL AI SUMMIT
                      </span>
                      {/* Status Indication: Active Pulse */}
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        ACTIVE
                      </span>
                    </div>
                    <div className="font-bold text-xs text-stone-900">Hacker Delegate Pass</div>
                    <div className="flex items-center justify-between text-[9px] text-stone-500 pt-1 border-t border-stone-200/60 font-mono">
                      <span>GATE 04 • ZONE A</span>
                      <span className="flex items-center gap-0.5 font-bold text-stone-800">
                        <QrCode className="w-2.5 h-2.5" /> READY
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-stone-200 bg-white space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                        DEVCON BENGALURU
                      </span>
                      <span className="text-[9px] font-bold text-stone-500 font-mono">OCT 24</span>
                    </div>
                    <div className="font-bold text-xs text-stone-900">VIP Speaker Admission</div>
                    <div className="flex items-center justify-between text-[9px] text-stone-500 pt-1 border-t border-stone-100 font-mono">
                      <span>GATE 01 • STAGE B</span>
                      <span>#DC-0842</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 text-center">
                  <span className="text-[9px] font-medium text-stone-500">
                    Offline cryptographic verification enabled
                  </span>
                </div>
              </div>
            </div>

            {/* ── PHONE 2 (CENTER - ELEVATED): Organizer Live Dashboard ── */}
            <div
              onClick={() => setActiveTab(1)}
              className={`transition-all duration-300 cursor-pointer ${
                activeTab === 1 || activeTab === 3
                  ? 'scale-100 z-20 ring-2 ring-stone-900 shadow-2xl'
                  : 'scale-95 opacity-90 hover:opacity-100 z-10'
              } w-[290px] sm:w-[310px] md:w-[330px] h-[550px] md:h-[580px] rounded-[40px] bg-white border-[7px] border-stone-300/90 shadow-2xl overflow-hidden flex flex-col relative`}
            >
              {/* Dynamic Island / Notch */}
              <div className="pt-2.5 pb-1 flex justify-center">
                <div className="w-24 h-4 rounded-full bg-stone-950 flex items-center justify-between px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-800" />
                  <div className="w-2 h-2 rounded-full bg-stone-800" />
                </div>
              </div>

              {/* App Header */}
              <div className="px-5 py-2.5 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-stone-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    T
                  </div>
                  <span className="text-xs font-extrabold text-stone-900 tracking-tight">ticketification</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-stone-100 text-stone-600 flex items-center justify-center text-xs">
                    ☰
                  </div>
                </div>
              </div>

              {/* Organizer Content */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">EVENT OP CONSOLE</div>
                      <h3 className="text-base font-black text-stone-900 tracking-tight">Global AI Summit 2026</h3>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      className="flex-1 py-1.5 px-2.5 rounded-lg border border-stone-200 text-stone-700 text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-stone-50"
                    >
                      <Filter className="w-3 h-3" /> Filter
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-900 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-black shadow-xs"
                    >
                      <Download className="w-3 h-3" /> Export
                    </button>
                  </div>
                </div>

                {/* Metrics Card */}
                <div className="p-3.5 rounded-2xl bg-[#FAFAF9] border border-stone-200/90 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      LIVE CHECK-IN VELOCITY
                    </span>
                    {/* Status Indication */}
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-stone-900 font-mono">1,248</span>
                    <span className="text-xs text-stone-500 font-mono">/ 1,500 checked in</span>
                    <span className="text-xs font-bold text-stone-900 ml-auto">83.2%</span>
                  </div>

                  {/* Wave Graph (Monochrome Light Aesthetic Matching Image) */}
                  <div className="h-20 w-full relative pt-2">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 240 70" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1c1917" stopOpacity="0.18" />
                          <stop offset="100%" stopColor="#1c1917" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Area Fill */}
                      <path
                        d="M 0,55 Q 30,50 60,35 T 120,15 T 180,40 T 240,25 L 240,70 L 0,70 Z"
                        fill="url(#curveGradient)"
                      />
                      {/* Curve Stroke */}
                      <path
                        d="M 0,55 Q 30,50 60,35 T 120,15 T 180,40 T 240,25"
                        fill="none"
                        stroke="#1c1917"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {/* Peak Dot */}
                      <circle cx="120" cy="15" r="3.5" fill="#1c1917" stroke="#ffffff" strokeWidth="2" />
                    </svg>
                  </div>

                  <div className="flex justify-between text-[9px] text-stone-400 font-mono pt-1">
                    <span>08:00 AM</span>
                    <span>10:00 AM (Peak)</span>
                    <span>12:00 PM</span>
                  </div>
                </div>

                {/* Turnstile Lanes Quick Status */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                    ACTIVE VENUE LANES
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl border border-stone-200 bg-white flex items-center justify-between">
                      <span className="font-bold text-stone-800 text-[11px]">Gate 01 • Main</span>
                      <span className="text-[10px] font-mono text-stone-900 font-bold">140ms</span>
                    </div>
                    <div className="p-2 rounded-xl border border-stone-200 bg-white flex items-center justify-between">
                      <span className="font-bold text-stone-800 text-[11px]">Gate 04 • VIP</span>
                      <span className="text-[10px] font-mono text-stone-900 font-bold">110ms</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-center border-t border-stone-100">
                  <span className="text-[10px] font-bold text-stone-900 hover:underline">
                    View Full Event Dashboard &rarr;
                  </span>
                </div>
              </div>
            </div>

            {/* ── PHONE 3 (RIGHT): Gate Turnstile & Performance Report ── */}
            <div
              onClick={() => setActiveTab(2)}
              className={`transition-all duration-300 cursor-pointer ${
                activeTab === 2
                  ? 'scale-105 z-30 ring-2 ring-stone-900 shadow-2xl'
                  : 'scale-95 opacity-85 hover:opacity-100 z-10'
              } -ml-8 sm:-ml-12 md:-ml-16 hidden sm:block w-[260px] md:w-[280px] h-[500px] md:h-[530px] rounded-[36px] bg-white border-[6px] border-stone-200 shadow-xl overflow-hidden flex flex-col`}
            >
              {/* Speaker Notch */}
              <div className="pt-2.5 pb-1 flex justify-center">
                <div className="w-16 h-3 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-stone-300 mr-2" />
                  <div className="w-8 h-1 rounded-full bg-stone-300" />
                </div>
              </div>

              {/* App Header */}
              <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-stone-900 text-white flex items-center justify-center text-[10px] font-bold">
                    T
                  </div>
                  <span className="text-xs font-extrabold text-stone-900">ticketification</span>
                </div>
                <div className="text-[10px] font-mono font-bold text-stone-500">9:41 AM</div>
              </div>

              {/* Performance Report Mockup */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] text-stone-400 font-mono tracking-wider">GATE SCANNER #04</div>
                  <div className="flex items-center justify-between mt-1">
                    <h4 className="text-base font-bold text-stone-900">Performance</h4>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                      Live Gate
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5">
                    <button
                      type="button"
                      className="flex-1 py-1 px-2 rounded-md bg-stone-100 text-stone-700 text-[9px] font-semibold"
                    >
                      Customize
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-1 px-2 rounded-md bg-stone-900 text-white text-[9px] font-semibold"
                    >
                      + Add Lane
                    </button>
                  </div>
                </div>

                {/* Donut Chart Showcase */}
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col items-center">
                  <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2 self-start">
                    ADMISSION DISTRIBUTION
                  </div>

                  {/* SVG Donut Chart */}
                  <div className="relative w-24 h-24 my-1">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      {/* Background circle */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#e7e5e4" strokeWidth="4.5" />
                      {/* Segment 1: General (60%) */}
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#1c1917"
                        strokeWidth="4.5"
                        strokeDasharray="52.8 88"
                        strokeDashoffset="0"
                      />
                      {/* Segment 2: VIP (25%) */}
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#57534e"
                        strokeWidth="4.5"
                        strokeDasharray="22 88"
                        strokeDashoffset="-52.8"
                      />
                      {/* Segment 3: Staff (15%) */}
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="#a8a29e"
                        strokeWidth="4.5"
                        strokeDasharray="13.2 88"
                        strokeDashoffset="-74.8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-black text-stone-900 font-mono">100%</span>
                      <span className="text-[7px] text-stone-400 font-mono uppercase">Verified</span>
                    </div>
                  </div>

                  {/* Donut Legend */}
                  <div className="w-full grid grid-cols-3 gap-1 pt-2 border-t border-stone-200/60 text-[8px] font-mono text-center">
                    <div>
                      <span className="block font-bold text-stone-900">60%</span>
                      <span className="text-stone-500">General</span>
                    </div>
                    <div>
                      <span className="block font-bold text-stone-900">25%</span>
                      <span className="text-stone-500">VIP</span>
                    </div>
                    <div>
                      <span className="block font-bold text-stone-900">15%</span>
                      <span className="text-stone-500">Staff</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-white border border-stone-200 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-stone-700">Duplicate Pass Risk:</span>
                  <span className="font-bold text-stone-900 font-mono">0.00% (Guaranteed)</span>
                </div>

                <div className="text-center pt-1">
                  <span className="text-[9px] text-stone-400 font-mono">Sub-second scan synchronization</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom Interactive Feature Bar (Exact Style of Reference Image) ── */}
        <div className="">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-stone-200/80">
            {FEATURE_TABS.map((tab, idx) => {
              const isActive = activeTab === idx;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(idx)}
                  className={`p-5 sm:p-6 transition-all cursor-pointer relative ${
                    isActive
                      ? 'bg-stone-50/60'
                      : 'hover:bg-stone-50/30'
                  }`}
                >
                  {/* Active Top Border Accent Line (Matching Reference Image) */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-stone-900" />
                  )}

                  <h3 className={`text-sm sm:text-base font-bold transition-colors ${
                    isActive ? 'text-stone-950' : 'text-stone-700'
                  }`}>
                    {tab.title}
                  </h3>

                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    {tab.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom Dual-Journey CTAs ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-stone-900 hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>Explore Events as an Attendee</span>
          </button>

          <button
            type="button"
            onClick={currentUser ? () => navigate('/events/create') : onNavigateToRegister}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-stone-50 text-stone-900 border border-stone-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <Layers className="w-4 h-4 text-stone-700" />
            <span>Host Events as an Organizer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
