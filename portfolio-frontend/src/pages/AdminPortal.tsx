import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import AuthGate from '@/components/AuthGate';

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

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-white mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminPortal() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [tailoring, setTailoring] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isSuperAdmin = isAuthenticated && user?.email === SUPER_ADMIN_EMAIL;

  const fetchStats = useCallback(async () => {
    const res = await apiService.getAdminStats();
    if (res.data) setStats(res.data);
    else setError(res.error || 'Failed to load stats');
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminUsers();
    if (res.data) setUsers(res.data.users);
    else setError(res.error || 'Failed to load users');
    setLoading(false);
  }, []);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminResumes();
    if (res.data) setResumes(res.data.resumes);
    else setError(res.error || 'Failed to load resumes');
    setLoading(false);
  }, []);

  const fetchTailoring = useCallback(async () => {
    setLoading(true);
    const res = await apiService.getAdminTailoring();
    if (res.data) setTailoring(res.data.records);
    else setError(res.error || 'Failed to load tailoring records');
    setLoading(false);
  }, []);

  const fetchUserDetail = useCallback(async (email: string) => {
    setLoading(true);
    const res = await apiService.getAdminUserDetail(email);
    if (res.data) setSelectedUser(res.data as UserDetail);
    else setError(res.error || 'Failed to load user details');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchStats();
  }, [isSuperAdmin, fetchStats]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (tab === 'users') fetchUsers();
    else if (tab === 'resumes') fetchResumes();
    else if (tab === 'tailoring') fetchTailoring();
  }, [tab, isSuperAdmin, fetchUsers, fetchResumes, fetchTailoring]);

  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGate title="Admin Portal" description="Sign in with your admin account to continue.">
        <></>
      </AuthGate>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl">403</div>
          <p className="text-gray-400">You are not authorized to access this page.</p>
          <button onClick={() => navigate('/home')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const filteredUsers = searchQuery
    ? users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Users' },
    { key: 'resumes', label: 'Parsed Resumes' },
    { key: 'tailoring', label: 'Tailoring Sessions' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold">Super Admin Portal</h1>
            <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full uppercase tracking-wider font-medium">Admin</span>
          </div>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedUser(null); setError(''); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {/* Dashboard Tab */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.total_users} sub={`${stats.users_7d} this week`} />
              <StatCard label="Users (30d)" value={stats.users_30d} />
              <StatCard label="Parsed Resumes" value={stats.total_parsed_resumes} />
              <StatCard label="Base Uploads" value={stats.total_base_resumes} />
              <StatCard label="Generated Resumes" value={stats.total_generated_resumes} />
              <StatCard label="Tailoring Sessions" value={stats.total_tailoring_sessions} />
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && !selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by email, name, or role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
              />
              <span className="text-xs text-gray-500">{filteredUsers.length} users</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Email</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Name</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Role</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Registered</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Last Login</th>
                      <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium">Resumes</th>
                      <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium">Tailored</th>
                      <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium">Parsed</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                        <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3 text-gray-300">{u.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{u.role || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(u.last_login)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs tabular-nums">{u.base_resumes}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs tabular-nums">{u.tailoring_sessions}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.has_parsed_resume ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Has parsed resume" />
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-gray-600" title="No parsed resume" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => fetchUserDetail(u.email)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                          >
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

        {/* Resumes Tab */}
        {tab === 'resumes' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : resumes.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No parsed resumes yet.</p>
            ) : (
              <div className="space-y-3">
                {resumes.map((r, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-white">{r.contact?.name || 'Unknown'}</span>
                        <span className="ml-2 text-xs text-gray-500">{r.user_email}</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(r.parsed_at)}</span>
                    </div>
                    {r.contact?.email && (
                      <p className="text-xs text-gray-400">
                        {r.contact.email}
                        {r.contact.phone && ` | ${r.contact.phone}`}
                        {r.contact.linkedin && ` | ${r.contact.linkedin}`}
                      </p>
                    )}
                    {r.summary && (
                      <p className="text-xs text-gray-500 line-clamp-2">{r.summary}</p>
                    )}
                    {r.skills && Object.keys(r.skills).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {Object.keys(r.skills).slice(0, 10).map(s => (
                          <span key={s} className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 rounded-full">{s}</span>
                        ))}
                        {Object.keys(r.skills).length > 10 && (
                          <span className="px-2 py-0.5 text-[10px] bg-white/5 text-gray-500 rounded-full">
                            +{Object.keys(r.skills).length - 10} more
                          </span>
                        )}
                      </div>
                    )}
                    {r.experience && r.experience.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {r.experience.length} experience{r.experience.length > 1 ? 's' : ''}
                        {r.experience[0]?.title && ` — Latest: ${r.experience[0].title}`}
                        {r.experience[0]?.company && ` at ${r.experience[0].company}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tailoring Tab */}
        {tab === 'tailoring' && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : tailoring.length === 0 ? (
              <p className="text-gray-500 text-center py-12">No tailoring sessions yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">User</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Job Title</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Company</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Created</th>
                      <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium">ATS Score</th>
                      <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Base File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tailoring.map((r, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition">
                        <td className="px-4 py-3 font-mono text-xs">{r.user_email}</td>
                        <td className="px-4 py-3 text-gray-300 text-xs">{r.jd_analysis?.job_title || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.jd_analysis?.company || '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(r.created_at)}</td>
                        <td className="px-4 py-3 text-center">
                          {r.ats_scores?.overall != null ? (
                            <span className={`text-xs font-semibold tabular-nums ${
                              r.ats_scores.overall >= 80 ? 'text-emerald-400' :
                              r.ats_scores.overall >= 60 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {r.ats_scores.overall}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]">
                          {r.base_resume_filename || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── User Detail Sub-view ─────────────────────────────────────────

function UserDetailView({ detail, onBack }: { detail: UserDetail; onBack: () => void }) {
  const { user, parsed_resume, base_resumes, generated_resumes, tailoring_records } = detail;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to users
      </button>

      {/* User Info */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">User Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div><span className="text-gray-500">Email:</span> <span className="text-white ml-1">{user.email}</span></div>
          <div><span className="text-gray-500">Name:</span> <span className="text-gray-300 ml-1">{user.name || '—'}</span></div>
          <div><span className="text-gray-500">Role:</span> <span className="text-gray-300 ml-1">{user.role || '—'}</span></div>
          <div><span className="text-gray-500">Sector:</span> <span className="text-gray-300 ml-1">{user.sector || '—'}</span></div>
          <div><span className="text-gray-500">Registered:</span> <span className="text-gray-300 ml-1">{formatDate(user.created_at)}</span></div>
          <div><span className="text-gray-500">Last Login:</span> <span className="text-gray-300 ml-1">{formatDate(user.last_login)}</span></div>
          <div><span className="text-gray-500">Last Login IP:</span> <span className="text-gray-300 ml-1 font-mono">{user.last_login_ip || '—'}</span></div>
          <div><span className="text-gray-500">Login Attempts:</span> <span className="text-gray-300 ml-1">{user.login_attempts}</span></div>
          <div><span className="text-gray-500">Session ID:</span> <span className="text-gray-300 ml-1 font-mono truncate">{user.session_id?.slice(0, 12) || '—'}...</span></div>
        </div>
      </div>

      {/* Parsed Resume */}
      {parsed_resume && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Parsed Resume</h3>
          <div className="text-xs space-y-2">
            {parsed_resume.contact && (
              <div className="text-gray-300">
                <strong>{parsed_resume.contact.name}</strong>
                {parsed_resume.contact.email && <span className="ml-2 text-gray-500">{parsed_resume.contact.email}</span>}
                {parsed_resume.contact.phone && <span className="ml-2 text-gray-500">{parsed_resume.contact.phone}</span>}
              </div>
            )}
            {parsed_resume.summary && (
              <p className="text-gray-400 line-clamp-3">{parsed_resume.summary}</p>
            )}
            {parsed_resume.skills && Object.keys(parsed_resume.skills).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(parsed_resume.skills).map(([category, _skills]) => (
                  <span key={category} className="px-2 py-0.5 text-[10px] bg-indigo-500/10 text-indigo-400 rounded-full">
                    {category}
                  </span>
                ))}
              </div>
            )}
            {parsed_resume.experience?.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-gray-500 font-medium">Experience ({parsed_resume.experience.length}):</p>
                {parsed_resume.experience.slice(0, 3).map((exp: any, i: number) => (
                  <p key={i} className="text-gray-400">
                    {exp.title} {exp.company && `at ${exp.company}`} {exp.dates && `(${exp.dates})`}
                  </p>
                ))}
              </div>
            )}
            {parsed_resume.education?.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-gray-500 font-medium">Education ({parsed_resume.education.length}):</p>
                {parsed_resume.education.map((edu: any, i: number) => (
                  <p key={i} className="text-gray-400">
                    {edu.degree} {edu.institution && `— ${edu.institution}`} {edu.dates && `(${edu.dates})`}
                  </p>
                ))}
              </div>
            )}
            <p className="text-gray-600 mt-2">Parsed at: {formatDate(parsed_resume.parsed_at)}</p>
          </div>
        </div>
      )}

      {/* Base Resumes */}
      {base_resumes.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Base Resumes ({base_resumes.length})</h3>
          <div className="space-y-2">
            {base_resumes.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-gray-300">{r.filename}</span>
                  {r.is_active && <span className="ml-2 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px]">Active</span>}
                </div>
                <div className="text-gray-500">
                  {r.size_bytes && <span>{(r.size_bytes / 1024).toFixed(0)} KB</span>}
                  <span className="ml-3">{formatDate(r.uploaded_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Resumes */}
      {generated_resumes.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Generated Resumes ({generated_resumes.length})</h3>
          <div className="space-y-2">
            {generated_resumes.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                <span className="text-gray-300">{r.filename || r.job_title}</span>
                <div className="text-gray-500">
                  {r.size_bytes && <span>{(r.size_bytes / 1024).toFixed(0)} KB</span>}
                  <span className="ml-3">{formatDate(r.generated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tailoring Records */}
      {tailoring_records.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Tailoring Sessions ({tailoring_records.length})</h3>
          <div className="space-y-2">
            {tailoring_records.map((r: any, i: number) => (
              <div key={i} className="text-xs py-2 border-b border-white/5 last:border-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">
                    {r.jd_analysis?.job_title || 'Unknown Role'}
                    {r.jd_analysis?.company && <span className="text-gray-500"> at {r.jd_analysis.company}</span>}
                  </span>
                  <span className="text-gray-500">{formatDate(r.created_at)}</span>
                </div>
                {r.ats_scores && (
                  <div className="flex gap-3 text-[10px]">
                    <span className={r.ats_scores.overall >= 80 ? 'text-emerald-400' : r.ats_scores.overall >= 60 ? 'text-amber-400' : 'text-red-400'}>
                      Overall: {r.ats_scores.overall}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
