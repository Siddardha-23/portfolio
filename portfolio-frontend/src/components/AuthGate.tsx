import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

interface NewsStory {
  title: string;
  url: string;
  by: string;
  score: number;
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

const FALLBACK_NEWS: NewsStory[] = [
  { title: 'OpenAI Announces GPT-5 with Unprecedented Reasoning Capabilities', url: '#', by: 'techcrunch', score: 1842 },
  { title: 'Rust 2.0 Released: Major Improvements to Async and Error Handling', url: '#', by: 'rustlang', score: 1523 },
  { title: 'GitHub Copilot Now Supports Full Repository Context Understanding', url: '#', by: 'natfriedman', score: 1391 },
  { title: 'Docker Announces Native WebAssembly Support in Containers', url: '#', by: 'solomonstre', score: 1205 },
  { title: 'TypeScript 6.0 Brings Pattern Matching and Pipe Operator', url: '#', by: 'typescript', score: 1147 },
  { title: 'AWS Lambda Now Supports 10GB Memory and 15-Minute Timeouts', url: '#', by: 'jeffbarr', score: 998 },
  { title: 'React Server Components Achieve 90% Adoption Among Top 1000 Sites', url: '#', by: 'dan_abramov', score: 876 },
  { title: 'Linux Kernel 7.0 Released with Major Performance Improvements', url: '#', by: 'torvalds', score: 812 },
  { title: 'Deno 4.0 Achieves Full Node.js Compatibility', url: '#', by: 'ry', score: 745 },
  { title: 'PostgreSQL 18 Introduces Native Vector Search for AI Workloads', url: '#', by: 'pgfoundation', score: 689 },
];

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { level: 3, label: 'Medium', color: 'bg-yellow-500' };
  if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-green-500' };
  return { level: 5, label: 'Very Strong', color: 'bg-emerald-400' };
}

// SVG icon components
function EnvelopeIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// Typing effect hook
function useTypingEffect(text: string, speed: number = 80) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return displayed;
}

