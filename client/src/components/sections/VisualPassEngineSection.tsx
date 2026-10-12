import React, { useState } from 'react';
import { Ticket, QrCode, CheckCircle2 } from 'lucide-react';

export interface CredentialPreviewItem {
  id: string;
  title: string;
  subtitle: string;
  eventTitle: string;
  attendeeName: string;
  attendeeRole: string;
  badgeText: string;
  badgeColor: string;
  gate: string;
  zone: string;
  date: string;
  time: string;
  serialNumber: string;
  tokenHint: string;
  barcodeDigits: string;
}

export const DEFAULT_CREDENTIAL_PREVIEWS: CredentialPreviewItem[] = [
  {
    id: 'hacker',
    title: 'Hackathon Participant Pass',
    subtitle: 'Track allocation, team roster, and offline QR token',
    eventTitle: 'GLOBAL AI BUILDERS HACKATHON',
    attendeeName: 'Rahul Sharma',
    attendeeRole: 'Track: AI Systems · Team: CyberNova',
    badgeText: 'HACKER PASS',
    badgeColor: 'bg-stone-900 text-white',
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
    badgeColor: 'bg-stone-800 text-white',
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

export interface VisualPassEngineSectionProps {
  previews?: CredentialPreviewItem[];
}

export const VisualPassEngineSection: React.FC<VisualPassEngineSectionProps> = ({
  previews = DEFAULT_CREDENTIAL_PREVIEWS,
}) => {
  const [activeCredIndex, setActiveCredIndex] = useState(0);
  const activeCred = previews[activeCredIndex] || previews[0];

  return (
    <section id="credentials" className="py-14 sm:py-16 bg-white border-t border-stone-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">
            Visual Pass Engine
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            Tamper-Proof Visual Credentials.<br />
            <span className="text-stone-500 font-serif italic">Rendered On-The-Fly.</span>
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            The interactive preview below demonstrates how the server-side Sharp rasterization engine renders tamper-proof visual credentials with single-use cryptographic QR tokens.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
          {/* Left: Select Archetype (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Template Archetypes
              </p>
              <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                Illustrative Previews
              </span>
            </div>

            {previews.map((item, idx) => {
              const isActive = activeCredIndex === idx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCredIndex(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-100 border-stone-900 shadow-xs'
                      : 'bg-white border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className={`text-sm font-bold ${isActive ? 'text-stone-950' : 'text-[#111827]'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">{item.subtitle}</p>
                </button>
              );
            })}

            <div className="pt-3 space-y-2 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-800 shrink-0" />
                <span>Custom branding and event-specific taxonomies</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-800 shrink-0" />
                <span>Cryptographic single-use validation tokens</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-stone-800 shrink-0" />
                <span>Instant wallet storage across all your events</span>
              </div>
            </div>
          </div>

          {/* Right: Authentic Real Ticket (7 cols) */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-[360px] bg-white rounded-3xl border border-stone-200/90 shadow-2xl relative overflow-hidden transition-all duration-300 hover:shadow-stone-900/10">
              {/* Lanyard Punch Slot */}
              <div className="pt-3.5 flex justify-center">
                <div className="w-12 h-2 rounded-full bg-stone-200/80 border border-stone-300/70 shadow-inner" />
              </div>

              {/* Header */}
              <div className="px-6 pt-2 pb-3 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-stone-900 flex items-center justify-center text-white shadow-sm">
                    <Ticket className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="font-extrabold text-xs tracking-tight text-stone-900">
                    Ticketification
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-stone-100 text-stone-700 border border-stone-200">
                    SAMPLE PREVIEW
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-sm ${activeCred.badgeColor}`}>
                    {activeCred.badgeText}
                  </span>
                </div>
              </div>

              {/* Attendee Info */}
              <div className="px-6 pt-4 pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    ILLUSTRATIVE CREDENTIAL MOCKUP
                  </span>
                  {/* Status Indication: preserved active indicator */}
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </span>
                </div>
                <h4 className="text-2xl font-black text-[#111827] tracking-tight">
                  {activeCred.attendeeName}
                </h4>
                <p className="text-xs text-stone-600 font-semibold truncate">
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
                  {/* Status Indication: pass verification badge */}
                  <div className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white rounded-full border border-stone-200 px-3 py-1 shadow-md flex items-center gap-1 text-xs font-bold text-stone-900">
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
  );
};
