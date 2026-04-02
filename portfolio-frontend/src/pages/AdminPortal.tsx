import { useState, useEffect, useCallback, FormEvent, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

const SUPER_ADMIN_EMAIL = 'mannesiddardha@gmail.com';

type Tab = 'dashboard' | 'users' | 'resumes' | 'tailoring';

interface AdminStats {
  total_users: number;
  users_7d: number;
  users_30d: number;
  total_parsed_resumes: number;
  total_base_resumes: number;
  total_generated_resumes: number;
  total_tailoring_sessions: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  sector: string | null;
  created_at: string | null;
  last_login: string | null;
  last_login_ip: string | null;
  login_attempts: number;
  base_resumes: number;
  generated_resumes: number;
  tailoring_sessions: number;
  has_parsed_resume: boolean;
}

interface UserDetail {
  user: AdminUser & { fingerprint_hash: string | null; session_id: string | null };
  parsed_resume: any;
  base_resumes: any[];
  generated_resumes: any[];
  tailoring_records: any[];
}

interface Activity {
  type: string;
  email: string;
  name?: string;
  detail?: string;
  company?: string;
  ats_score?: number;
  timestamp: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelative(iso: string | null) {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────

function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconDocument({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function IconBolt({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function IconUpload({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IconChart({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function IconLogout({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function IconArrowLeft({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function IconEye({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function IconSearch({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function IconRefresh({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'indigo',
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet';
}) {
  const colorMap = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
    rose: 'from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20 text-cyan-400',
    violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400',
  };
  const iconBg = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    rose: 'bg-rose-500/10 text-rose-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
    violet: 'bg-violet-500/10 text-violet-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color]} p-5 transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{label}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Activity Item ────────────────────────────────────────────────

function ActivityItem({ activity }: { activity: Activity }) {
  const config: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    registration: { icon: <IconUsers className="w-3.5 h-3.5" />, label: 'Registered', color: 'text-emerald-400 bg-emerald-500/10' },
    login: { icon: <IconArrowLeft className="w-3.5 h-3.5 rotate-180" />, label: 'Signed in', color: 'text-blue-400 bg-blue-500/10' },
    upload: { icon: <IconUpload className="w-3.5 h-3.5" />, label: 'Uploaded resume', color: 'text-amber-400 bg-amber-500/10' },
    tailoring: { icon: <IconBolt className="w-3.5 h-3.5" />, label: 'Tailored resume', color: 'text-violet-400 bg-violet-500/10' },
  };
  const c = config[activity.type] || config.login;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className={`flex-shrink-0 rounded-lg p-2 ${c.color}`}>
        {c.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">
          <span className="font-medium text-white">{activity.name || activity.email.split('@')[0]}</span>
          {' '}<span className="text-gray-500">{c.label}</span>
          {activity.detail && (
            <span className="text-gray-400"> &mdash; {activity.detail}</span>
          )}
          {activity.company && (
            <span className="text-gray-500"> at {activity.company}</span>
          )}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">{activity.email}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {activity.ats_score != null && (
          <span className={`text-xs font-semibold tabular-nums mr-3 ${
            activity.ats_score >= 80 ? 'text-emerald-400' :
            activity.ats_score >= 60 ? 'text-amber-400' : 'text-red-400'
          }`}>
            ATS {activity.ats_score}
          </span>
        )}
        <span className="text-xs text-gray-600">{formatRelative(activity.timestamp)}</span>
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────────────

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  return (
    <div className="flex justify-center py-12">
      <div className={`animate-spin ${s} border-2 border-indigo-500 border-t-transparent rounded-full`} />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-white/[0.03] p-6 mb-4">
        <IconDocument className="w-10 h-10 text-gray-600" />
      </div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════

export default function AdminPortal() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [tailoring, setTailoring] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const isSuperAdmin = isAuthenticated && user?.email === SUPER_ADMIN_EMAIL;

  const fetchStats = useCallback(async () => {
    const res = await apiService.getAdminStats();
    if (res.data?.total_users != null) setStats(res.data);
    else if (res.error) setError(res.error);
  }, []);

  const fetchActivity = useCallback(async () => {
    const res = await apiService.getAdminActivity();
    if (res.data?.activities) setActivities(res.data.activities);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminUsers();
    if (res.data?.users) setUsers(res.data.users);
    else if (res.error) setError(res.error);
    setLoading(false);
  }, []);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminResumes();
    if (res.data?.resumes) setResumes(res.data.resumes);
    else if (res.error) setError(res.error);
    setLoading(false);
  }, []);

  const fetchTailoring = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminTailoring();
    if (res.data?.records) setTailoring(res.data.records);
    else if (res.error) setError(res.error);
    setLoading(false);
  }, []);

  const fetchUserDetail = useCallback(async (email: string) => {
    setLoading(true);
    const res = await apiService.getAdminUserDetail(email);
    if (res.data?.user) setSelectedUser(res.data as UserDetail);
    else if (res.error) setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchStats();
    fetchActivity();
  }, [isSuperAdmin, fetchStats, fetchActivity]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (tab === 'users') fetchUsers();
    else if (tab === 'resumes') fetchResumes();
    else if (tab === 'tailoring') fetchTailoring();
  }, [tab, isSuperAdmin, fetchUsers, fetchResumes, fetchTailoring]);

  const handleSignOut = () => {
    logout();
    navigate('/home');
  };

  const handleRefresh = () => {
    setError('');
    if (tab === 'dashboard') { fetchStats(); fetchActivity(); }
    else if (tab === 'users') fetchUsers();
    else if (tab === 'resumes') fetchResumes();
    else if (tab === 'tailoring') fetchTailoring();
  };

  // Auth guards
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated) return <AdminLoginForm />;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-7xl font-bold bg-gradient-to-b from-gray-400 to-gray-700 bg-clip-text text-transparent">403</div>
          <p className="text-gray-400">You are not authorized to access this page.</p>
          <button onClick={() => navigate('/home')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = searchQuery
    ? (users || []).filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (users || []);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Overview', icon: <IconChart className="w-4 h-4" /> },
    { key: 'users', label: 'Users', icon: <IconUsers className="w-4 h-4" /> },
    { key: 'resumes', label: 'Parsed Resumes', icon: <IconDocument className="w-4 h-4" /> },
    { key: 'tailoring', label: 'Tailoring', icon: <IconBolt className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/home')} className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
              <IconArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <IconChart className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold leading-tight">Admin Dashboard</h1>
                <p className="text-[10px] text-gray-500 leading-tight">Super Admin Portal</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh data"
            >
              <IconRefresh className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-white/10" />

            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-bold">
                {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-gray-300 leading-tight">{user?.name || 'Super Admin'}</p>
                <p className="text-[10px] text-gray-600 leading-tight">{user?.email}</p>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSignOutConfirm(!showSignOutConfirm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Sign Out"
              >
                <IconLogout className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {showSignOutConfirm && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSignOutConfirm(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-[#16161e] border border-white/10 rounded-xl shadow-2xl shadow-black/40 p-4 z-50">
                    <p className="text-sm text-gray-300 mb-3">Are you sure you want to sign out?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSignOutConfirm(false)}
                        className="flex-1 px-3 py-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex-1 px-3 py-2 text-xs text-white bg-red-600 hover:bg-red-500 rounded-lg transition font-medium"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─────────────────────────────────── */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedUser(null); setError(''); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/10'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400 transition text-xs ml-3">Dismiss</button>
          </div>
        )}

        {/* ──── Dashboard Tab ──── */}
        {tab === 'dashboard' && (
          <>
            {!stats ? <Spinner /> : (
              <div className="space-y-8">
                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={stats.total_users} sub={`+${stats.users_7d} this week`} icon={<IconUsers />} color="indigo" />
                  <StatCard label="Parsed Resumes" value={stats.total_parsed_resumes} icon={<IconDocument />} color="emerald" />
                  <StatCard label="Base Uploads" value={stats.total_base_resumes} icon={<IconUpload />} color="amber" />
                  <StatCard label="Tailoring Sessions" value={stats.total_tailoring_sessions} icon={<IconBolt />} color="violet" />
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard label="Users (30 days)" value={stats.users_30d} sub="New registrations" icon={<IconUsers className="w-5 h-5" />} color="cyan" />
                  <StatCard label="Generated Resumes" value={stats.total_generated_resumes} sub="PDF/DOCX downloads" icon={<IconDocument className="w-5 h-5" />} color="rose" />
                  <StatCard
                    label="Parse Rate"
                    value={stats.total_users > 0 ? `${Math.round((stats.total_parsed_resumes / stats.total_users) * 100)}%` : '0%'}
                    sub="Users with parsed resumes"
                    icon={<IconChart className="w-5 h-5" />}
                    color="emerald"
                  />
                </div>

                {/* Activity Feed */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                    <span className="text-xs text-gray-600">Last 30 days</span>
                  </div>
                  <div className="px-5 divide-y divide-white/5 max-h-[420px] overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-sm text-gray-600 py-8 text-center">No recent activity</p>
                    ) : (
                      activities.map((a, i) => <ActivityItem key={i} activity={a} />)
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ──── Users Tab ──── */}
        {tab === 'users' && !selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by email, name, or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">{filteredUsers.length} users</span>
            </div>

            {loading ? <Spinner /> : filteredUsers.length === 0 ? (
              <EmptyState message="No users found" />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Registered</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Last Active</th>
                      <th className="text-center px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Resumes</th>
                      <th className="text-center px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Tailored</th>
                      <th className="text-center px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Parsed</th>
                      <th className="px-4 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400 flex-shrink-0">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-white font-medium leading-tight">{u.name || '\u2014'}</p>
                              <p className="text-[11px] text-gray-500 font-mono leading-tight">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {u.role ? (
                            <span className="px-2 py-1 text-[10px] bg-white/5 text-gray-400 rounded-md">{u.role}</span>
                          ) : (
                            <span className="text-gray-700 text-xs">\u2014</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{formatRelative(u.created_at)}</td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{formatRelative(u.last_login)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-xs font-medium tabular-nums bg-white/5 rounded-md text-gray-400">
                            {u.base_resumes}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-xs font-medium tabular-nums bg-white/5 rounded-md text-gray-400">
                            {u.tailoring_sessions}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {u.has_parsed_resume ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 rounded-full font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/5 text-gray-600 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => fetchUserDetail(u.email)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 rounded-lg transition-all font-medium opacity-70 group-hover:opacity-100"
                          >
                            <IconEye />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* User Detail View */}
        {tab === 'users' && selectedUser && (
          <UserDetailView detail={selectedUser} onBack={() => setSelectedUser(null)} />
        )}

        {/* ──── Resumes Tab ──── */}
        {tab === 'resumes' && (
          <>
            {loading ? <Spinner /> : !resumes || resumes.length === 0 ? (
              <EmptyState message="No parsed resumes yet" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {resumes.map((r, i) => (
                  <ResumeCard key={i} resume={r} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ──── Tailoring Tab ──── */}
        {tab === 'tailoring' && (
          <>
            {loading ? <Spinner /> : !tailoring || tailoring.length === 0 ? (
              <EmptyState message="No tailoring sessions yet" />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Job Title</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Company</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Created</th>
                      <th className="text-center px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">ATS Score</th>
                      <th className="text-left px-4 py-3.5 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Base File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tailoring.map((r, i) => (
                      <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-300">{r.user_email}</td>
                        <td className="px-4 py-3.5 text-gray-300 text-xs font-medium">{r.jd_analysis?.job_title || '\u2014'}</td>
                        <td className="px-4 py-3.5 text-gray-400 text-xs">{r.jd_analysis?.company || '\u2014'}</td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">{formatRelative(r.created_at)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {r.ats_scores?.overall != null ? (
                            <span className={`inline-flex items-center justify-center h-7 w-12 rounded-lg text-xs font-bold tabular-nums ${
                              r.ats_scores.overall >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                              r.ats_scores.overall >= 60 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-red-500/15 text-red-400'
                            }`}>
                              {r.ats_scores.overall}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-700">\u2014</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs truncate max-w-[180px]">
                          {r.base_resume_filename || '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Resume Card ──────────────────────────────────────────────────

function ResumeCard({ resume: r }: { resume: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all hover:border-white/10">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 flex-shrink-0">
              {(r.contact?.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{r.contact?.name || 'Unknown'}</p>
              <p className="text-[11px] text-gray-500">{r.user_email}</p>
            </div>
          </div>
          <span className="text-[10px] text-gray-600 whitespace-nowrap">{formatRelative(r.parsed_at)}</span>
        </div>

        {r.contact?.email && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
            {r.contact.email && <span>{r.contact.email}</span>}
            {r.contact.phone && <span>{r.contact.phone}</span>}
            {r.contact.linkedin && <span className="text-indigo-400/70">{r.contact.linkedin}</span>}
          </div>
        )}

        {r.summary && <p className="text-xs text-gray-500 line-clamp-2">{r.summary}</p>}

        {r.skills && Object.keys(r.skills).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.keys(r.skills).slice(0, 8).map(s => (
              <span key={s} className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 rounded-full">{s}</span>
            ))}
            {Object.keys(r.skills).length > 8 && (
              <span className="px-2 py-0.5 text-[10px] bg-white/5 text-gray-500 rounded-full">+{Object.keys(r.skills).length - 8}</span>
            )}
          </div>
        )}

        {r.experience && r.experience.length > 0 && (
          <p className="text-[11px] text-gray-500">
            {r.experience.length} role{r.experience.length > 1 ? 's' : ''}
            {r.experience[0]?.title && ` \u2014 ${r.experience[0].title}`}
            {r.experience[0]?.company && ` at ${r.experience[0].company}`}
          </p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 transition font-medium"
        >
          {expanded ? 'Show less' : 'Show full details'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 bg-white/[0.01] space-y-4 text-xs">
          {r.skills && Object.keys(r.skills).length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">Skills</p>
              <div className="space-y-2">
                {Object.entries(r.skills).map(([category, skills]) => (
                  <div key={category}>
                    <span className="text-gray-400 font-medium">{category}:</span>
                    <span className="text-gray-500 ml-1.5">{(skills as string[]).join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.experience?.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">Experience</p>
              <div className="space-y-2">
                {r.experience.map((exp: any, i: number) => (
                  <div key={i} className="border-l-2 border-white/10 pl-3 py-1">
                    <p className="text-gray-200 font-medium">{exp.title}</p>
                    <p className="text-gray-500">{exp.company} {exp.dates && `\u2022 ${exp.dates}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.education?.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">Education</p>
              {r.education.map((edu: any, i: number) => (
                <div key={i} className="py-1">
                  <p className="text-gray-300">{edu.degree}</p>
                  <p className="text-gray-500">{edu.institution} {edu.dates && `\u2022 ${edu.dates}`}</p>
                </div>
              ))}
            </div>
          )}

          {r.projects?.length > 0 && (
            <div>
              <p className="text-gray-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">Projects</p>
              {r.projects.map((p: any, i: number) => (
                <div key={i} className="py-1">
                  <p className="text-gray-300 font-medium">{p.name}</p>
                  {p.tech && <p className="text-gray-500">{p.tech}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── User Detail Sub-view ─────────────────────────────────────────

function UserDetailView({ detail, onBack }: { detail: UserDetail; onBack: () => void }) {
  const { user, parsed_resume, base_resumes = [], generated_resumes = [], tailoring_records = [] } = detail;
  const [activeSection, setActiveSection] = useState<'info' | 'parsed' | 'base' | 'generated' | 'tailoring'>('info');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerFilename, setViewerFilename] = useState<string>('');

  const getFileExt = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot !== -1 ? name.slice(dot + 1).toLowerCase() : '';
  };

  const handleViewResume = async (s3Key: string, filename?: string) => {
    setDownloadingKey(s3Key);
    setResumeError(null);
    const fname = filename || s3Key.split('/').pop() || 'resume.pdf';
    const ext = getFileExt(fname);
    try {
      // DOCX/DOC can't be previewed in browser — download instead
      if (ext === 'docx' || ext === 'doc') {
        const res = await apiService.getAdminResumeUrl(s3Key, 'attachment', fname);
        if (res.data?.url) {
          window.open(res.data.url, '_blank');
        } else {
          setResumeError(res.error || 'Failed to get resume URL');
        }
      } else {
        // PDF — show inline in modal
        const res = await apiService.getAdminResumeUrl(s3Key, 'inline', fname);
        if (res.data?.url) {
          setViewerUrl(res.data.url);
          setViewerFilename(fname);
        } else {
          setResumeError(res.error || 'Failed to get resume URL');
        }
      }
    } catch {
      setResumeError('Failed to get resume URL. Please try again.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleDownloadResume = async (s3Key: string, filename?: string) => {
    setDownloadingKey(s3Key);
    setResumeError(null);
    const fname = filename || s3Key.split('/').pop() || 'resume.pdf';
    try {
      const res = await apiService.getAdminResumeUrl(s3Key, 'attachment', fname);
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
      } else {
        setResumeError(res.error || 'Failed to get resume URL');
      }
    } catch {
      setResumeError('Failed to download resume. Please try again.');
    } finally {
      setDownloadingKey(null);
    }
  };

  const sections = useMemo(() => {
    const s = [
      { key: 'info' as const, label: 'Profile', count: null },
      { key: 'parsed' as const, label: 'Parsed Resume', count: parsed_resume ? 1 : 0 },
      { key: 'base' as const, label: 'Base Resumes', count: base_resumes.length },
      { key: 'generated' as const, label: 'Generated', count: generated_resumes.length },
      { key: 'tailoring' as const, label: 'Tailoring', count: tailoring_records.length },
    ];
    return s;
  }, [parsed_resume, base_resumes, generated_resumes, tailoring_records]);

  return (
    <div className="space-y-6">
      {/* Back & User Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <IconArrowLeft className="w-4 h-4" />
          Back to users
        </button>
      </div>

      {/* User Header Card */}
      <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.05] to-violet-500/[0.05] p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
            {(user.name || user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user.name || 'Unnamed User'}</h2>
            <p className="text-sm text-gray-400 font-mono">{user.email}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {user.role && <span className="px-2 py-0.5 text-[10px] bg-indigo-500/15 text-indigo-400 rounded-full font-medium">{user.role}</span>}
              {user.sector && <span className="px-2 py-0.5 text-[10px] bg-white/5 text-gray-400 rounded-full">{user.sector}</span>}
              <span className="text-[10px] text-gray-600">Joined {formatRelative(user.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.02] rounded-xl border border-white/[0.06] overflow-x-auto">
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
              activeSection === s.key
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {s.label}
            {s.count != null && s.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                activeSection === s.key ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
              }`}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Resume error banner */}
      {resumeError && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <span>{resumeError}</span>
          <button onClick={() => setResumeError(null)} className="text-red-400/60 hover:text-red-400 transition text-xs ml-3">Dismiss</button>
        </div>
      )}

      {/* ──── Profile Section ──── */}
      {activeSection === 'info' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">User Information</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { label: 'Email', value: user.email, mono: true },
              { label: 'Name', value: user.name },
              { label: 'Role', value: user.role },
              { label: 'Sector', value: user.sector },
              { label: 'Registered', value: formatDate(user.created_at) },
              { label: 'Last Login', value: formatDate(user.last_login) },
              { label: 'Last Login IP', value: user.last_login_ip, mono: true },
              { label: 'Login Attempts', value: String(user.login_attempts) },
              { label: 'Fingerprint', value: user.fingerprint_hash?.slice(0, 16), mono: true },
              { label: 'Session ID', value: user.session_id?.slice(0, 16), mono: true },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">{item.label}</p>
                <p className={`text-sm text-gray-300 ${item.mono ? 'font-mono text-xs' : ''}`}>
                  {item.value || '\u2014'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──── Parsed Resume Section ──── */}
      {activeSection === 'parsed' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Parsed Resume Data</h3>
          </div>
          {!parsed_resume ? (
            <div className="p-5">
              <EmptyState message="No parsed resume for this user" />
            </div>
          ) : (
            <div className="p-5 space-y-6 text-xs">
              {/* Contact */}
              {parsed_resume.contact && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center text-lg font-bold text-emerald-400">
                    {(parsed_resume.contact.name || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{parsed_resume.contact.name}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 mt-0.5">
                      {parsed_resume.contact.email && <span>{parsed_resume.contact.email}</span>}
                      {parsed_resume.contact.phone && <span>{parsed_resume.contact.phone}</span>}
                      {parsed_resume.contact.linkedin && <span className="text-indigo-400">{parsed_resume.contact.linkedin}</span>}
                      {parsed_resume.contact.github && <span className="text-gray-400">{parsed_resume.contact.github}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              {parsed_resume.summary && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Summary</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{parsed_resume.summary}</p>
                </div>
              )}

              {/* Skills */}
              {parsed_resume.skills && Object.keys(parsed_resume.skills).length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-3">Skills</p>
                  <div className="space-y-3">
                    {Object.entries(parsed_resume.skills).map(([category, skills]) => (
                      <div key={category}>
                        <p className="text-[11px] text-indigo-400 font-medium mb-1">{category}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(skills as string[]).map((skill: string, i: number) => (
                            <span key={i} className="px-2.5 py-1 text-[10px] bg-white/5 text-gray-300 rounded-lg border border-white/5">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {parsed_resume.experience?.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-3">Experience ({parsed_resume.experience.length})</p>
                  <div className="space-y-3">
                    {parsed_resume.experience.map((exp: any, i: number) => (
                      <div key={i} className="border-l-2 border-indigo-500/30 pl-4 py-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-white font-medium">{exp.title}</p>
                            <p className="text-[11px] text-gray-400">{exp.company} {exp.location && `\u2022 ${exp.location}`}</p>
                          </div>
                          {exp.dates && <span className="text-[10px] text-gray-600 whitespace-nowrap ml-3">{exp.dates}</span>}
                        </div>
                        {exp.bullets?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {exp.bullets.map((b: string, j: number) => (
                              <li key={j} className="text-[11px] text-gray-400 leading-relaxed flex gap-2">
                                <span className="text-gray-600 mt-0.5">\u2022</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {parsed_resume.education?.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-3">Education ({parsed_resume.education.length})</p>
                  <div className="space-y-2">
                    {parsed_resume.education.map((edu: any, i: number) => (
                      <div key={i} className="flex items-start justify-between py-2 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-sm text-white font-medium">{edu.degree}</p>
                          <p className="text-[11px] text-gray-400">{edu.institution} {edu.location && `\u2022 ${edu.location}`}</p>
                          {edu.gpa && <p className="text-[10px] text-gray-500 mt-0.5">GPA: {edu.gpa}</p>}
                        </div>
                        {edu.dates && <span className="text-[10px] text-gray-600 whitespace-nowrap ml-3">{edu.dates}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {parsed_resume.projects?.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-3">Projects ({parsed_resume.projects.length})</p>
                  <div className="space-y-3">
                    {parsed_resume.projects.map((p: any, i: number) => (
                      <div key={i} className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="flex items-start justify-between">
                          <p className="text-sm text-white font-medium">{p.name}</p>
                          {p.dates && <span className="text-[10px] text-gray-600 whitespace-nowrap ml-3">{p.dates}</span>}
                        </div>
                        {p.tech && <p className="text-[10px] text-indigo-400/70 mt-1">{p.tech}</p>}
                        {p.bullets?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {p.bullets.map((b: string, j: number) => (
                              <li key={j} className="text-[11px] text-gray-400 flex gap-2">
                                <span className="text-gray-600">\u2022</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-700 pt-2">Parsed at: {formatDate(parsed_resume.parsed_at)}</p>
            </div>
          )}
        </div>
      )}

      {/* ──── Base Resumes Section ──── */}
      {activeSection === 'base' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Base Resumes</h3>
            <span className="text-[10px] text-gray-600">{base_resumes.length} file{base_resumes.length !== 1 ? 's' : ''}</span>
          </div>
          {base_resumes.length === 0 ? (
            <div className="p-5"><EmptyState message="No base resumes uploaded" /></div>
          ) : (
            <div className="divide-y divide-white/5">
              {base_resumes.map((r: any, i: number) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <IconDocument className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white font-medium truncate">{r.filename}</p>
                        {r.is_active && (
                          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/15 text-emerald-400 rounded font-semibold uppercase tracking-wider flex-shrink-0">Active</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(0)} KB` : ''}{r.size_bytes ? ' \u2022 ' : ''}{formatRelative(r.uploaded_at)}
                      </p>
                    </div>
                  </div>
                  {r.s3_key && (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => handleViewResume(r.s3_key, r.filename)}
                        disabled={downloadingKey === r.s3_key}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 rounded-lg transition-all font-medium disabled:opacity-50"
                      >
                        {downloadingKey === r.s3_key ? (
                          <div className="h-3.5 w-3.5 animate-spin border border-current border-t-transparent rounded-full" />
                        ) : (
                          <IconEye className="w-3.5 h-3.5" />
                        )}
                        View
                      </button>
                      <button
                        onClick={() => handleDownloadResume(r.s3_key, r.filename)}
                        disabled={downloadingKey === r.s3_key}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all font-medium disabled:opacity-50"
                      >
                        <IconDownload className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── Generated Resumes Section ──── */}
      {activeSection === 'generated' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Generated Resumes</h3>
            <span className="text-[10px] text-gray-600">{generated_resumes.length} file{generated_resumes.length !== 1 ? 's' : ''}</span>
          </div>
          {generated_resumes.length === 0 ? (
            <div className="p-5"><EmptyState message="No generated resumes" /></div>
          ) : (
            <div className="divide-y divide-white/5">
              {generated_resumes.map((r: any, i: number) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <IconBolt className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{r.filename || r.job_title || 'Tailored Resume'}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.size_bytes ? `${(r.size_bytes / 1024).toFixed(0)} KB` : ''}{r.size_bytes ? ' \u2022 ' : ''}{formatRelative(r.generated_at)}
                      </p>
                    </div>
                  </div>
                  {r.s3_key && (
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <button
                        onClick={() => handleViewResume(r.s3_key, r.filename)}
                        disabled={downloadingKey === r.s3_key}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 rounded-lg transition-all font-medium disabled:opacity-50"
                      >
                        {downloadingKey === r.s3_key ? (
                          <div className="h-3.5 w-3.5 animate-spin border border-current border-t-transparent rounded-full" />
                        ) : (
                          <IconEye className="w-3.5 h-3.5" />
                        )}
                        View
                      </button>
                      <button
                        onClick={() => handleDownloadResume(r.s3_key, r.filename)}
                        disabled={downloadingKey === r.s3_key}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all font-medium disabled:opacity-50"
                      >
                        <IconDownload className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── Tailoring Records Section ──── */}
      {activeSection === 'tailoring' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Tailoring Sessions</h3>
            <span className="text-[10px] text-gray-600">{tailoring_records.length} session{tailoring_records.length !== 1 ? 's' : ''}</span>
          </div>
          {tailoring_records.length === 0 ? (
            <div className="p-5"><EmptyState message="No tailoring sessions" /></div>
          ) : (
            <div className="divide-y divide-white/5">
              {tailoring_records.map((r: any, i: number) => (
                <div key={i} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">
                        {r.jd_analysis?.job_title || 'Unknown Role'}
                      </p>
                      {r.jd_analysis?.company && (
                        <p className="text-[11px] text-gray-400 mt-0.5">at {r.jd_analysis.company}</p>
                      )}
                      {r.base_resume_filename && (
                        <p className="text-[10px] text-gray-600 mt-1">Base: {r.base_resume_filename}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {r.ats_scores?.overall != null && (
                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${
                          r.ats_scores.overall >= 80 ? 'bg-emerald-500/10' :
                          r.ats_scores.overall >= 60 ? 'bg-amber-500/10' : 'bg-red-500/10'
                        }`}>
                          <span className={`text-lg font-bold tabular-nums ${
                            r.ats_scores.overall >= 80 ? 'text-emerald-400' :
                            r.ats_scores.overall >= 60 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {r.ats_scores.overall}
                          </span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider">ATS</span>
                        </div>
                      )}
                      <span className="text-[10px] text-gray-600">{formatRelative(r.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── Inline Resume Viewer Modal ──── */}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="relative w-[95vw] h-[92vh] max-w-5xl bg-[#12121a] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
              <p className="text-sm text-white font-medium truncate">{viewerFilename}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.open(viewerUrl, '_blank');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all font-medium"
                >
                  Open in new tab
                </button>
                <button
                  onClick={() => { setViewerUrl(null); setViewerFilename(''); }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* PDF iframe */}
            <iframe
              src={viewerUrl}
              title="Resume viewer"
              className="flex-1 w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Login Form ────────────────────────────────────────────

function AdminLoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/20">
            <IconChart className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Portal</h1>
          <p className="text-sm text-gray-500 mt-1.5">Sign in with your admin credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-gray-400 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
