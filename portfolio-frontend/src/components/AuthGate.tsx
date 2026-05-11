import { useState, useEffect, useRef, useCallback, ReactNode, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
import type { TechChronicleItem, TechNewsItem, CareerIntelItem } from '@/types/techChronicle';
import { isCareerItem } from '@/types/techChronicle';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  'Software Engineer', 'Data Scientist', 'Product Manager',
  'Designer', 'DevOps Engineer', 'Student', 'Other',
];

const SECTOR_OPTIONS = [
  'Technology', 'Finance', 'Healthcare', 'Education',
  'Government', 'Consulting', 'Other',
];

// ─── Tech Chronicle filter tabs ────────────────────────────────────────────
// Includes 'career' as a meta-category that matches trend/tip/stat items.
const CHRONICLE_TABS: { id: string; label: string }[] = [
  { id: 'all',      label: 'All'      },
  { id: 'ai',       label: 'AI'       },
  { id: 'cloud',    label: 'Cloud'    },
  { id: 'devops',   label: 'DevOps'   },
  { id: 'security', label: 'Security' },
  { id: 'web',      label: 'Web'      },
  { id: 'data',     label: 'Data'     },
  { id: 'systems',  label: 'Systems'  },
  { id: 'career',   label: 'Career'   },
];

// Category → visual treatment for tech news cards
const TECH_CATEGORY_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ai:       { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/25',  label: 'AI' },
  cloud:    { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/25',     label: 'Cloud' },
  devops:   { bg: 'bg-orange-500/10',  text: 'text-orange-300',  border: 'border-orange-500/25',  label: 'DevOps' },
  security: { bg: 'bg-rose-500/10',    text: 'text-rose-300',    border: 'border-rose-500/25',    label: 'Security' },
  data:     { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25', label: 'Data' },
  web:      { bg: 'bg-pink-500/10',    text: 'text-pink-300',    border: 'border-pink-500/25',    label: 'Web' },
  systems:  { bg: 'bg-slate-500/10',   text: 'text-slate-300',   border: 'border-slate-500/25',   label: 'Systems' },
};

// Category → visual treatment for career cards (left border accent)
const CAREER_CATEGORY_STYLE: Record<string, { color: string; bg: string; border: string; accent: string; label: string }> = {
  trend: { color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/25',  accent: 'border-l-rose-500',  label: 'TRENDING' },
  tip:   { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', accent: 'border-l-amber-500', label: 'RESUME TIP' },
  stat:  { color: 'text-cyan-400',  bg: 'bg-cyan-500/10',  border: 'border-cyan-500/25',  accent: 'border-l-cyan-500',  label: 'DID YOU KNOW' },
};

function formatScore(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

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

// ─── SVG Icons ──────────────────────────────────────────────────────────────
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

function ArrowRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
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

function ChatBubbleIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
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

function ChevronDownIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
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

// ═══ Cycling typewriter — types a word, pauses, erases, types the next ═══
function useRotatingTypewriter(words: string[], typingSpeed = 70, eraseSpeed = 40, pauseMs = 1500) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'pause' | 'erasing'>('typing');

  useEffect(() => {
    const current = words[index] || '';
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (text.length < current.length) {
        timer = setTimeout(() => setText(current.slice(0, text.length + 1)), typingSpeed);
      } else {
        timer = setTimeout(() => setPhase('pause'), pauseMs);
      }
    } else if (phase === 'pause') {
      timer = setTimeout(() => setPhase('erasing'), 100);
    } else {
      if (text.length > 0) {
        timer = setTimeout(() => setText(current.slice(0, text.length - 1)), eraseSpeed);
      } else {
        setIndex((index + 1) % words.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timer);
  }, [words, index, text, phase, typingSpeed, eraseSpeed, pauseMs]);

  return text;
}

// ═══ Live "X people tailoring right now" counter — purely cosmetic ═══
// Creates a sense of activity without actually tracking real users. Seeded
// with a plausible number, drifts by ±3 every 8s with smooth transitions.
function useActiveUserCount(min = 14, max = 47, initial = 28) {
  const [n, setN] = useState(initial);
  useEffect(() => {
    const tick = () => {
      setN(prev => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3..+3
        return Math.max(min, Math.min(max, prev + delta));
      });
    };
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [min, max]);
  return n;
}

// ═══ useTechChronicleFeed ═══
// Fetches the AI-generated merged tech + career feed from our backend.
// Replaces the old Hacker News pull that was flaky due to CORS.
function useTechChronicleFeed() {
  const [items, setItems] = useState<TechChronicleItem[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const resp = await apiService.getTechChronicle('all');
      if (resp.error) {
        setError(resp.error);
      } else if (resp.data) {
        setItems(resp.data.items || []);
        setTrendingTags(resp.data.trendingTags || []);
        setGeneratedAt(resp.data.generatedAt || null);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Auto-refresh every 10 minutes so the feed stays live without hammering the backend
  useEffect(() => {
    const interval = setInterval(() => fetchFeed(true), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return { items, trendingTags, generatedAt, loading, refreshing, error, refresh: () => fetchFeed(true) };
}

// ─── Skeleton loader ────────────────────────────────────────────────────────
function ArticleSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gray-800/40 border border-white/[0.05] p-4 ${hero ? 'col-span-2' : ''}`}>
      <div className="flex gap-2 mb-2.5">
        <div className="h-4 w-10 rounded-full bg-gray-700/60" />
        <div className="h-4 w-14 rounded-full bg-gray-700/60" />
      </div>
      <div className={`${hero ? 'h-5' : 'h-4'} w-full rounded bg-gray-700/60 mb-2`} />
      <div className={`${hero ? 'h-5' : 'h-4'} w-3/4 rounded bg-gray-700/60 mb-3`} />
      <div className="flex gap-3">
        <div className="h-3 w-16 rounded bg-gray-700/30" />
        <div className="h-3 w-10 rounded bg-gray-700/30" />
      </div>
    </div>
  );
}

// ═══ Tech News Card ═══
// Used for ai/cloud/devops/security/data/web/systems items. Click-to-expand
// reveals the summary + source link (Google search fallback if needed).
function TechNewsCard({ item, featured = false }: { item: TechNewsItem; featured?: boolean }) {
  const [expanded, setExpanded] = useState(featured);
  const c = TECH_CATEGORY_STYLE[item.category] || TECH_CATEGORY_STYLE.systems;

  return (
    <div
      className={`group bg-gray-800/40 hover:bg-gray-800/60 border border-white/[0.07] hover:border-white/[0.15] rounded-xl cursor-pointer transition-all duration-200 ${featured ? 'col-span-2 p-5 bg-gradient-to-br from-gray-800/60 via-gray-800/40 to-purple-900/10' : 'p-4'}`}
      onClick={() => !featured && setExpanded(!expanded)}
    >
      {/* Category badge + tags */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
          {c.label}
        </span>
        {featured && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Top Story</span>
        )}
        {item.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.05]">
            {tag}
          </span>
        ))}
      </div>

      {/* Headline */}
      <h3 className={`font-semibold text-white group-hover:text-purple-300 transition-colors leading-snug mb-2 ${featured ? 'text-[1.05rem]' : 'text-[13px]'}`}>
        {item.headline}
      </h3>

      {/* Expandable summary — always shown for featured */}
      <AnimatePresence initial={false}>
        {(expanded || featured) && item.summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className={`text-gray-400 leading-relaxed mb-2.5 ${featured ? 'text-[13px]' : 'text-[12px]'}`}>
              {item.summary}
            </p>
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mb-2 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                {item.sourceIsSearch ? 'Search for full article' : 'Read full article'} →
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
        <span className="flex items-center gap-1 text-gray-400">
          <GlobeIcon /> {item.source}
        </span>
        <span>{item.timeAgo}</span>
        <span className="flex items-center gap-0.5 text-purple-400/70">
          <ArrowUpIcon /> {formatScore(item.upvotes)}
        </span>
        {item.comments > 0 && (
          <span className="flex items-center gap-0.5">
            <ChatBubbleIcon /> {item.comments}
          </span>
        )}
        {!expanded && !featured && (
          <span className="ml-auto text-gray-600">{item.readTime}</span>
        )}
      </div>
    </div>
  );
}

// ═══ Career Intel Card ═══
// Used for trend/tip/stat items. Left border accent is the visual signal that
// distinguishes these from tech news cards even in a mixed feed. No source
// link — the content is self-contained advice.
function CareerCard({ item }: { item: CareerIntelItem }) {
  const [expanded, setExpanded] = useState(false);
  const c = CAREER_CATEGORY_STYLE[item.category] || CAREER_CATEGORY_STYLE.tip;

  return (
    <div
      className={`group bg-gray-800/40 hover:bg-gray-800/60 border border-white/[0.07] hover:border-white/[0.15] rounded-xl p-4 cursor-pointer transition-all duration-200 border-l-[3px] ${c.accent}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${c.color}`}>
          {item.category === 'trend' && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
          )}
          {item.category === 'tip' && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
          )}
          {item.category === 'stat' && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
          )}
          {c.label}
        </span>
        <span className="text-[10px] text-gray-600">{item.timeAgo}</span>
      </div>

      <h3 className="text-[13px] font-semibold text-white group-hover:text-purple-300 transition-colors leading-snug">
        {item.headline}
      </h3>

      {item.tags && item.tags.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {item.tags.slice(0, 2).map(tag => (
            <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${c.bg} ${c.color} border ${c.border}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 text-[12px] text-gray-400 leading-relaxed border-t border-white/[0.05] pt-3 overflow-hidden"
          >
            {item.summary}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══ Tech Chronicle Feed (desktop left panel) ═══
function TechNewsFeed({
  items, trendingTags, generatedAt, loading, refreshing, refresh,
}: {
  items: TechChronicleItem[];
  trendingTags: string[];
  generatedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (activeCategory !== 'all') {
      if (activeCategory === 'career') {
        list = list.filter(i => i.category === 'trend' || i.category === 'tip' || i.category === 'stat');
      } else {
        list = list.filter(i => i.category === activeCategory);
      }
    }
    if (activeTag) {
      const target = activeTag.toLowerCase();
      list = list.filter(i => (i.tags || []).some(t => typeof t === 'string' && t.toLowerCase() === target));
    }
    return list;
  }, [items, activeCategory, activeTag]);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const lastUpdated = generatedAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(generatedAt).getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ago`;
      })()
    : 'just now';

  return (
    <div className="flex flex-col h-full">
      {/* Sticky masthead + filters */}
      <div className="shrink-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-white/[0.07]">
        {/* Masthead */}
        <div className="text-center px-5 pt-5 pb-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{today}</p>
          <h2
            className="text-[1.4rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-indigo-300 tracking-tight mt-0.5"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            THE TECH CHRONICLE
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-[10px] text-gray-500">AI-powered tech & career intelligence</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-400 font-semibold tracking-wider">LIVE</span>
          </div>
        </div>

        {/* LIVE updated + refresh row */}
        <div className="px-5 pb-2 flex items-center justify-between text-[10px] text-gray-500">
          <span>Updated {lastUpdated}</span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-50"
          >
            <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.656v4.992" /></svg>
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {/* Category filter pills */}
        <div className="px-4 pb-2 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1 min-w-max">
            {CHRONICLE_TABS.map(tab => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveCategory(tab.id); setActiveTag(null); }}
                  className={`relative px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
                    active
                      ? 'text-purple-300'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="chronicle-tab-pill"
                      className="absolute inset-0 rounded-full bg-purple-500/20 ring-1 ring-purple-500/30"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trending tags bar */}
        {trendingTags.length > 0 && (
          <div className="px-4 pb-3 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold whitespace-nowrap mr-1">🔥 Trending</span>
              {trendingTags.slice(0, 5).map(tag => {
                const active = activeTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(active ? null : tag)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-all ${
                      active
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-white/[0.03] text-gray-400 border-white/[0.05] hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 pt-4 pb-4">
            <ArticleSkeleton hero />
            <ArticleSkeleton />
            <ArticleSkeleton />
            <ArticleSkeleton />
            <ArticleSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="pt-12 text-center">
            <p className="text-gray-500 text-sm">No stories for this filter.</p>
            <button
              type="button"
              onClick={() => { setActiveCategory('all'); setActiveTag(null); }}
              className="mt-2 text-purple-400 text-sm hover:underline"
            >
              View all stories
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-4 pb-4">
            {/* Featured: first item always spans 2 cols */}
            {filtered[0] && (
              <motion.div
                key={`featured-${filtered[0].id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="col-span-2"
              >
                {isCareerItem(filtered[0]) ? (
                  <CareerCard item={filtered[0]} />
                ) : (
                  <TechNewsCard item={filtered[0]} featured />
                )}
              </motion.div>
            )}

            {filtered.slice(1).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min((i + 1) * 0.04, 0.4), duration: 0.3 }}
              >
                {isCareerItem(item) ? (
                  <CareerCard item={item} />
                ) : (
                  <TechNewsCard item={item} />
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-2.5 border-t border-white/[0.07] bg-gray-950/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-purple-400"><ZapIcon /></span>
            <span className="text-[10px] text-gray-500">Powered by Gemini AI</span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-[9px] text-gray-600">{items.length} stories</span>
            )}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile news teaser ─────────────────────────────────────────────────────
function MobileNewsTeaser({ items }: { items: TechChronicleItem[] }) {
  if (items.length === 0) return null;
  const top = items.slice(0, 4);
  return (
    <div className="mt-6 lg:hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-400"><ZapIcon /></span>
        <h3 className="text-sm font-semibold text-gray-400">Tech Pulse</h3>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <div className="space-y-2">
        {top.map(item => (
          <div key={item.id} className="px-3 py-2.5 bg-gray-900/50 border border-white/[0.07] rounded-lg">
            <div className="flex items-center gap-1.5 mb-1">
              {isCareerItem(item) ? (
                <span className={`text-[9px] font-bold uppercase tracking-wider ${CAREER_CATEGORY_STYLE[item.category]?.color || 'text-gray-400'}`}>
                  {CAREER_CATEGORY_STYLE[item.category]?.label || item.category}
                </span>
              ) : (
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${TECH_CATEGORY_STYLE[item.category]?.bg} ${TECH_CATEGORY_STYLE[item.category]?.text}`}>
                  {TECH_CATEGORY_STYLE[item.category]?.label}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-300 leading-snug line-clamp-2 font-medium">{item.headline}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
              <span>{item.timeAgo}</span>
              {!isCareerItem(item) && (
                <span className="flex items-center gap-0.5 text-purple-400/70">
                  <ArrowUpIcon /> {formatScore(item.upvotes)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AuthGate ───────────────────────────────────────────────────────────────
export default function AuthGate({ children, title, description }: AuthGateProps) {
  const { isAuthenticated, isLoading, login, register } = useAuth();

  // Step flow: email → login | register
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [sector, setSector] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Password feedback + dodging button (after failed submit)
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [dodgeOffset, setDodgeOffset] = useState({ x: 0, y: 0, rotation: 0 });
  const [shaking, setShaking] = useState(false);
  const maxDodges = 5;
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // News feed
  const chronicle = useTechChronicleFeed();
  const rotatingRole = useRotatingTypewriter([
    'Senior Cloud Engineer',
    'DevOps Lead',
    'Full Stack Developer',
    'Data Engineer',
    'Security Analyst',
    'AI / ML Engineer',
    'SRE',
  ]);
  const activeTailorCount = useActiveUserCount();

  // Typing effect
  const typedTitle = useTypingEffect(title || 'Welcome', 80);

  // Trigger fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Focus email input on initial mount AFTER animations settle. React's
  // `autoFocus` attribute used to fire during the first render which raced
  // with the slide-in animation + browser autofill and occasionally
  // duplicated the first keystroke ("the extra letter at end" bug).
  useEffect(() => {
    if (step !== 'email') return;
    const id = window.setTimeout(() => emailInputRef.current?.focus(), 150);
    return () => window.clearTimeout(id);
  }, [step]);

  // Focus password input when transitioning to login step
  useEffect(() => {
    if (step === 'login') {
      setTimeout(() => passwordInputRef.current?.focus(), 350);
    }
  }, [step]);

  // Reset login feedback while user edits password
  useEffect(() => {
    if (step !== 'login') return;
    setPasswordValid(null);
    setDodgeCount(0);
    setDodgeOffset({ x: 0, y: 0, rotation: 0 });
    setShaking(false);
  }, [password, step]);

  // Dodging button handler — escalates with each attempt
  const handleButtonInteraction = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (passwordValid !== false) return;
    if (e) e.preventDefault();

    if (dodgeCount >= maxDodges) {
      setShaking(true);
      setTimeout(() => setShaking(false), 800);
      return;
    }

    const intensity = 1 + dodgeCount * 0.4;
    const x = (Math.random() - 0.5) * 300 * intensity;
    const y = (Math.random() > 0.5 ? -1 : 1) * (40 + Math.random() * 80) * intensity;
    const clampedX = Math.max(-160, Math.min(160, x));
    const clampedY = Math.max(-120, Math.min(60, y));
    const rotation = (Math.random() - 0.5) * 15 * intensity;
    setDodgeOffset({ x: clampedX, y: clampedY, rotation });
    setDodgeCount(prev => prev + 1);
  }, [passwordValid, dodgeCount]);

  // Handle "Next" — check if email exists
  const handleEmailNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setCheckingEmail(true);
    try {
      const resp = await apiService.checkEmail(email);
      if (resp.error) {
        setError(resp.error);
        setCheckingEmail(false);
        return;
      }
      if (resp.data?.exists) {
        setStep('login');
      } else {
        setStep('register');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setCheckingEmail(false);
  };

  // Handle login submit — verify password only on submit for better UX and security
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordValid === false) {
      setShaking(true);
      setTimeout(() => setShaking(false), 800);
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setError('');
    setSubmitting(true);
    const sessionId = sessionStorage.getItem('portfolio_session_id') || undefined;
    const fingerprint = localStorage.getItem('portfolio_fingerprint_hash') || undefined;
    const result = await login(email, password, sessionId, fingerprint);
    setSubmitting(false);
    if (result.error) {
      setPasswordValid(false);
      setError(result.error);
    } else {
      setPasswordValid(true);
    }
  };

  // Handle register submit
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
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
      email, password, role || undefined, sector || undefined, sessionId, fingerprint
    );
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg('Account created! Logging you in...');
      setError('');
      setSubmitting(true);
      const loginResult = await login(email, password, sessionId, fingerprint);
      setSubmitting(false);
      if (loginResult.error) {
        setSuccessMsg('Account created! Please log in.');
        setStep('login');
        setPassword('');
        setConfirmPassword('');
        setRole('');
        setSector('');
      }
    }
  };

  // Go back to email step
  const handleBack = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setRole('');
    setSector('');
    setError('');
    setSuccessMsg('');
    setPasswordValid(null);
    setDodgeCount(0);
    setDodgeOffset({ x: 0, y: 0, rotation: 0 });
  };

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
    ? dodgeCount >= maxDodges ? 'Fine, try again...' : 'Login'
    : 'Login';

  const stepLabel = step === 'email' ? 'Get Started' : step === 'login' ? 'Welcome Back' : 'Create Account';

  return (
    <div
      className={`min-h-screen bg-gray-950 transition-opacity duration-700 ${
        fadeIn ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(236,72,153,0.15); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(236,72,153,0.3); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes article-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
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
        .animate-shake { animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-slide-right { animation: slide-in-right 0.35s ease-out both; }
      `}</style>

      {/* Sparkle particles */}
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
        {/* ── Left Side: Tech News Feed ─────────────────────────────────── */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[40%] flex-col h-screen sticky top-0 bg-gray-950 border-r border-pink-500/10">
          <TechNewsFeed
            items={chronicle.items}
            trendingTags={chronicle.trendingTags}
            generatedAt={chronicle.generatedAt}
            loading={chronicle.loading}
            refreshing={chronicle.refreshing}
            refresh={chronicle.refresh}
          />
        </div>

        {/* ── Right Side: Unified Auth Form ─────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 min-h-screen">
          <div className="w-full max-w-md">
            {/* Title with typing effect */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-300">AI-Powered Resume Tailoring</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {typedTitle}
                <span className="inline-block w-0.5 h-7 bg-purple-400 ml-1 animate-pulse align-middle" />
              </h1>
              {description && (
                <p className="mt-3 text-gray-400 text-sm leading-relaxed">{description}</p>
              )}
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                <span>Tailor your resume for</span>
                <span className="inline-flex items-center">
                  <span className="text-purple-300 font-semibold">{rotatingRole}</span>
                  <span className="inline-block w-0.5 h-3.5 bg-purple-400 ml-0.5 animate-pulse align-middle" />
                </span>
              </div>
            </div>

            {/* Auth card */}
            <div className="relative rounded-2xl p-[1px] gradient-border" style={{ animation: 'pulse-glow 3s ease-in-out infinite, gradient-rotate 4s ease infinite' }}>
              <div className="bg-gray-900 rounded-2xl p-6 sm:p-8">
                {/* Step indicator */}
                <div className="flex items-center justify-center mb-6">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      step === 'email' ? 'bg-pink-400 scale-125' : 'bg-pink-400/40'
                    }`} />
                    <div className={`w-8 h-0.5 transition-all duration-300 ${
                      step !== 'email' ? 'bg-pink-400' : 'bg-gray-700'
                    }`} />
                    <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      step !== 'email' ? 'bg-pink-400 scale-125' : 'bg-gray-700'
                    }`} />
                  </div>
                </div>

                <p className="text-center text-sm text-gray-400 mb-5 font-medium">{stepLabel}</p>

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

                {/* ===== STEP 1: Email ===== */}
                {step === 'email' && (
                  <form onSubmit={handleEmailNext} className="space-y-4 animate-slide-right">
                    <div>
                      <label htmlFor="auth-email" className={labelClasses}>Email</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><EnvelopeIcon /></span>
                        <input
                          ref={emailInputRef}
                          id="auth-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={inputClasses}
                          autoComplete="email"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          inputMode="email"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={checkingEmail}
                      className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 disabled:from-pink-800 disabled:to-purple-900 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30"
                    >
                      {checkingEmail ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                          Checking...
                        </>
                      ) : (
                        <>Next <ArrowRightIcon /></>
                      )}
                    </button>
                  </form>
                )}

                {/* ===== STEP 2A: Login (password) ===== */}
                {step === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4 animate-slide-right">
                    <div className="flex items-center gap-3 mb-2">
                      <button type="button" onClick={handleBack}
                        className="shrink-0 p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 transition-all"
                        title="Change email">
                        <ArrowLeftIcon />
                      </button>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <EnvelopeIcon />
                        <span className="text-sm text-gray-300 truncate">{maskEmail(email)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="login-password" className={labelClasses}>Password</label>
                        <button
                          type="button"
                          onClick={() => setForgotOpen(true)}
                          className="text-[11px] text-pink-300/80 hover:text-pink-200 underline-offset-2 hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><LockIcon /></span>
                        <input
                          ref={passwordInputRef}
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                          onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                          placeholder="Enter your password"
                          className={inputWithToggleClasses}
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {capsLockOn && (
                        <p className="text-[11px] text-amber-400 mt-1 inline-flex items-center gap-1">
                          ⚠ Caps Lock is on
                        </p>
                      )}
                      {password.length > 0 && !submitting && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {passwordValid === false ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-pink-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              <span className="text-xs text-pink-400">Incorrect password{dodgeCount > 0 ? ' — good luck clicking that button' : ''}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-gray-500">Password will be verified when you click Login</span>
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
                    {/* Dancing login button */}
                    <div className="relative h-[44px]" style={{ overflow: passwordValid === false ? 'visible' : 'hidden' }}>
                      <button
                        type={passwordValid === false ? 'button' : 'submit'}
                        disabled={submitting}
                        onMouseEnter={handleButtonInteraction}
                        onMouseDown={handleButtonInteraction}
                        onTouchStart={handleButtonInteraction}
                        onClick={passwordValid === false ? (e) => { e.preventDefault(); handleButtonInteraction(); } : undefined}
                        className={`absolute top-0 left-0 w-full py-2.5 font-medium rounded-lg flex items-center justify-center gap-2 select-none ${
                          shaking ? 'animate-shake' : ''
                        } ${
                          passwordValid === true
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 cursor-pointer'
                            : passwordValid === false
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
                              : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'
                        }`}
                        style={{
                          transform: `translate(${dodgeOffset.x}px, ${dodgeOffset.y}px) rotate(${dodgeOffset.rotation}deg)`,
                          transition: shaking ? 'none' : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s',
                        }}
                      >
                        {submitting ? (
                          <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Signing in...</>
                        ) : passwordValid === true ? (
                          <><ArrowRightIcon /> Login</>
                        ) : dodgeButtonText}
                      </button>
                    </div>
                  </form>
                )}

                {/* ===== STEP 2B: Register ===== */}
                {step === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4 animate-slide-right">
                    <div className="flex items-center gap-3 mb-2">
                      <button type="button" onClick={handleBack}
                        className="shrink-0 p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 transition-all"
                        title="Change email">
                        <ArrowLeftIcon />
                      </button>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <EnvelopeIcon />
                        <span className="text-sm text-gray-300 truncate">{email}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">New</span>
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
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {password && (
                        <div className="mt-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <div key={level} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                level <= passwordStrength.level ? passwordStrength.color : 'bg-gray-700'
                              }`} />
                            ))}
                          </div>
                          <p className={`text-xs mt-1 ${
                            passwordStrength.level <= 1 ? 'text-red-400' :
                            passwordStrength.level <= 2 ? 'text-orange-400' :
                            passwordStrength.level <= 3 ? 'text-yellow-400' : 'text-green-400'
                          }`}>{passwordStrength.label}</p>
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
                          className={`${inputWithToggleClasses} ${
                            confirmPassword && password !== confirmPassword
                              ? 'border-red-500 focus:border-red-500'
                              : confirmPassword && password === confirmPassword
                              ? 'border-green-500 focus:border-green-500'
                              : ''
                          }`}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                          {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
                      )}
                      {confirmPassword && password === confirmPassword && password.length >= 6 && (
                        <p className="text-xs text-green-400 mt-1">Passwords match.</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="reg-role" className={labelClasses}>
                        Role <span className="text-gray-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <select id="reg-role" value={role} onChange={(e) => setRole(e.target.value)} className={selectClasses}>
                          <option value="">Select a role</option>
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2"><ChevronDownIcon /></span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-sector" className={labelClasses}>
                        Sector <span className="text-gray-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <select id="reg-sector" value={sector} onChange={(e) => setSector(e.target.value)} className={selectClasses}>
                          <option value="">Select a sector</option>
                          {SECTOR_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
                        <><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" /> Creating account...</>
                      ) : 'Create Account'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Live active-user counter — simulated social proof */}
            <div className="mt-5 text-center">
              <p className="text-[11px] text-gray-500">
                <motion.span
                  key={activeTailorCount}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-block text-purple-300 font-bold tabular-nums"
                >
                  {activeTailorCount}
                </motion.span>
                <span> people are tailoring resumes right now</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2 align-middle animate-pulse" />
              </p>
            </div>

            {/* Social proof stats bar */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                { n: '12.4k+', label: 'Resumes Tailored' },
                { n: '84%', label: 'ATS Improvement' },
                { n: '3x', label: 'More Callbacks' },
                { n: '30s', label: 'Avg. Turnaround' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-2 py-2">
                  <p className="text-sm font-bold bg-gradient-to-br from-purple-300 to-indigo-300 bg-clip-text text-transparent tabular-nums">{s.n}</p>
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Mobile news teaser */}
            <MobileNewsTeaser items={chronicle.items} />
          </div>
        </div>
      </div>
      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        initialEmail={email}
      />
    </div>
  );
}
