import React, { useState, useEffect } from 'react';
import {
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  UserCheck,
  Loader2,
  Info,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';
import {
  DateFormatOption,
  getStoredUserPreferences,
  setStoredUserPreferences,
} from '../utils/date';

export const AccountSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timezone, setTimezone] = useState(() => getStoredUserPreferences().timezone || 'UTC');
  const [dateFormat, setDateFormat] = useState<DateFormatOption>(() => getStoredUserPreferences().dateFormat || 'YYYY-MM-DD');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const res: any = await apiClient.get('/auth/me');
        const userObj = res?.data || res?.user;
        if (userObj) {
          setUserData(userObj);
          if (userObj.preferences) {
            if (userObj.preferences.timezone) {
              setTimezone(userObj.preferences.timezone);
            }
            if (userObj.preferences.dateFormat) {
              setDateFormat(userObj.preferences.dateFormat);
            }
            const uid = userObj.id || userObj._id;
            setStoredUserPreferences({
              timezone: userObj.preferences.timezone || timezone,
              dateFormat: userObj.preferences.dateFormat || dateFormat,
            }, uid);
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
        },
      });

      if (res.success) {
        const uid = userData?.id || userData?._id;
        setStoredUserPreferences({ timezone, dateFormat }, uid);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        setError(res.error || 'Failed to update preferences.');
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
          Configure regional clock formatting, timezone display, and platform localization.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Regional preferences saved successfully and applied across your dashboard.</span>
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
                <option value="America/Chicago">Central Time (US / Canada)</option>
                <option value="America/Denver">Mountain Time (US / Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US / Canada)</option>
                <option value="Europe/London">London (GMT / BST)</option>
                <option value="Europe/Berlin">Central Europe (CET / CEST)</option>
                <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Japan (JST)</option>
                <option value="Australia/Sydney">Sydney (AEST / AEDT)</option>
              </select>
              <p className="text-[10px] text-stone-400 mt-1">
                Converts event schedules, timestamps, and check-in logs to your preferred timezone.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-900 mb-1.5">
                Date Display Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatOption)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (Day / Month / Year)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (Month / Day / Year)</option>
              </select>
              <p className="text-[10px] text-stone-400 mt-1">
                Controls date formatting throughout registrations, ticket lists, and turnstile reports.
              </p>
            </div>
          </div>
        </div>

        {/* Notifications & Communications Notice */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
            <Bell className="w-4 h-4 text-stone-600" />
            <h3 className="text-sm font-bold text-zinc-900">Notifications & Delivery Channels</h3>
          </div>

          <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 space-y-2 text-[11px] text-stone-600 leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">Dashboard In-App Notifications Active</p>
                <p className="mt-0.5 text-stone-500">
                  Confirmed event registrations, credential passes, and turnstile check-in records are automatically reflected in your in-app Notification Center.
                </p>
                <p className="mt-1 text-[10px] text-stone-400">
                  External transactional email and SMS dispatch channels are currently in standby mode pending dedicated gateway configuration.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Account Identity Metadata */}
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
                Saving Preferences...
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
