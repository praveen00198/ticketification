import React from 'react';
import { ShieldCheck, Zap, Building, Wallet } from 'lucide-react';

export const TrustAndSecuritySection: React.FC = () => {
  return (
    <section id="trust" className="py-12 sm:py-16 bg-[#FAFAF9] border-t border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Engineered for Integrity
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            Why Organizers & Attendees<br />
            <span className="text-stone-500 font-serif italic">Trust Ticketification.</span>
          </h2>
          <p className="text-sm text-stone-600">
            Built on four security pillars that protect attendee identity and guarantee operational reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm hover:border-stone-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 border border-stone-200/60 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">Cryptographic Tokens</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              64-character opaque signed tokens replace raw attendee PII. Stolen screenshots cannot be forged or duplicated.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm hover:border-stone-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 border border-stone-200/60 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">Atomic Gate Resolution</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Conditional database updates resolve simultaneous scans at venue gates. Exactly one scan succeeds; the rest are rejected.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm hover:border-stone-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 border border-stone-200/60 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">Institutional Vetting</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Campus departments and verified companies undergo domain authentication before ticketing is activated.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-3 shadow-sm hover:border-stone-400 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-900 border border-stone-200/60 flex items-center justify-center">
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
  );
};
