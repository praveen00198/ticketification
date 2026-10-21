import React, { useState } from 'react';
import {
  Eye,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const PrivacySettingsPage: React.FC = () => {
  const [publicDirectoryListing, setPublicDirectoryListing] = useState(false);
  const [organizerMessagingConsent, setOrganizerMessagingConsent] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Privacy Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Control how your attendee profile is presented across public event catalogs and to event hosts.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Privacy preferences updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6 text-xs">
        {/* Attendee Visibility */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Eye className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Catalog & Directory Visibility</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publicDirectoryListing}
                onChange={(e) => setPublicDirectoryListing(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-zinc-900">Include Profile in Public Attendee Directory</span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  When enabled, fellow participants can view your name and bio on public hackathon and conference participant rosters.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={organizerMessagingConsent}
                onChange={(e) => setOrganizerMessagingConsent(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-zinc-900">Organizer Direct Communications</span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Allow verified event organizers to transmit venue logistical instructions, track assignments, and entry credentials.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Credential Data Governance */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Lock className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Ticket & Check-in Privacy Standards</h3>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2 text-[11px] text-stone-600 leading-relaxed">
            <p>
              <strong className="text-zinc-900">Cryptographic isolation:</strong> Your passes and verification tokens are digitally signed per event. Event organizers only receive access to attendance check-in stamps and credential verification logs for their specific event.
            </p>
            <p>
              <strong className="text-zinc-900">Government ID:</strong> Government identity verification is explicitly disabled on Ticketification until authorized compliance integrations are certified.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-2xs"
          >
            Save Privacy Settings
          </button>
        </div>
      </form>
    </div>
  );
};
export default PrivacySettingsPage;
