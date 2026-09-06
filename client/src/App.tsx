import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { GuestImport } from './pages/GuestImport';
import { TicketList } from './pages/TicketList';
import { ScannerPage } from './pages/ScannerPage';
import { apiClient } from './api/client';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [user, setUser] = useState<{ name: string; email: string; eventName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res: any = await apiClient.get('/auth/me');
          if (res.success && res.data) {
            setUser(res.data);
          } else {
            handleLogout();
          }
        } catch (err) {
          handleLogout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const handleLoginSuccess = (newToken: string, userData: { name: string; email: string; eventName?: string }) => {
    localStorage.setItem('admin_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  const handleNavigateToRegister = () => {
    setAuthView('register');
  };

  const handleNavigateToLogin = () => {
    setAuthView('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center text-xs font-semibold text-surface-muted">
        Initializing Operational Console...
      </div>
    );
  }

  if (!token || !user) {
    if (authView === 'register') {
      return (
        <Register
          onRegisterSuccess={handleLoginSuccess}
          onNavigateToLogin={handleNavigateToLogin}
        />
      );
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={handleNavigateToRegister}
      />
    );
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<GuestImport />} />
          <Route path="/tickets" element={<TicketList />} />
          <Route path="/scan" element={<ScannerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
