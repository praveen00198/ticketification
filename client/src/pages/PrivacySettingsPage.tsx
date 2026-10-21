import React from 'react';
import {
  ShieldCheck,
  Lock,
  Layers,
  KeyRound,
  FileCheck,
} from 'lucide-react';

export const PrivacySettingsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Privacy & Data Governance</h1>
        <p className="text-sm text-stone-500 mt-1">
          Review your data access boundaries, event isolation guarantees, and cryptographic protections.
        </p>
      </div>

      {/* Verified Privacy Guarantees */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-zinc-900">Active Privacy Controls</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-200">
              <Layers className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900">Zero-Trust Event Isolation (IDOR Defense)</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Event hosts and organizers only have access to registration and check-in records for events you explicitly register for. Cross-event data leaks are prevented by mandatory compound scoping on the backend (&apos;eventId&apos; filter).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-200">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900">Cryptographic Credential & Turnstile Security</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Your passes and gate QR tokens use dynamic HMAC-SHA256 signatures verified atomically during check-in. Static barcodes and screenshot duplication are prohibited to protect your credential integrity.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 border border-emerald-200">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900">Password & Identity Cryptography</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Account passwords are one-way hashed with salted PBKDF2/bcrypt rounds before database persistence. Plaintext passwords are never stored or logged in application memory.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80">
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center font-bold shrink-0 border border-stone-200">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900">No Government ID Collection</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Ticketification does not collect, process, or store government identity documents or sensitive biometric identifiers. Pass verification is tied strictly to platform user identity.
              </p>
            </div>
          </div>
        </div>

        {/* Future Governance Notice */}
        <div className="pt-3 border-t border-stone-100">
          <div className="p-4 rounded-xl bg-stone-50/50 border border-dashed border-stone-200 space-y-1 text-[11px] text-stone-500">
            <span className="font-semibold text-zinc-800">Planned Collaboration Preferences</span>
            <p className="leading-relaxed">
              Granular public attendee roster visibility and organizer direct messaging preferences will become configurable alongside multi-track hackathon and conference participant networking features.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PrivacySettingsPage;
