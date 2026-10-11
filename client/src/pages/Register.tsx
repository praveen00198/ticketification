import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Ticket,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Users,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface RegisterProps {
  initialEmail?: string;
  onRegisterSuccess: (token: string, user: { name: string; email: string; eventName?: string }) => void;
  onNavigateToLogin?: () => void;
}

export const Register: React.FC<RegisterProps> = ({
  initialEmail = '',
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res: any = await apiClient.post('/auth/register', {
        name,
        email,
        password,
      });
      if (res.success && res.data) {
        onRegisterSuccess(res.data.token, res.data.user);
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Registration failed. Please try again.');
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
            Host Onboarding
          </span>
        </div>

        {/* ── Two-Column Split Layout for Large Devices ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* ══════════════════════════════════════════════════════════
              LEFT SIDE: Heading, Brand & Key Highlights (5 cols)
          ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Logo & Platform Tag */}
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
              <span>Next-Gen Event OS</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              Built for Visionary Organizers.<br />
              <span className="text-[#10B981]">Flawless From Day One.</span>
            </h1>

            {/* Concise Supporting Description */}
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed">
              Launch hackathons, tech conferences, and flagship gatherings with tamper-proof passes and instant access control.
            </p>

            {/* Crisp Feature Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Sub-200ms Turnstiles</h4>
                  <p className="text-xs text-[#6B7280]">Atomic entry scanning with zero race conditions</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Cryptographic Passes</h4>
                  <p className="text-xs text-[#6B7280]">Native Sharp PNG passes with single-use tokens</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Staff & Teaming OS</h4>
                  <p className="text-xs text-[#6B7280]">Coordinated staff access & blind judging rubrics</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className="pt-2 flex items-center gap-3">
              <div className="flex -space-x-2">
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                  alt="Creator 1"
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                  alt="Creator 2"
                />
                <img
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80"
                  alt="Creator 3"
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#111827]">
                  Trusted by 5,000+ creators
                </p>
                <div className="flex items-center text-amber-400 text-xs">
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                  <span>★</span>
                </div>
              </div>
            </div>

          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT SIDE: Elevated Light Registration Form (7 cols)
          ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-xl shadow-stone-900/5 space-y-6">
              
              {/* Form Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                  Create Organizer Account
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Start organizing world-class hackathons, conferences, and festivals
                </p>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Registration Error</span>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@organization.com"
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
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
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
                  {loading ? 'Creating Account...' : 'Create Account & Continue'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

              </form>

              {/* Already have an account */}
              <div className="pt-4 border-t border-stone-100 text-center">
                <div className="text-xs text-[#6B7280]">
                  Already have an account?{' '}
                  {onNavigateToLogin ? (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="font-bold text-emerald-600 hover:text-emerald-700 underline ml-1"
                    >
                      Sign In
                    </button>
                  ) : (
                    <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-700 underline ml-1">
                      Sign In
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

export default Register;
