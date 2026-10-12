import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

export interface CallToActionSectionProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToRegister?: () => void;
  onNavigateToLogin?: () => void;
  titleLine1?: string;
  titleLine2?: string;
  description?: string;
  primaryActionLabel?: string;
  primaryActionTo?: string;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
}

export const CallToActionSection: React.FC<CallToActionSectionProps> = ({
  currentUser,
  onNavigateToRegister,
  titleLine1 = 'Put your event ops to work.',
  titleLine2 = 'Your team welcomes the crowd.',
  description = "Show us how your team works today. We'll show you what Ticketification takes off its plate first—from turnstile bottlenecks to duplicate pass fraud.",
  primaryActionLabel = 'Get started for free',
  primaryActionTo,
  secondaryActionLabel,
  secondaryActionTo = '/explore',
}) => {
  const navigate = useNavigate();

  const handlePrimaryClick = () => {
    if (primaryActionTo) {
      navigate(primaryActionTo);
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

  return (
    <section className="relative w-full overflow-hidden py-12 sm:py-16 my-4 sm:my-6">
      {/* ── Soft Misty Atmospheric Background (Neutral Grayscale Palette) ── */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Base mist canvas */}
        <div className="absolute inset-0 bg-[#FAFAF9]" />

        {/* High-diffusion cloudy atmospheric radial gradients */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background: `
              radial-gradient(ellipse 90% 65% at 50% 45%, rgba(228, 228, 231, 0.6) 0%, rgba(240, 240, 242, 0.45) 30%, rgba(245, 245, 247, 0.3) 60%, transparent 100%),
              radial-gradient(circle 600px at 15% 40%, rgba(225, 225, 230, 0.4) 0%, rgba(245, 245, 248, 0.2) 50%, transparent 80%),
              radial-gradient(circle 600px at 85% 55%, rgba(225, 225, 230, 0.4) 0%, rgba(245, 245, 248, 0.2) 50%, transparent 80%),
              radial-gradient(ellipse 70% 40% at 50% 85%, rgba(250, 250, 249, 0.95) 0%, transparent 80%)
            `,
          }}
        />

        {/* Subtle cloud drift texture effect */}
        <div
          className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#FAFAF9] to-transparent opacity-80"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#FAFAF9] to-transparent opacity-80"
          aria-hidden="true"
        />
      </div>

      {/* ── Main Content Container ── */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Subtle Pill Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-stone-200/80 shadow-2xs text-[11px] font-semibold text-stone-700 mb-5">
          <Sparkles className="w-3.5 h-3.5 text-stone-700" />
          <span>High-Throughput Event Operations</span>
        </div>

        {/* Two-Tone Classical Serif Headline */}
        <h2 className="font-serif tracking-tight text-stone-900 leading-[1.12]">
          <span className="block text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-950">
            {titleLine1}
          </span>
          <span className="block text-3xl sm:text-4xl lg:text-5xl font-normal text-stone-400 mt-1">
            {titleLine2}
          </span>
        </h2>

        {/* Clean, Relaxed Subtitle Copy */}
        <p className="mt-5 sm:mt-6 text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed font-normal">
          {description}
        </p>

        {/* Action Button: Capsule Pill */}
        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="group relative inline-flex items-center gap-3.5 pl-2.5 pr-7 py-2.5 rounded-full bg-stone-950 text-white text-sm font-medium shadow-md shadow-stone-950/15 hover:bg-black hover:shadow-lg hover:shadow-stone-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-stone-800/80 cursor-pointer"
          >
            {/* White Circular Arrow Badge */}
            <span className="w-7 h-7 rounded-full bg-white text-stone-950 flex items-center justify-center shrink-0 shadow-2xs group-hover:translate-x-0.5 transition-transform duration-200">
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            <span className="tracking-tight">{primaryActionLabel}</span>
          </button>

          {secondaryActionLabel && (
            <Link
              to={secondaryActionTo}
              className="text-xs sm:text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors underline-offset-4 hover:underline py-2"
            >
              {secondaryActionLabel}
            </Link>
          )}
        </div>

        {/* Supporting Trust Note */}
        <div className="mt-6 sm:mt-7 flex items-center justify-center gap-6 text-[11px] text-stone-500 font-medium">
          <span>✓ Instant setup</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span>✓ Free for under 250 attendees</span>
          <span className="w-1 h-1 rounded-full bg-stone-300" />
          <span>✓ Zero credit card required</span>
        </div>
      </div>
    </section>
  );
};
