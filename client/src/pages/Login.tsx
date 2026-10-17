import React, { useState, useRef, useEffect } from 'react';
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
  Compass,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '../api/client';

interface LoginProps {
  onLoginSuccess: (token: string, user: { name: string; email: string; eventName?: string }, refreshToken?: string) => void;
  onNavigateToRegister?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const redirectTarget = searchParams.get('redirect') || '/events';

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleEmailChange = (val: string) => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    setAccountNotFound(false);
    setEmail(val);
  };

  const togglePasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 0);
  };

  const handleNavigateToSignup = () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    if (onNavigateToRegister) {
      onNavigateToRegister();
    } else {
      navigate(`/register?email=${encodeURIComponent(email.trim())}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    setLoading(true);
    setError(null);
    setAccountNotFound(false);

    try {
      const res: any = await apiClient.post('/auth/login', { email: email.trim(), password });
      if (res.success && res.data) {
        onLoginSuccess(res.data.token, res.data.user, res.data.refreshToken);
        navigate(redirectTarget);
      }
    } catch (err: any) {
      const responseData = err?.response?.data;
      const errorCode = responseData?.error?.code;
      const errorMessage =
        responseData?.error?.message ||
        responseData?.message ||
        err?.message ||
        'Login failed. Please verify your email and password.';

      if (
        errorCode === 'ACCOUNT_NOT_FOUND' ||
        errorMessage.toLowerCase().includes('no ticketification account') ||
        responseData?.error?.details?.notFound === true
      ) {
        setAccountNotFound(true);
        setError('No Ticketification account exists with this email address.');
        // Automatically redirect to registration with the email prefilled after 2.5 seconds
        redirectTimeoutRef.current = setTimeout(() => {
          handleNavigateToSignup();
        }, 2500);
      } else {
        setAccountNotFound(false);
        setError(errorMessage);
      }
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
          background: 'radial-gradient(circle at 75% 25%, rgba(228, 228, 231, 0.5), rgba(244, 244, 245, 0.2) 50%, transparent 75%)',
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-[-100px] w-[450px] h-[400px] rounded-full opacity-30 blur-3xl z-0"
        style={{
          background: 'radial-gradient(circle at 30% 70%, rgba(228, 228, 231, 0.35), transparent 70%)',
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
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-stone-700 bg-stone-100 px-3 py-1 rounded-full border border-stone-200/80 shadow-xs">
            Unified Account Access
          </span>
        </div>

        {/* ── Split Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Side: Brand & Product Architecture */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-md shadow-stone-900/10">
                <Ticket className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-[#111827]">
                Ticketification
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-stone-700" />
              <span>Event Operating & Credential Platform</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              One Account.<br />
              <span className="text-stone-600 font-serif italic">Attend & Organize.</span>
            </h1>

            <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
              Sign in with your unified identity to view your event passes, check in to registered gatherings, or manage and operate events you host.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-900 shrink-0 mt-0.5">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Attendee Pass Wallet</h4>
                  <p className="text-xs text-stone-500">Access dynamic QR credentials across all registered events</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-900 shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Organizer Control Center</h4>
                  <p className="text-xs text-stone-500">Configure events, manage admissions, and run atomic turnstiles</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-900 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Zero Fraud Guarantees</h4>
                  <p className="text-xs text-stone-500">Cryptographically signed single-use verification tokens</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Sign In Form */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg bg-white rounded-3xl border border-stone-200/90 p-8 sm:p-10 shadow-xl shadow-stone-900/5 space-y-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">
                  Sign In to Ticketification
                </h2>
                <p className="text-xs text-stone-500">
                  Enter your credentials to access your passes, tickets, and events.
                </p>
              </div>

              {/* Account Not Found vs Error Banner */}
              {accountNotFound ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950">Account Not Found</span>
                      <p className="mt-0.5 text-amber-800">
                        No Ticketification account exists for <span className="font-semibold">{email}</span>. Redirecting you to sign up...
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNavigateToSignup}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Create Account
                  </button>
                </div>
              ) : (
                error && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Authentication Failed</span>
                      <p className="mt-0.5">{error}</p>
                    </div>
                  </div>
                )
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="you@example.com"
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
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-white border border-stone-200 focus:border-stone-900 focus:ring-2 focus:ring-stone-400/20 rounded-xl text-sm text-[#111827] placeholder-stone-400 focus:outline-none transition-all shadow-sm"
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-stone-900 hover:bg-black text-white font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mt-3 active:scale-[0.99] cursor-pointer"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="pt-4 border-t border-stone-100 text-center">
                <div className="text-xs text-stone-500">
                  Don't have an account yet?{' '}
                  {onNavigateToRegister ? (
                    <button
                      type="button"
                      onClick={onNavigateToRegister}
                      className="font-bold text-stone-900 hover:text-black underline ml-1 cursor-pointer"
                    >
                      Create an Account
                    </button>
                  ) : (
                    <Link to="/register" className="font-bold text-stone-900 hover:text-black underline ml-1">
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
