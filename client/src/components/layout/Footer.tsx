import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';

interface FooterProps {
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigateToLogin,
  onNavigateToRegister,
  className = '',
}) => {
  return (
    <footer className={`relative bg-white pt-16 sm:pt-20 overflow-hidden font-sans ${className}`}>
      {/* ── Main Footer Directory & Branding ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 sm:pb-16">
          {/* Brand Info & App Badge Column */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform duration-200">
                <Ticket className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-zinc-900">
                Ticketification
              </span>
            </Link>

            <p className="text-sm text-stone-600 max-w-sm leading-relaxed">
              One platform unifies the attendee and organizer journey from discovery to atomic check-in.
            </p>

            {/* App Store / Mobile Pill Button */}
            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <Link
                to="/wallet"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-stone-200/90 text-xs font-semibold text-stone-800 shadow-2xs hover:border-stone-300 hover:shadow-xs transition-all duration-150 active:scale-95"
              >
                {/* Apple glyph */}
                <svg
                  className="w-3.5 h-3.5 fill-current text-stone-900"
                  viewBox="0 0 170 170"
                  aria-hidden="true"
                >
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.98-12.12-14.7-6.52-9.9-11.66-21.05-15.42-33.45-3.76-12.4-5.64-24.16-5.64-35.28 0-14.48 3.55-26.4 10.65-35.77 7.1-9.37 16.02-14.19 26.77-14.46 5.25 0 11.05 1.51 17.41 4.53 6.36 3.02 10.37 4.6 12.04 4.74 1.34-.14 5.37-1.78 12.08-4.92 6.71-3.14 12.39-4.59 17.04-4.35 12.48.65 22.42 5.17 29.83 13.56-10.89 6.64-16.22 15.76-16 27.35.23 9.07 3.59 16.79 10.08 23.16 6.49 6.37 14.34 10.02 23.55 10.96-2.02 6.33-4.39 12.59-7.1 18.78zM119.22 31.84c0-7.39 2.66-14.31 7.98-20.76 5.32-6.45 11.89-10.42 19.7-11.91.56 1.12.87 2.37.93 3.75.14 1.38.14 2.64 0 3.78-.97 7.03-3.72 13.78-8.25 20.25-4.53 6.47-10.74 10.43-18.63 11.88-.63-1.12-1.09-2.45-1.38-3.99-.23-1.05-.35-2.05-.35-3z" />
                </svg>
                <span>iPhone app</span>
              </Link>

              <Link
                to="/scan"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200/70 text-xs font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Turnstile Scanner PWA</span>
              </Link>
            </div>
          </div>

          {/* Directory Links (4 Columns) */}
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {/* Apps / Platform */}
            <div className="space-y-3.5">
              <h4 className="text-sm font-bold text-stone-900 tracking-tight">Platform</h4>
              <ul className="space-y-2.5 text-sm text-stone-600">
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Event Discovery
                  </Link>
                </li>
                <li>
                  <Link to="/wallet" className="hover:text-stone-950 transition-colors">
                    Pass Wallet
                  </Link>
                </li>
                <li>
                  <Link to="/events" className="hover:text-stone-950 transition-colors">
                    Organizer Console
                  </Link>
                </li>
                <li>
                  <Link to="/import" className="hover:text-stone-950 transition-colors">
                    Roster Import
                  </Link>
                </li>
                <li>
                  <Link to="/scan" className="hover:text-stone-950 transition-colors">
                    Turnstile Gates
                  </Link>
                </li>
              </ul>
            </div>

            {/* Event Types */}
            <div className="space-y-3.5">
              <h4 className="text-sm font-bold text-stone-900 tracking-tight">Event Types</h4>
              <ul className="space-y-2.5 text-sm text-stone-600">
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Hackathons
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Conferences
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Concerts & Shows
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Festivals
                  </Link>
                </li>
                <li>
                  <Link to="/explore" className="hover:text-stone-950 transition-colors">
                    Workshops & Fests
                  </Link>
                </li>
              </ul>
            </div>

            {/* Product & Engine */}
            <div className="space-y-3.5">
              <h4 className="text-sm font-bold text-stone-900 tracking-tight">Product</h4>
              <ul className="space-y-2.5 text-sm text-stone-600">
                <li>
                  <a href="#how-it-works" className="hover:text-stone-950 transition-colors">
                    Architecture
                  </a>
                </li>
                <li>
                  <a href="#credentials" className="hover:text-stone-950 transition-colors">
                    Smart Passes
                  </a>
                </li>
                <li>
                  <Link to="/pricing" className="hover:text-stone-950 transition-colors">
                    Pricing & Plans
                  </Link>
                </li>
                <li>
                  <a href="#trust" className="hover:text-stone-950 transition-colors">
                    Tamper Proofing
                  </a>
                </li>
                <li>
                  {onNavigateToRegister ? (
                    <button
                      type="button"
                      onClick={onNavigateToRegister}
                      className="hover:text-stone-950 transition-colors text-left"
                    >
                      Host Onboarding
                    </button>
                  ) : (
                    <Link to="/register" className="hover:text-stone-950 transition-colors">
                      Host Onboarding
                    </Link>
                  )}
                </li>
                <li>
                  {onNavigateToLogin ? (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="hover:text-stone-950 transition-colors text-left"
                    >
                      Sign In
                    </button>
                  ) : (
                    <Link to="/login" className="hover:text-stone-950 transition-colors">
                      Sign In
                    </Link>
                  )}
                </li>
              </ul>
            </div>

            {/* Social & Community */}
            <div className="space-y-3.5">
              <h4 className="text-sm font-bold text-stone-900 tracking-tight">Social</h4>
              <ul className="space-y-2.5 text-sm text-stone-600">
                <li>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-950 transition-colors"
                  >
                    X (Twitter)
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-950 transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-950 transition-colors"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://discord.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-950 transition-colors"
                  >
                    Discord
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-stone-950 transition-colors"
                  >
                    YouTube
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Subtle Hairline Divider ── */}
        <div className="border-t border-stone-200/90 pt-8" />

        {/* ── Copyright & Legal Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-500 pb-3 sm:pb-4">
          <p>
            &copy; {new Date().getFullYear()} Ticketification, Inc. All rights reserved.{' '}
            <span className="hover:text-stone-800 transition-colors cursor-pointer underline decoration-stone-300 underline-offset-2 ml-4">
              Terms of Service
            </span>{' '}
            and{' '}
            <span className="hover:text-stone-800 transition-colors cursor-pointer underline decoration-stone-300 underline-offset-2">
              Privacy Policy
            </span>
            .
          </p>

          <span className="text-stone-400 text-[11px] font-mono tracking-tight">
            v2.0 &bull; Tamper-Proof Event OS
          </span>
        </div>
      </div>

      {/* ── Signature Atmospheric Gradient & Giant Brand Watermark ── */}
      <div className="relative w-full overflow-hidden select-none pointer-events-none mt-0">
        {/* Ambient Gradient Glow */}
        <div
          className="w-full h-28 sm:h-36 lg:h-48 flex items-end justify-center"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(245,245,244,0.3) 25%, rgba(209,250,229,0.35) 65%, rgba(167,243,208,0.55) 100%)',
          }}
        >
          {/* Subtle radial center highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-emerald-200/40 via-emerald-100/10 to-transparent" />

          {/* Giant Ideogram-style Watermark Brand Text in Serif */}
          <span
            className="text-[14vw] sm:text-[13.5vw] lg:text-[13vw] font-serif font-medium text-center tracking-wide leading-none translate-y-[15%] sm:translate-y-[18%] text-transparent transition-all"
            style={{
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
              WebkitTextStroke: '1.2px rgba(5, 150, 104, 0.15)',
              background:
                'linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.25) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            Ticketification
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
