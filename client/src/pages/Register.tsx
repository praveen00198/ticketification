import React, { useState, useRef } from 'react';
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
  Compass,
  Sparkles,
  Eye,
  EyeOff,
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
  const searchParams = new URLSearchParams(window.location.search);
  const emailParam = searchParams.get('email') || initialEmail;

  const [name, setName] = useState('');
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  // Field validation touched state
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);

  const passwordError =
    touchedPassword && password.length > 0 && password.length < 6
      ? 'Password must be at least 6 characters long'
      : null;

  const confirmError =
    touchedConfirm && confirmPassword.length > 0 && password !== confirmPassword
      ? 'Passwords do not match'
      : null;

  const redirectTarget = searchParams.get('redirect') || '/events';

  const togglePasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 0);
  };

  const toggleConfirmPasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmPassword((prev) => !prev);
    setTimeout(() => {
      confirmPasswordInputRef.current?.focus();
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res: any = await apiClient.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (res.success && res.data) {
        onRegisterSuccess(res.data.token, res.data.user);
        // Unified navigation: directs user to redirect target or events catalog
        navigate(redirectTarget);
      }
    } catch (err: any) {
      const responseData = err?.response?.data;
      setError(
        responseData?.error?.message ||
        responseData?.message ||
        err?.message ||
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] text-[#111827] px-4 sm:px-6 lg:px-12 py-12 relative overflow-hidden font-sans selection:bg-stone-200 selection:text-stone-900">
      {/* ── Soft Ambient Background Glows ── */}
      <div
        className="pointer-events-none absolute top-0 right-0 w-[550px] h-[500px] rounded-full opacity-40 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 75% 25%, rgba(228, 228, 231, 0.5), rgba(244, 244, 245, 0.3) 50%, transparent 75%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-[-100px] w-[450px] h-[400px] rounded-full opacity-30 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 30% 70%, rgba(228, 228, 231, 0.4), transparent 70%)',
        }}
      />

      <div className="max-w-6xl w-full relative z-10 space-y-8">
        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors bg-white/90 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-stone-200/90 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Public Home
          </Link>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-700 bg-stone-100 px-3 py-1 rounded-full border border-stone-200/80 shadow-sm">
            Create Your Account
          </span>
        </div>

        {/* ── Split Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Side: Brand & Product Architecture */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-white shadow-sm">
                <Ticket className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#111827]">
                Ticketification
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200/80 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-stone-600" />
              <span>One Global User Identity</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              Attend Events.<br />
              <span className="text-stone-600 font-serif italic">Host When You Choose.</span>
            </h1>

            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Create a single account to register for gatherings, receive tamper-proof credentials, and organize your own events whenever you are ready.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0 mt-0.5">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Seamless Pass Wallet</h4>
                  <p className="text-xs text-stone-500">Collect passes and tickets across all registered events</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Host Without Obstacles</h4>
                  <p className="text-xs text-stone-500">Create an event at any time without creating a second account</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Verified & Secure</h4>
                  <p className="text-xs text-stone-500">Zero duplicate tickets and sub-200ms turnstile verification</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Registration Form */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-xl shadow-stone-900/5 space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                  Create Your Account
                </h2>
                <p className="text-xs text-stone-500">
                  Join Ticketification to attend gatherings or launch your own.
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

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Taylor"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-400/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-400/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onBlur={() => setTouchedPassword(true)}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm ${
                        passwordError
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-400/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-400/30 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{passwordError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onBlur={() => setTouchedConfirm(true)}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm ${
                        confirmError
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-400/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={toggleConfirmPasswordVisibility}
                      className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-400/30 transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {confirmError && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">{confirmError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-stone-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md border border-stone-800 flex items-center justify-center gap-2 disabled:opacity-50 mt-3 active:scale-[0.99]"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="pt-4 border-t border-stone-100 text-center">
                <div className="text-xs text-stone-500">
                  Already have an account?{' '}
                  {onNavigateToLogin ? (
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="font-bold text-stone-900 hover:text-black underline ml-1"
                    >
                      Sign In
                    </button>
                  ) : (
                    <Link to="/login" className="font-bold text-stone-900 hover:text-black underline ml-1">
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
