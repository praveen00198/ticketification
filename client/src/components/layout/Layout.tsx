import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Header } from './Header';
import { ChevronRight, ArrowLeft, Home, FileSpreadsheet, Ticket, QrCode } from 'lucide-react';

interface LayoutProps {
  user: { name: string; email: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getBreadcrumbs = () => {
    switch (location.pathname) {
      case '/import':
        return [
          { label: 'Dashboard', path: '/' },
          { label: 'Import Guest List', path: '/import', active: true, icon: FileSpreadsheet },
        ];
      case '/tickets':
        return [
          { label: 'Dashboard', path: '/' },
          { label: 'Issued Tickets Catalog', path: '/tickets', active: true, icon: Ticket },
        ];
      case '/scan':
        return [
          { label: 'Dashboard', path: '/' },
          { label: 'Event Day QR Scanner', path: '/scan', active: true, icon: QrCode },
        ];
      default:
        return [];
    }
  };

  const breadcrumbs = getBreadcrumbs();
  const isSubPage = location.pathname !== '/';

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg text-surface-charcoal">
      <Header user={user} onLogout={onLogout} />

      {/* Subpage Breadcrumb & Stage Navigation Bar */}
      {isSubPage && breadcrumbs.length > 0 && (
        <div className="bg-white border-b border-surface-border py-2.5 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <nav className="flex items-center gap-2 text-xs">
              <Link
                to="/"
                className="text-zinc-500 hover:text-surface-charcoal flex items-center gap-1 font-medium transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              {breadcrumbs.slice(1).map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-zinc-400" />
                  <span className="font-semibold text-brand-600 flex items-center gap-1">
                    {crumb.icon && <crumb.icon className="w-3.5 h-3.5" />}
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </nav>

            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-zinc-600 hover:text-surface-charcoal bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-surface-border py-4 text-center text-xs text-surface-muted">
        Operational Event Credential & Verification Console &bull; Ticketification 2026
      </footer>
    </div>
  );
};
