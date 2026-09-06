import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, QrCode, LayoutDashboard, FileSpreadsheet, LogOut, Menu, X, KeyRound } from 'lucide-react';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';

interface HeaderProps {
  user: { name: string; email: string } | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Import Guests', path: '/import', icon: FileSpreadsheet },
    { label: 'View Tickets', path: '/tickets', icon: Ticket },
  ];

  return (
    <>
      <header className="bg-surface-charcoal text-white border-b border-zinc-800 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-brand-600 p-2 rounded-full flex items-center justify-center text-white">
              <Ticket className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl tracking-wide">
              Ticketification<span className="text-brand-500">.</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-zinc-800 text-white font-bold border border-zinc-700 shadow-inner'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Action Button & Admin Info */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/scan')}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm flex items-center gap-2 border border-brand-500/30"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Scan & Verify</span>
              <span className="sm:hidden">Scan</span>
            </button>

            {user && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-zinc-800">
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-semibold text-zinc-200">{user.name}</div>
                  <div className="text-[10px] text-zinc-400">Administrator</div>
                </div>
                <button
                  onClick={() => setIsChangePasswordOpen(true)}
                  title="Change Password"
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-md"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-3 py-2.5 rounded-md text-sm font-medium flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-500' : ''}`} />
                  {item.label}
                </Link>
              );
            })}

            {user && (
              <div className="pt-2 mt-2 border-t border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{user.name}</div>
                  <div className="text-[10px] text-zinc-400">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="text-xs text-zinc-300 hover:text-white font-semibold flex items-center gap-1 py-1 px-2 rounded bg-zinc-800 border border-zinc-700"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Password
                  </button>
                  <button
                    onClick={onLogout}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 py-1 px-2 rounded bg-rose-950/40 border border-rose-900/50"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
};

