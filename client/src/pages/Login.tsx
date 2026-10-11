import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Ticket,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface LoginProps {
  onLoginSuccess: (token: string, user: { name: string; email: string; eventName?: string }) => void;
  onNavigateToRegister?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const navigate = useNavigate();
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
        navigate('/events');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Login failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] text-[#111827] px-4 sm:px-6 lg:px-12 py-12 relative overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* ── Ambient Soft Mint / Emerald Gradient Glows ── */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[600px] h-[550px] rounded-full opacity-60 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 75% 25%, rgba(110, 231, 183, 0.45), rgba(167, 243, 208, 0.25) 50%, transparent 75%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-[-100px] w-[500px] h-[450px] rounded-full opacity-40 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 30% 70%, rgba(167, 243, 208, 0.35), transparent 70%)',
        }}
      />

      <div className="max-w-6xl w-full relative z-10 space-y-8">
        
        {/* ── Navigation Top Bar ── */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#4B5563] hover:text-[#111827] transition-colors bg-white/80 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-stone-200/80 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Public Home
          </Link>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60 shadow-sm">
            Organizer Console
          </span>
        </div>

        {/* ── Two-Column Split Layout for Large Devices ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* ══════════════════════════════════════════════════════════
              LEFT SIDE: Heading, Brand & Key Highlights (5 cols)
          ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <Ticket className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#111827]">
                Ticketification
              </span>
            </div>

            {/* Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Event Operations Suite</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              Welcome Back.<br />
              <span className="text-[#10B981]">Your Control Center Awaits.</span>
            </h1>

            {/* Concise Supporting Description */}
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              Access your real-time turnstiles, live attendance analytics, team rubrics, and tamper-proof credential issuer.
            </p>

            {/* Value bullets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Real-Time Door Velocity</h4>
                  <p className="text-xs text-[#6B7280]">Live turnstile sync and high-throughput admissions</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Zero Fraud Guarantees</h4>
                  <p className="text-xs text-[#6B7280]">Cryptographically bound single-use QR credentials</p>
                </div>
              </div>
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT SIDE: Elevated Light Sign In Form (7 cols)
          ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-xl shadow-stone-900/5 space-y-6">
              
              {/* Form Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                  Sign In to Organizer Console
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Enter your credentials to manage your events and admissions
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Authentication Failed</span>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Account Email */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@organization.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-3 active:scale-[0.99]"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Console'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

              </form>

              {/* New organizer link */}
              <div className="pt-4 border-t border-stone-100 text-center">
                <div className="text-xs text-[#6B7280]">
                  New organizer?{' '}
                  {onNavigateToRegister ? (
                    <button
                      type="button"
                      onClick={onNavigateToRegister}
                      className="font-bold text-emerald-600 hover:text-emerald-700 underline ml-1"
                    >
                      Create an Account
                    </button>
                  ) : (
                    <Link to="/register" className="font-bold text-emerald-600 hover:text-emerald-700 underline ml-1">
                      Create an Account
                    </Link>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Login;
