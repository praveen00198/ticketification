import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Ticket, Menu, X, ArrowRight } from 'lucide-react';

export interface NavbarProps {
  currentUser?: { name: string; email: string; role?: string } | null;
  onNavigateToLogin?: () => void;
  onNavigateToRegister?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onNavigateToLogin,
  onNavigateToRegister,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleAnchorClick = (anchorId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname === '/') {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(`/#${anchorId}`);
  };

  const handleLoginClick = () => {
    setMobileMenuOpen(false);
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      navigate('/login');
    }
  };

  const handleRegisterClick = () => {
    setMobileMenuOpen(false);
    if (onNavigateToRegister) {
      onNavigateToRegister();
    } else {
      navigate('/register');
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white shadow-2xs group-hover:scale-105 transition-transform">
            <Ticket className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[#111827]">
            Ticketification
          </span>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
          <Link to="/explore" className="hover:text-stone-950 transition-colors">
            Explore Events
          </Link>
          <button
            type="button"
            onClick={() => handleAnchorClick('how-it-works')}
            className="hover:text-stone-950 transition-colors cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleAnchorClick('credentials')}
            className="hover:text-stone-950 transition-colors cursor-pointer"
          >
            Smart Passes
          </button>
          <button
            type="button"
            onClick={() => handleAnchorClick('trust')}
            className="hover:text-stone-950 transition-colors cursor-pointer"
          >
            Trust & Security
          </button>
          <Link to="/pricing" className="hover:text-stone-950 transition-colors">
            Pricing
          </Link>
          <Link to="/wallet" className="hover:text-stone-950 transition-colors">
            Pass Wallet
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link
                to="/wallet"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200/80 transition-colors"
              >
                My Passes
              </Link>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-black shadow-sm transition-all cursor-pointer"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLoginClick}
                className="px-3.5 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={handleRegisterClick}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-stone-900 text-white hover:bg-black shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Hamburger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-stone-600 hover:text-stone-900 focus:outline-none cursor-pointer"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-6 py-4 bg-white border-b border-stone-200 space-y-3">
          <Link
            to="/explore"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            Explore Events
          </Link>
          <button
            type="button"
            onClick={() => handleAnchorClick('how-it-works')}
            className="block w-full text-left text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => handleAnchorClick('credentials')}
            className="block w-full text-left text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            Smart Passes
          </button>
          <button
            type="button"
            onClick={() => handleAnchorClick('trust')}
            className="block w-full text-left text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            Trust & Security
          </button>
          <Link
            to="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            Pricing & Plans
          </Link>
          <Link
            to="/wallet"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-stone-700 hover:text-stone-950 py-1"
          >
            Pass Wallet
          </Link>
          <div className="pt-3 border-t border-stone-200 flex flex-col gap-2">
            {currentUser ? (
              <>
                <Link
                  to="/wallet"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center text-sm font-semibold bg-stone-100 text-stone-800 py-2.5 rounded-lg"
                >
                  My Passes
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/events');
                  }}
                  className="w-full text-center text-sm font-semibold bg-stone-900 text-white py-2.5 rounded-lg shadow-sm"
                >
                  Dashboard
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className="w-full text-left text-sm font-medium text-stone-700 py-2"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={handleRegisterClick}
                  className="w-full text-center text-sm font-semibold bg-stone-900 text-white py-2.5 rounded-lg shadow-sm"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
