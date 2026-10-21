import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';

export const MyProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState('USER');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res: any = await apiClient.get('/auth/me');
        if (res.user) {
          setName(res.user.name || '');
          setEmail(res.user.email || '');
          setPhone(res.user.phone || '');
          setBio(res.user.bio || '');
          setAvatarUrl(res.user.avatarUrl || '');
          setRole(res.user.role || 'USER');
        }
      } catch (err: any) {
        setNotification({
          type: 'error',
          message: extractErrorMessage(err, 'Failed to load user profile.'),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);

    try {
      const res: any = await apiClient.put('/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
      });

      if (res.success) {
        setNotification({
          type: 'success',
          message: 'Profile updated successfully.',
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: extractErrorMessage(err, 'Failed to update profile.'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs font-medium text-stone-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My Profile</h1>
        <p className="text-sm text-stone-500 mt-1">
          Manage your personal details, attendee credentials contact info, and platform identity.
        </p>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2.5 border ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-5 text-xs">
        <div className="flex items-center gap-4 pb-5 border-b border-stone-100">
          <div className="w-16 h-16 rounded-full bg-stone-100 text-zinc-800 font-bold text-xl flex items-center justify-center border border-stone-200 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">{name || 'Your Name'}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-stone-500">{email}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                {role}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-zinc-900 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-zinc-900 mb-1.5">
              Email Address (Account Identifier)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                value={email}
                disabled
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-stone-500 cursor-not-allowed"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              Primary email is managed through verified account credentials.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-zinc-900 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              Used for SMS event check-in reminders and urgent schedule notifications.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-zinc-900 mb-1.5">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-zinc-900 mb-1.5">
            Personal Bio / Headline
          </label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell event organizers about your background, interests, or project focus..."
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-2xs"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
export default MyProfilePage;
