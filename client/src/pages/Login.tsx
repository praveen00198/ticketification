import React, { useState } from 'react';
import { Ticket, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '../api/client';

interface LoginProps {
  onLoginSuccess: (token: string, user: { name: string; email: string; eventName?: string }) => void;
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res: any = await apiClient.post('/auth/login', { email, password });
      if (res.success && res.data) {
        onLoginSuccess(res.data.token, res.data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-bg px-4 py-12">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl text-white shadow-lg mb-4">
            <Ticket className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-surface-charcoal tracking-tight">
            TICKETIFICATION <span className="text-brand-600">CONSOLE</span>
          </h1>
          <p className="text-xs text-surface-muted mt-1 font-medium">
            Operational Event Ticketing & QR Verification Console
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl border border-surface-border p-8 shadow-sm">
          <h2 className="text-lg font-bold text-surface-charcoal mb-6">Administrator Sign In</h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Authentication Failed</span>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-surface-charcoal uppercase tracking-wider mb-2">
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ticketification.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-bg border border-surface-border rounded-lg text-sm text-surface-charcoal focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-surface-charcoal uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-bg border border-surface-border rounded-lg text-sm text-surface-charcoal focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Console'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-surface-border text-center space-y-2">
            <div className="text-xs text-surface-muted">
              Don't have an admin account?{' '}
              <button
                onClick={onNavigateToRegister}
                className="font-bold text-brand-600 hover:text-brand-700 hover:underline"
              >
                Register here
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

