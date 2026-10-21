import React, { useState, useEffect } from 'react';
import {
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';

export const AccountSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [notifyOnTicketIssued, setNotifyOnTicketIssued] = useState(true);
  const [notifyOnScheduleChange, setNotifyOnScheduleChange] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res: any = await apiClient.get('/auth/me');
        if (res.user) {
          setUserData(res.user);
          if (res.user.preferences) {
            if (res.user.preferences.timezone) setTimezone(res.user.preferences.timezone);
            if (res.user.preferences.dateFormat) setDateFormat(res.user.preferences.dateFormat);
            if (res.user.preferences.notifyOnTicketIssued !== undefined) {
              setNotifyOnTicketIssued(Boolean(res.user.preferences.notifyOnTicketIssued));
            }
            if (res.user.preferences.notifyOnScheduleChange !== undefined) {
              setNotifyOnScheduleChange(Boolean(res.user.preferences.notifyOnScheduleChange));
            }
          }
        }
      } catch (err: any) {
        setError(extractErrorMessage(err, 'Failed to load user preferences.'));
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
        preferences: {
          timezone,
          dateFormat,
          notifyOnTicketIssued,
          notifyOnScheduleChange,
        },
      });

      if (res.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save account preferences.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs font-medium text-stone-500">Loading account preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Account Settings</h1>
        <p className="text-sm text-stone-500 mt-1">
          Configure interface regional preferences, schedule display options, and alert preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Preferences saved successfully to your account profile.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-6 text-xs">
        {/* Regional Preferences */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Globe className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Regional & Schedule Localization</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-900 mb-1.5">
                Display Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York">Eastern Time (US / Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US / Canada)</option>
                <option value="Europe/London">London (GMT / BST)</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Japan (JST)</option>
              </select>
              <p className="text-[10px] text-stone-400 mt-1">
                Converts event schedules and session start times to your local clock.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-900 mb-1.5">
                Date Display Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-21)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (21/10/2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (10/21/2026)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Bell className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Communication Channels</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnTicketIssued}
                onChange={(e) => setNotifyOnTicketIssued(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-zinc-900">Ticket Issuance Notices</span>
                <p className="text-[11px] text-stone-500">
                  Receive email confirmation whenever a digital credential or gate badge is issued to your wallet.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnScheduleChange}
                onChange={(e) => setNotifyOnScheduleChange(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="font-semibold text-zinc-900">Schedule & Venue Relocation Alerts</span>
                <p className="text-[11px] text-stone-500">
                  Receive critical real-time alerts if an event organizer updates room, hall, or start time details.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Account Metadata */}
        {userData && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <UserCheck className="w-4 h-4 text-stone-600" />
              <h3 className="text-sm font-bold text-zinc-900">Account Identity</h3>
            </div>
            <div className="bg-stone-50/70 p-3.5 rounded-xl border border-stone-200/80 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-stone-500">Account ID:</span>
                <span className="font-mono text-zinc-800">{userData.id || userData._id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Security Provider:</span>
                <span className="text-emerald-700 font-semibold">Custom Cryptographic JWT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Status:</span>
                <span className="text-zinc-800 font-medium">Verified Active</span>
              </div>
            </div>
          </div>
        )}

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
                Save Preferences
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
export default AccountSettingsPage;
