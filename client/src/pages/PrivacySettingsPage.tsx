import React, { useState, useEffect } from 'react';
import {
  Eye,
  CheckCircle2,
  AlertCircle,
  Lock,
  Save,
  Loader2,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';

export const PrivacySettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [publicProfileInRoster, setPublicProfileInRoster] = useState(false);
  const [organizerMessagingConsent, setOrganizerMessagingConsent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res: any = await apiClient.get('/auth/me');
        if (res.user?.privacy) {
          if (res.user.privacy.publicProfileInRoster !== undefined) {
            setPublicProfileInRoster(Boolean(res.user.privacy.publicProfileInRoster));
          }
          if (res.user.privacy.organizerMessagingConsent !== undefined) {
            setOrganizerMessagingConsent(Boolean(res.user.privacy.organizerMessagingConsent));
          }
        }
      } catch (err: any) {
        setError(extractErrorMessage(err, 'Failed to load privacy preferences.'));
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res: any = await apiClient.put('/auth/profile', {
        privacy: {
          publicProfileInRoster,
          organizerMessagingConsent,
        },
      });

      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to update privacy settings.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs font-medium text-stone-500">Loading privacy settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Privacy Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Manage your participant profile visibility and organizer communications.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Privacy preferences updated and saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6 text-xs">
        {/* Attendee Visibility */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Eye className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Attendee Visibility</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publicProfileInRoster}
                onChange={(e) => setPublicProfileInRoster(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-zinc-900">Show Profile on Public Participant Rosters</span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Allows other registered attendees to see your name and headline on event attendee lists.
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
                <span className="font-semibold text-zinc-900">Event Host Direct Communications</span>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  Allows organizers of events you register for to send direct logistical announcements and check-in guidance.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Data Governance & Access Boundary */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Lock className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Event Isolation & Security</h3>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2 text-[11px] text-stone-600 leading-relaxed">
            <p>
              <strong className="text-zinc-900">Strict Event Isolation:</strong> Event organizers only receive access to attendance check-in status and registration form fields for events you specifically register for. No cross-event data sharing is permitted.
            </p>
            <p>
              <strong className="text-zinc-900">Pass Security:</strong> All digital credentials and QR verification tokens are cryptographically signed and verified atomically during access control.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-2xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Privacy Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
export default PrivacySettingsPage;
