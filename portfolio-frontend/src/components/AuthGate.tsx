import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const ROLE_OPTIONS = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'Designer',
  'DevOps Engineer',
  'Student',
  'Other',
];

const SECTOR_OPTIONS = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Government',
  'Consulting',
  'Other',
];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

export default function AuthGate({ children, title, description }: AuthGateProps) {
  const { isAuthenticated, isLoading, login, register, checkUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [sector, setSector] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  // Returning user detection
  useEffect(() => {
    if (isAuthenticated) return;
    const fingerprint = localStorage.getItem('portfolio_fingerprint_hash');
    if (!fingerprint) return;

    checkUser(fingerprint).then((result) => {
      if (result?.exists && result.email) {
        setActiveTab('login');
        setWelcomeBack(maskEmail(result.email));
      }
    });
  }, [isAuthenticated, checkUser]);

  // Trigger fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    const sessionId = sessionStorage.getItem('portfolio_session_id') || undefined;
    const fingerprint = localStorage.getItem('portfolio_fingerprint_hash') || undefined;
    const result = await login(email, password, sessionId, fingerprint);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    const sessionId = sessionStorage.getItem('portfolio_session_id') || undefined;
    const fingerprint = localStorage.getItem('portfolio_fingerprint_hash') || undefined;
    const result = await register(
      email,
      password,
      role || undefined,
      sector || undefined,
      sessionId,
      fingerprint
    );
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const inputClasses =
    'w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';
  const selectClasses =
    'w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors appearance-none';

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-gray-950 px-4 transition-opacity duration-500 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        {title && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {description && <p className="mt-2 text-gray-400 text-sm">{description}</p>}
          </div>
        )}

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-6">
          {/* Welcome back */}
          {welcomeBack && activeTab === 'login' && (
            <div className="mb-4 px-4 py-3 bg-blue-900/30 border border-blue-800/50 rounded-lg text-center">
              <p className="text-blue-300 text-sm">
                Welcome back! <span className="font-medium text-blue-200">{welcomeBack}</span>
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex mb-6 bg-gray-800/50 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'login'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError('');
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'register'
                  ? 'bg-gray-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Register
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-800/50 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={inputClasses}
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClasses}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className={inputClasses}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className={inputClasses}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="reg-role" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Role <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  id="reg-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select a role</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-sector" className="block text-sm font-medium text-gray-300 mb-1.5">
                  Sector <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  id="reg-sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select a sector</option>
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