// News board component — fixed-height container with internal scroll only
function TechNewsBoard({ stories }: { stories: NewsStory[] }) {
  const [paused, setPaused] = useState(false);
  const doubled = [...stories, ...stories];

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: 'calc(100vh - 120px)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex flex-col"
        style={{
          animation: paused ? 'none' : 'ticker 60s linear infinite',
        }}
      >
        {doubled.map((story, i) => (
          <a
            key={`${story.title}-${i}`}
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block px-5 py-3.5 border-b border-pink-500/10 hover:bg-pink-500/5 transition-colors duration-200"
          >
            <p className="text-sm text-gray-300 group-hover:text-pink-300 transition-colors leading-snug line-clamp-2">
              {story.title}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-gray-500">by {story.by}</span>
              <span className="flex items-center gap-0.5 text-xs text-pink-400/70">
                <ArrowUpIcon />
                {story.score}
              </span>
            </div>
          </a>
        ))}
      </div>
      {/* Fade edges */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-gray-950 to-transparent z-10" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-950 to-transparent z-10" />
    </div>
  );
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
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [news, setNews] = useState<NewsStory[]>(FALLBACK_NEWS);

  // Real-time password validation + dodging button
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null); // null = not checked yet
  const [dodgeCount, setDodgeCount] = useState(0);
  const [dodgeOffset, setDodgeOffset] = useState({ x: 0, y: 0 });
  const maxDodges = 5;
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typing effect
  const typedTitle = useTypingEffect(title || 'Welcome', 80);

  // Fetch tech news
  useEffect(() => {
    const fetchTechNews = async () => {
      try {
        const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = await idsResp.json();
        const top10 = ids.slice(0, 10);
        const stories = await Promise.all(
          top10.map((id: number) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
          )
        );
        const parsed = stories
          .filter((s: any) => s && s.title)
          .map((s: any) => ({ title: s.title, url: s.url || '#', by: s.by || 'unknown', score: s.score || 0 }));
        if (parsed.length > 0) setNews(parsed);
      } catch {
        // Keep fallback news
      }
    };
    fetchTechNews();
  }, []);

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

  // Real-time password validation — auto-login on correct password
  useEffect(() => {
    // Reset dodge on every keystroke
    setDodgeCount(0);
    setDodgeOffset({ x: 0, y: 0 });

    if (activeTab !== 'login' || !email || !password || password.length < 1) {
      setPasswordValid(null);
      return;
    }

    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(async () => {
      try {
        const resp = await apiService.validatePassword(email, password);
        if (!resp.data) return;

        if (resp.data.valid) {
          // Password correct → auto-login immediately
          setPasswordValid(true);
          setSubmitting(true);
          const sessionId = sessionStorage.getItem('portfolio_session_id') || undefined;
          const fingerprint = localStorage.getItem('portfolio_fingerprint_hash') || undefined;
          const result = await login(email, password, sessionId, fingerprint);
          setSubmitting(false);
          if (result.error) {
            setError(result.error);
            setPasswordValid(null);
          }
          // If login succeeds, isAuthenticated will become true and children render
        } else {
          setPasswordValid(false);
        }
      } catch {
        setPasswordValid(null);
      }
    }, 300); // 300ms debounce — fast feedback

    return () => {
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, [password, email, activeTab, login]);

  // Dodging button: dances when password is wrong, stays put when correct or unknown
  const handleButtonHover = useCallback(() => {
    if (passwordValid !== false || dodgeCount >= maxDodges) return;
    const x = (Math.random() - 0.5) * 240;
    const y = (Math.random() - 0.5) * 100;
    setDodgeOffset({ x, y });
    setDodgeCount(prev => prev + 1);
  }, [passwordValid, dodgeCount]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" />
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
    } else {
      // Registration successful — switch to login tab
      setSuccessMsg('Account created! Please log in with your credentials.');
      setError('');
      setConfirmPassword('');
      setRole('');
      setSector('');
      setActiveTab('login');
    }
  };

  const passwordStrength = getPasswordStrength(password);

  const inputWrapperClasses = 'relative flex items-center';
  const inputClasses =
    'w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700/80 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200';
  const inputWithToggleClasses =
    'w-full pl-10 pr-10 py-2.5 bg-gray-800/80 border border-gray-700/80 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200';
  const selectClasses =
    'w-full pl-4 pr-10 py-2.5 bg-gray-800/80 border border-gray-700/80 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all duration-200 appearance-none cursor-pointer';
  const labelClasses = 'block text-sm font-medium text-gray-300 mb-1.5';

  const dodgeButtonText = passwordValid === false
    ? dodgeCount >= maxDodges
      ? 'Fine, try again...'
      : 'Login'
    : 'Login';

  return (
    <div
      className={`min-h-screen bg-gray-950 transition-opacity duration-700 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* CSS for ticker animation and sparkles */}
      <style>{`
        @keyframes ticker {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes sparkle-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
          25% { transform: translateY(-15px) rotate(90deg); opacity: 0.8; }
          50% { transform: translateY(-5px) rotate(180deg); opacity: 0.4; }
          75% { transform: translateY(-20px) rotate(270deg); opacity: 0.9; }
        }
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(236, 72, 153, 0.1); }
          50% { box-shadow: 0 0 40px rgba(236, 72, 153, 0.2); }
        }
        .gradient-border {
          background: linear-gradient(135deg, #ec4899, #8b5cf6, #ec4899);
          background-size: 200% 200%;
          animation: gradient-rotate 4s ease infinite;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      {/* Sparkle particles (CSS only) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-pink-400"
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `sparkle-float ${3 + i * 0.7}s ease-in-out ${i * 0.5}s infinite`,
              opacity: 0.3,
            }}
          />
        ))}
        {[...Array(5)].map((_, i) => (
          <div
            key={`p2-${i}`}
            className="absolute w-0.5 h-0.5 rounded-full bg-purple-400"
            style={{
              left: `${5 + i * 20}%`,
              top: `${40 + (i % 2) * 30}%`,
              animation: `sparkle-float ${4 + i * 0.5}s ease-in-out ${i * 0.8}s infinite`,
              opacity: 0.2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left Side: Tech News Board — fixed height, internal scroll only */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] flex-col h-screen sticky top-0 bg-gray-950 border-r border-pink-500/10">
          {/* News header */}
          <div className="shrink-0 px-6 py-5 border-b border-pink-500/10">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-pink-500/10">
                <span className="text-pink-400"><ZapIcon /></span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Tech Pulse</h2>
                <p className="text-xs text-gray-500">Live from Hacker News</p>
              </div>
            </div>
          </div>

          {/* News board — scrolls only inside this box */}
          <TechNewsBoard stories={news} />

          {/* Footer */}
          <div className="shrink-0 px-6 py-3 border-t border-pink-500/10">
            <p className="text-[10px] text-gray-600 text-center">
              Powered by Hacker News API
            </p>
          </div>
        </div>

        {/* Right Side: Auth Form — always centered in viewport */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 min-h-screen">
          <div className="w-full max-w-md">
            {/* Title with typing effect */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                {typedTitle}
                <span className="inline-block w-0.5 h-7 bg-pink-400 ml-1 animate-pulse align-middle" />
              </h1>
              {description && (
                <p className="mt-3 text-gray-400 text-sm leading-relaxed">{description}</p>
              )}
            </div>

            {/* Auth card with animated gradient border */}
            <div className="relative rounded-2xl p-[1px] gradient-border" style={{ animation: 'pulse-glow 3s ease-in-out infinite, gradient-rotate 4s ease infinite' }}>
              <div className="bg-gray-900 rounded-2xl p-6 sm:p-8">
                {/* Welcome back banner */}
                {welcomeBack && activeTab === 'login' && (
                  <div className="mb-5 px-4 py-3 bg-pink-900/20 border border-pink-500/20 rounded-lg text-center">
                    <p className="text-pink-300 text-sm">
                      Welcome back! <span className="font-medium text-pink-200">{welcomeBack}</span>
                    </p>
                  </div>
                )}

                {/* Pill tabs */}
                <div className="flex mb-6 bg-gray-800/60 rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setError(''); setSuccessMsg('');
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                      activeTab === 'login'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('register');
                      setError(''); setSuccessMsg('');
                    }}
                    className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                      activeTab === 'register'
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Success banner */}
                {successMsg && (
                  <div className="mb-5 px-4 py-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex items-start gap-2">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-emerald-300 text-sm">{successMsg}</p>
                  </div>
                )}

                {/* Error banner */}
                {error && (
                  <div className="mb-5 px-4 py-3 bg-pink-900/20 border border-pink-500/30 rounded-lg flex items-start gap-2">
                    <svg className="w-4 h-4 text-pink-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-pink-300 text-sm">{error}</p>
                  </div>
                )}

                {/* Login Form */}
                {activeTab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className={labelClasses}>Email</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><EnvelopeIcon /></span>
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
                    </div>
                    <div>
                      <label htmlFor="login-password" className={labelClasses}>Password</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><LockIcon /></span>
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className={inputWithToggleClasses}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {/* Real-time validation indicator */}
                      {password.length >= 1 && passwordValid !== null && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {passwordValid ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                              <span className="text-xs text-emerald-400">Password correct — logging you in...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-pink-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              <span className="text-xs text-pink-400">Incorrect password</span>
                            </>
                          )}
                        </div>
                      )}
                      {submitting && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-pink-400 border-t-transparent" />
                          <span className="text-xs text-pink-300">Signing you in...</span>
                        </div>
                      )}
                    </div>

                    {/* Dancing login button — dodges on hover when password is wrong */}
                    <div className="relative overflow-hidden" style={{ height: '52px' }}>
                      <button
                        type="submit"
                        disabled={submitting || passwordValid === true}
                        onMouseEnter={handleButtonHover}
                        onTouchStart={handleButtonHover}
                        className={`absolute inset-x-0 py-2.5 font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                          passwordValid === true
                            ? 'bg-emerald-500 text-white cursor-default shadow-lg shadow-emerald-500/20'
                            : passwordValid === false
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20 cursor-not-allowed'
                              : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'
                        }`}
                        style={{
                          transform: `translate(${dodgeOffset.x}px, ${dodgeOffset.y}px)`,
                          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      >
                        {submitting ? (
                          <>
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Signing in...
                          </>
                        ) : passwordValid === true ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            Welcome!
                          </>
                        ) : (
                          dodgeButtonText
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Register Form */}
                {activeTab === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label htmlFor="reg-email" className={labelClasses}>Email</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><EnvelopeIcon /></span>
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
                    </div>
                    <div>
                      <label htmlFor="reg-password" className={labelClasses}>Password</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><LockIcon /></span>
                        <input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className={inputWithToggleClasses}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {/* Password strength indicator */}
                      {password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                  level <= passwordStrength.level
                                    ? passwordStrength.color
                                    : 'bg-gray-700'
                                }`}
                              />
                            ))}
                          </div>
                          <p className={`text-xs mt-1 ${
                            passwordStrength.level <= 1 ? 'text-red-400' :
                            passwordStrength.level <= 2 ? 'text-orange-400' :
                            passwordStrength.level <= 3 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor="reg-confirm" className={labelClasses}>Confirm Password</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><LockIcon /></span>
                        <input
                          id="reg-confirm"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your password"
                          className={inputWithToggleClasses}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-role" className={labelClasses}>
                        Role <span className="text-gray-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <select
                          id="reg-role"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className={selectClasses}
                        >
                          <option value="">Select a role</option>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2"><ChevronDownIcon /></span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-sector" className={labelClasses}>
                        Sector <span className="text-gray-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <select
                          id="reg-sector"
                          value={sector}
                          onChange={(e) => setSector(e.target.value)}
                          className={selectClasses}
                        >
                          <option value="">Select a sector</option>
                          {SECTOR_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2"><ChevronDownIcon /></span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-pink-800 disabled:to-purple-900 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30"
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

            {/* Mobile news teaser */}
            <div className="mt-6 lg:hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-pink-400"><ZapIcon /></span>
                <h3 className="text-sm font-semibold text-gray-400">Tech Pulse</h3>
              </div>
              <div className="space-y-2">
                {news.slice(0, 3).map((story, i) => (
                  <a
                    key={i}
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2 bg-gray-900/50 border border-pink-500/10 rounded-lg hover:bg-pink-500/5 transition-colors"
                  >
                    <p className="text-xs text-gray-400 leading-snug line-clamp-2">{story.title}</p>
                    <span className="flex items-center gap-0.5 text-[10px] text-pink-400/60 mt-1">
                      <ArrowUpIcon /> {story.score}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
