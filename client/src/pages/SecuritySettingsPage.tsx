import React, { useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { apiClient, extractErrorMessage } from '../api/client';

export const SecuritySettingsPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password cannot be the same as the current password.');
      return;
    }

    setLoading(true);
    try {
      const res: any = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (res.success) {
        setSuccessMessage('Your password has been updated securely.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to update password. Verify your current password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Security & Password</h1>
        <p className="text-sm text-stone-500 mt-1">
          Manage your login credentials, password encryption, and authentication safeguards.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Change Password Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-5 text-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
          <KeyRound className="w-4 h-4 text-stone-600" />
          <h3 className="text-sm font-bold text-zinc-900">Change Account Password</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-semibold text-zinc-900 mb-1.5">
              Current Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full px-3 py-2 pr-10 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-zinc-900 mb-1.5">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-900 mb-1.5">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 pr-10 rounded-lg border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 shadow-2xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating Password...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Architecture Summary */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xs space-y-4 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-zinc-900">Platform Security Controls</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-emerald-200">
              ✓
            </div>
            <div>
              <span className="font-semibold text-zinc-900">Bcrypt Salted Password Hashing</span>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Passwords are one-way hashed with salted cost rounds before persisting to MongoDB. Plaintext credentials are never logged or stored.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-emerald-200">
              ✓
            </div>
            <div>
              <span className="font-semibold text-zinc-900">Zero-Trust JWT Token Lifecycles</span>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Stateless backend authentication with per-request RBAC verification against event-scoped memberships.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SecuritySettingsPage;
