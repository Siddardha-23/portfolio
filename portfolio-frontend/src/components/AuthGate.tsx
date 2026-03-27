import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';

interface AuthGateProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

// ─── Rich news article model ────────────────────────────────────────────────
interface NewsArticle {
  id: number;
  title: string;
  url: string;
  by: string;
  score: number;
  time: number;
  descendants: number;
  text?: string;
  tags: string[];
  summary: string;
  source: string;
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

const TAG_RULES: [RegExp, string][] = [
  [/\b(ai|artificial.?intelligence|gpt|llm|openai|machine.?learning|neural|transformer|deep.?learning|chatgpt|claude|gemini|copilot|diffusion|generative|anthropic|training|model|rag|agent)\b/i, 'AI'],
  [/\b(aws|azure|gcp|cloud|lambda|s3|ec2|kubernetes|k8s|serverless|cloudflare|vercel|netlify|heroku|microservice)\b/i, 'Cloud'],
  [/\b(docker|devops|ci.?cd|terraform|ansible|jenkins|deploy|infrastructure|monitoring|observability|grafana|prometheus|helm|pipeline|sre)\b/i, 'DevOps'],
  [/\b(react|vue|angular|typescript|javascript|node\.?js|deno|bun|next\.?js|svelte|tailwind|frontend|fullstack|api|graphql|web|wasm|webassembly)\b/i, 'Web'],
  [/\b(rust|golang|go\b|python|java\b|c\+\+|kotlin|swift|zig|haskell|elixir|ruby|compiler|language|erlang)\b/i, 'Languages'],
  [/\b(postgres|mysql|mongodb|redis|database|sql|nosql|sqlite|supabase|vector|elasticsearch|kafka)\b/i, 'Data'],
  [/\b(linux|kernel|os\b|unix|windows|macos|system|hardware|chip|cpu|gpu|memory|risc|arm|x86)\b/i, 'Systems'],
  [/\b(security|vulnerab|exploit|encryption|auth|zero.?day|breach|privacy|hack|crypto|tls|ssl|cve)\b/i, 'Security'],
  [/\b(open.?source|github|gitlab|oss|foss|license|apache|mit\b)\b/i, 'Open Source'],
];

const TAG_COLORS: Record<string, string> = {
  'AI': 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'Cloud': 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  'DevOps': 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  'Web': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'Languages': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'Data': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'Systems': 'bg-red-500/15 text-red-300 border-red-500/25',
  'Security': 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  'Open Source': 'bg-green-500/15 text-green-300 border-green-500/25',
  'Tech': 'bg-pink-500/15 text-pink-300 border-pink-500/25',
};

const FILTER_TAGS = ['All', 'AI', 'Cloud', 'DevOps', 'Web', 'Security', 'Data', 'Systems'];

const BATCH_SIZE = 12;

// ─── Fallback articles ─────────────────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);
const FALLBACK_ARTICLES: NewsArticle[] = [
  { id: 1, title: 'Claude 4 Achieves State-of-the-Art on Complex Reasoning Benchmarks', url: '#', by: 'anthropic', score: 2841, time: now - 1800, descendants: 1432, tags: ['AI'], summary: 'Anthropic\'s latest model demonstrates breakthrough performance in multi-step reasoning, code generation, and scientific analysis across all major evaluation suites.', source: 'anthropic.com' },
  { id: 2, title: 'Kubernetes 2.0 Preview: Simplified Cluster Management and Auto-Scaling', url: '#', by: 'k8s_team', score: 1923, time: now - 5400, descendants: 876, tags: ['Cloud', 'DevOps'], summary: 'The next major version promises to dramatically reduce operational complexity for container orchestration with an entirely redesigned control plane.', source: 'kubernetes.io' },
  { id: 3, title: 'GitHub Actions Introduces Native GPU Runners for ML Pipelines', url: '#', by: 'natfriedman', score: 1756, time: now - 9000, descendants: 643, tags: ['DevOps', 'AI'], summary: 'Developers can now train and evaluate ML models directly in CI/CD workflows with A100 and H100 GPU support built into GitHub-hosted runners.', source: 'github.blog' },
  { id: 4, title: 'Rust Foundation Announces Rust 2.0 Roadmap with Major Async Improvements', url: '#', by: 'rustlang', score: 1648, time: now - 14400, descendants: 921, tags: ['Languages'], summary: 'A complete overhaul of the async runtime, improved error handling ergonomics, and a new edition system that smooths the migration path for existing codebases.', source: 'blog.rust-lang.org' },
  { id: 5, title: 'AWS Introduces Graviton5 Instances with 2x Performance per Watt', url: '#', by: 'jeffbarr', score: 1534, time: now - 18000, descendants: 534, tags: ['Cloud', 'Systems'], summary: 'The fifth-generation Arm-based processors deliver unprecedented compute efficiency, targeting AI inference and high-throughput database workloads.', source: 'aws.amazon.com' },
  { id: 6, title: 'Critical OpenSSL Vulnerability Discovered Affecting TLS 1.3 Handshake', url: '#', by: 'securityresearch', score: 1487, time: now - 21600, descendants: 789, tags: ['Security'], summary: 'A buffer overflow in the TLS handshake process could allow remote code execution. Patches are available and immediate updates are recommended.', source: 'openssl.org' },
  { id: 7, title: 'PostgreSQL 18 Ships with Native Vector Search and HNSW Indexing', url: '#', by: 'pgfoundation', score: 1423, time: now - 25200, descendants: 612, tags: ['Data', 'AI'], summary: 'Built-in vector similarity search eliminates the need for pgvector extensions, with HNSW indexes that match dedicated vector database performance.', source: 'postgresql.org' },
  { id: 8, title: 'Docker Desktop 5.0 Adds WebAssembly Container Support', url: '#', by: 'solomonstre', score: 1312, time: now - 28800, descendants: 445, tags: ['DevOps', 'Web'], summary: 'WASM containers run alongside traditional Linux containers, enabling polyglot microservices with near-native performance and a fraction of the image size.', source: 'docker.com' },
  { id: 9, title: 'TypeScript 6.0 Introduces Pattern Matching and the Pipe Operator', url: '#', by: 'typescript', score: 1289, time: now - 32400, descendants: 567, tags: ['Web', 'Languages'], summary: 'The two most-requested features finally land in TypeScript, bringing expressive data processing patterns familiar to functional programming.', source: 'devblogs.microsoft.com' },
  { id: 10, title: 'Terraform 2.0 Rewrites State Management with Conflict-Free Collaboration', url: '#', by: 'hashicorp', score: 1198, time: now - 36000, descendants: 389, tags: ['DevOps', 'Cloud'], summary: 'A CRDT-based state backend enables teams to apply infrastructure changes concurrently without lock contention or state corruption.', source: 'hashicorp.com' },
  { id: 11, title: 'React 20 Server Components Now Handle 90% of Rendering by Default', url: '#', by: 'dan_abramov', score: 1156, time: now - 43200, descendants: 823, tags: ['Web'], summary: 'The latest React release shifts the default rendering model, dramatically reducing client bundle sizes and improving Time to Interactive metrics.', source: 'react.dev' },
  { id: 12, title: 'Linux Kernel 7.0 Merges io_uring Improvements for 40% I/O Throughput Gain', url: '#', by: 'torvalds', score: 1089, time: now - 50400, descendants: 456, tags: ['Systems'], summary: 'Major io_uring optimizations reduce syscall overhead and unlock significant throughput gains for database and network-heavy workloads.', source: 'lkml.org' },
  { id: 13, title: 'Grafana 12 Unifies Logs, Metrics, and Traces in a Single Query Language', url: '#', by: 'grafana', score: 987, time: now - 57600, descendants: 312, tags: ['DevOps'], summary: 'A new unified query language replaces PromQL, LogQL, and TraceQL, simplifying observability across the entire monitoring stack.', source: 'grafana.com' },
  { id: 14, title: 'Deno 4.0 Achieves Full Node.js Compatibility with npm Workspace Support', url: '#', by: 'ry', score: 945, time: now - 64800, descendants: 534, tags: ['Web', 'Languages'], summary: 'The runtime now seamlessly runs existing Node.js projects including monorepos, removing the last major barrier to adoption.', source: 'deno.land' },
  { id: 15, title: 'Show HN: Open-Source Alternative to Datadog Built on ClickHouse', url: '#', by: 'ossdev', score: 876, time: now - 72000, descendants: 267, tags: ['Open Source', 'DevOps'], summary: 'A fully open-source observability platform that handles logs, metrics, and traces at 10x lower cost than commercial alternatives.', source: 'github.com' },
  { id: 16, title: 'Google Cloud Announces TPU v6 with 4x Training Performance', url: '#', by: 'google_cloud', score: 834, time: now - 82800, descendants: 398, tags: ['Cloud', 'AI'], summary: 'The sixth-generation TPU delivers massive speedups for large model training, available through GKE with automatic pod scheduling.', source: 'cloud.google.com' },
  { id: 17, title: 'Mozilla Releases Firefox 140 with Encrypted Client Hello by Default', url: '#', by: 'mozilla', score: 756, time: now - 90000, descendants: 234, tags: ['Security', 'Web'], summary: 'ECH encryption prevents ISPs and middleboxes from seeing which sites users visit, a major step forward for web privacy.', source: 'blog.mozilla.org' },
  { id: 18, title: 'Supabase Launches Realtime Database Branching for Preview Environments', url: '#', by: 'supabase', score: 712, time: now - 100800, descendants: 189, tags: ['Data', 'Cloud'], summary: 'Each pull request gets an isolated database branch with automatic schema migration, enabling true preview environments.', source: 'supabase.com' },
];

// ─── Utility functions ──────────────────────────────────────────────────────
type Step = 'email' | 'login' | 'register';

function inferTags(title: string): string[] {
  const tags: string[] = [];
  for (const [pattern, tag] of TAG_RULES) {
    if (pattern.test(title) && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= 2) break;
  }
  if (tags.length === 0) tags.push('Tech');
  return tags;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function timeAgo(unixTime: number): string {
  const seconds = Math.floor(Date.now() / 1000 - unixTime);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x2F;/g, '/');
}

function generateSummary(title: string, text?: string): string {
  if (text) {
    const plain = stripHtml(text).trim();
    return plain.slice(0, 150) + (plain.length > 150 ? '...' : '');
  }
  const t = title.toLowerCase();
  if (/^show hn/i.test(title)) return 'A new project shared with the developer community for feedback, showcasing novel approaches to common engineering challenges.';
  if (/^ask hn/i.test(title)) return 'A community discussion seeking insights and shared experiences from developers across the industry.';
  if (/launch|release|announc|introduc|unveil|ship/i.test(t)) return 'A significant release introducing new capabilities aimed at improving developer productivity and system reliability.';
  if (/how to|guide|tutorial|getting started|walkthrough/i.test(t)) return 'A hands-on technical guide covering implementation details and best practices for modern development workflows.';
  if (/why|should|opinion|think|believe|case for|case against/i.test(t)) return 'An analytical perspective examining trade-offs and considerations that shape technical decision-making.';
  if (/vulnerab|exploit|breach|hack|security|cve/i.test(t)) return 'A security development with potential implications for system architecture and deployment practices.';
  if (/benchmark|performance|fast|speed|optim/i.test(t)) return 'Performance analysis revealing optimization strategies and their measured impact on real-world workloads.';
  if (/open.?source|oss|foss/i.test(t)) return 'An open-source contribution expanding the ecosystem of freely available tools for the developer community.';
  if (/hiring|layoff|job|career|remote|interview/i.test(t)) return 'Industry developments shaping the tech employment landscape and engineering career trajectories.';
  if (/rust|go|python|java|typescript|zig/i.test(t)) return 'Language ecosystem developments that influence how developers build and maintain production software.';
  return 'A notable development capturing the attention of the developer community and shaping industry discourse.';
}

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

function useTechNewsFeed() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [allIds, setAllIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef(0);
  const fetchingRef = useRef(false);

  const parseItem = useCallback((item: any): NewsArticle | null => {
    if (!item || !item.title) return null;
    const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
    const tags = inferTags(item.title);
    return {
      id: item.id,
      title: item.title,
      url,
      by: item.by || 'anonymous',
      score: item.score || 0,
      time: item.time || 0,
      descendants: item.descendants || 0,
      text: item.text,
      tags,
      summary: generateSummary(item.title, item.text),
      source: item.url ? extractDomain(item.url) : 'news.ycombinator.com',
    };
  }, []);

  const loadBatch = useCallback(async (ids: number[], startIdx: number): Promise<NewsArticle[]> => {
    const batch = ids.slice(startIdx, startIdx + BATCH_SIZE);
    if (batch.length === 0) return [];

    const items = await Promise.all(
      batch.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          .then(r => r.json())
          .catch(() => null)
      )
    );

    return items.map(parseItem).filter((a): a is NewsArticle => a !== null);
  }, [parseItem]);

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const resp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids: number[] = await resp.json();
        if (cancelled) return;
        setAllIds(ids);

        const firstBatch = await loadBatch(ids, 0);
        if (cancelled) return;
        cursorRef.current = BATCH_SIZE;
        setArticles(firstBatch);
        setHasMore(BATCH_SIZE < ids.length);
      } catch {
        if (!cancelled) setArticles(FALLBACK_ARTICLES);
      }
      if (!cancelled) setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, [loadBatch]);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore || allIds.length === 0) return;
    fetchingRef.current = true;
    setLoadingMore(true);

    const newArticles = await loadBatch(allIds, cursorRef.current);
    cursorRef.current += BATCH_SIZE;
    setArticles(prev => [...prev, ...newArticles]);
    setHasMore(cursorRef.current < allIds.length);
    setLoadingMore(false);
    fetchingRef.current = false;
  }, [hasMore, allIds, loadBatch]);

  return { articles, loading, loadingMore, hasMore, loadMore };
}

// ─── Skeleton loader ────────────────────────────────────────────────────────
function ArticleSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className={`animate-pulse ${hero ? 'pb-5' : 'py-4'}`}>
      <div className="flex gap-2 mb-2.5">
        <div className="h-4 w-10 rounded-full bg-gray-800/80" />
        <div className="h-4 w-14 rounded-full bg-gray-800/80" />
      </div>
      <div className={`${hero ? 'h-6' : 'h-5'} w-full rounded bg-gray-800/80 mb-2`} />
      <div className={`${hero ? 'h-6' : 'h-5'} w-3/4 rounded bg-gray-800/80 mb-3`} />
      <div className="h-3.5 w-full rounded bg-gray-800/50 mb-1.5" />
      <div className="h-3.5 w-2/3 rounded bg-gray-800/50 mb-3" />
      <div className="flex gap-3">
        <div className="h-3 w-20 rounded bg-gray-800/40" />
        <div className="h-3 w-12 rounded bg-gray-800/40" />
        <div className="h-3 w-16 rounded bg-gray-800/40" />
      </div>
    </div>
  );
}

// ─── Tag pill ───────────────────────────────────────────────────────────────
function TagPill({ tag }: { tag: string }) {
  const colors = TAG_COLORS[tag] || TAG_COLORS['Tech'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors}`}>
      {tag}
    </span>
  );
}

// ─── Article card ───────────────────────────────────────────────────────────
function ArticleCard({ article, index, hero = false }: { article: NewsArticle; index: number; hero?: boolean }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block transition-colors duration-200 ${
        hero
          ? 'pb-5'
          : 'py-4 border-t border-gray-800/50'
      }`}
      style={{ animation: `article-fade-in 0.4s ease-out ${Math.min(index * 0.05, 0.3)}s both` }}
    >
      {/* Tags */}
      <div className="flex items-center gap-1.5 mb-2">
        {!hero && (
          <span className="text-xs font-bold text-pink-500/30 mr-1 tabular-nums min-w-[1.25rem]"
                style={{ fontFamily: "'Georgia', serif" }}>
            {index + 1}
          </span>
        )}
        {article.tags.map(tag => <TagPill key={tag} tag={tag} />)}
      </div>

      {/* Title */}
      <h3
        className={`font-bold text-gray-100 group-hover:text-pink-300 transition-colors leading-snug ${
          hero ? 'text-[1.2rem]' : 'text-[0.9rem]'
        }`}
        style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
      >
        {article.title}
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className={`mt-1.5 text-gray-400 leading-relaxed line-clamp-2 ${
          hero ? 'text-[0.82rem]' : 'text-[0.78rem]'
        }`}>
          {article.summary}
        </p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-2.5 mt-2.5 text-[10px] text-gray-500 flex-wrap">
        {article.source && (
          <span className="flex items-center gap-1 text-gray-400">
            <GlobeIcon />
            {article.source}
          </span>
        )}
        <span>{timeAgo(article.time)}</span>
        <span className="flex items-center gap-0.5 text-pink-400/60">
          <ArrowUpIcon /> {formatScore(article.score)}
        </span>
        {article.descendants > 0 && (
          <span className="flex items-center gap-0.5">
            <ChatBubbleIcon /> {article.descendants}
          </span>
        )}
        <span className="text-gray-600">by {article.by}</span>
      </div>
    </a>
  );
}

// ─── TechNewsFeed (desktop left panel) ──────────────────────────────────────
function TechNewsFeed({ articles, loading, loadingMore, hasMore, loadMore }: {
  articles: NewsArticle[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState('All');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { root: scrollRef.current, rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, loadMore]);

  const filtered = activeFilter === 'All'
    ? articles
    : articles.filter(a => a.tags.includes(activeFilter));

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      {/* Sticky masthead + filters */}
      <div className="shrink-0 bg-gray-950/95 backdrop-blur-sm z-10 border-b border-gray-800/40">
        {/* Masthead */}
        <div className="text-center px-5 pt-5 pb-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{today}</p>
          <h2
            className="text-[1.4rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-white to-purple-300 tracking-tight mt-0.5"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            THE TECH CHRONICLE
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-pink-500/30" />
            <span className="text-[9px] text-gray-500 uppercase tracking-widest">Live Feed</span>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-pink-500/30" />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="px-4 pb-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-1.5 min-w-max">
            {FILTER_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveFilter(tag)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
                  activeFilter === tag
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-gray-700/60'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 custom-scrollbar">
        {loading ? (
          <div className="pt-4">
            <ArticleSkeleton hero />
            <ArticleSkeleton />
            <ArticleSkeleton />
            <ArticleSkeleton />
          </div>
        ) : filtered.length === 0 ? (
          <div className="pt-12 text-center">
            <p className="text-gray-500 text-sm">No stories found for this category.</p>
            <button
              type="button"
              onClick={() => setActiveFilter('All')}
              className="mt-2 text-pink-400 text-sm hover:underline"
            >
              View all stories
            </button>
          </div>
        ) : (
          <>
            {/* Hero article */}
            <div className="pt-4">
              <ArticleCard article={filtered[0]} index={0} hero />
            </div>

            {/* Remaining articles */}
            {filtered.slice(1).map((article, i) => (
              <ArticleCard key={article.id} article={article} index={i + 1} />
            ))}

            {/* Infinite scroll sentinel + loader */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="py-4">
                <ArticleSkeleton />
                <ArticleSkeleton />
              </div>
            )}
            {!hasMore && filtered.length > 5 && (
              <div className="py-6 text-center border-t border-gray-800/40">
                <p className="text-[11px] text-gray-600 uppercase tracking-wider">End of feed</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-2.5 border-t border-gray-800/60 bg-gray-950/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-pink-400"><ZapIcon /></span>
            <span className="text-[10px] text-gray-500">Powered by Hacker News</span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && (
              <span className="text-[9px] text-gray-600">{articles.length} stories loaded</span>
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
function MobileNewsTeaser({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <div className="mt-6 lg:hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-pink-400"><ZapIcon /></span>
        <h3 className="text-sm font-semibold text-gray-400">Tech Pulse</h3>
      </div>
      <div className="space-y-2">
        {articles.slice(0, 4).map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2.5 bg-gray-900/50 border border-pink-500/10 rounded-lg hover:bg-pink-500/5 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {article.tags.slice(0, 1).map(tag => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
            <p className="text-xs text-gray-300 leading-snug line-clamp-2 font-medium">{article.title}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
              <span className="text-gray-400">{article.source}</span>
              <span>{timeAgo(article.time)}</span>
              <span className="flex items-center gap-0.5 text-pink-400/60">
                <ArrowUpIcon /> {formatScore(article.score)}
              </span>
            </div>
          </a>
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

  // Real-time password validation + dodging button
  const [passwordValid, setPasswordValid] = useState<boolean | null>(null);
  const [dodgeCount, setDodgeCount] = useState(0);
  const [dodgeOffset, setDodgeOffset] = useState({ x: 0, y: 0 });
  const [shaking, setShaking] = useState(false);
  const maxDodges = 5;
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // News feed
  const { articles, loading: newsLoading, loadingMore, hasMore, loadMore } = useTechNewsFeed();

  // Typing effect
  const typedTitle = useTypingEffect(title || 'Welcome', 80);

  // Trigger fade-in on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Focus password input when transitioning to login step
  useEffect(() => {
    if (step === 'login') {
      setTimeout(() => passwordInputRef.current?.focus(), 350);
    }
  }, [step]);

  // Real-time password validation for login — auto-login on correct password
  useEffect(() => {
    setDodgeCount(0);
    setDodgeOffset({ x: 0, y: 0 });

    if (step !== 'login' || !email || !password || password.length < 1) {
      setPasswordValid(null);
      return;
    }

    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(async () => {
      try {
        const resp = await apiService.validatePassword(email, password);
        if (!resp.data) return;

        if (resp.data.valid) {
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
        } else {
          setPasswordValid(false);
        }
      } catch {
        setPasswordValid(null);
      }
    }, 300);

    return () => {
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, [password, email, step, login]);

  // Dodging button handler
  const handleButtonInteraction = useCallback(() => {
    if (passwordValid !== false) return;
    if (dodgeCount >= maxDodges) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    const x = (Math.random() - 0.5) * 240;
    const y = (Math.random() - 0.5) * 100;
    setDodgeOffset({ x, y });
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

  // Handle login submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordValid === false) {
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
      return;
    }
    setError('');
    if (!password) {
      setError('Please enter your password.');
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
    setDodgeOffset({ x: 0, y: 0 });
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
            articles={articles}
            loading={newsLoading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            loadMore={loadMore}
          />
        </div>

        {/* ── Right Side: Unified Auth Form ─────────────────────────────── */}
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
                          id="auth-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className={inputClasses}
                          autoComplete="email"
                          autoFocus
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
                      <label htmlFor="login-password" className={labelClasses}>Password</label>
                      <div className={inputWrapperClasses}>
                        <span className="absolute left-3 z-10"><LockIcon /></span>
                        <input
                          ref={passwordInputRef}
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className={inputWithToggleClasses}
                          autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                          {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
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
                    {/* Dancing login button */}
                    <div className="relative overflow-hidden" style={{ height: '52px' }}>
                      <button
                        type="submit"
                        disabled={submitting || passwordValid === true}
                        onMouseEnter={handleButtonInteraction}
                        onTouchStart={handleButtonInteraction}
                        className={`absolute inset-x-0 py-2.5 font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                          shaking ? 'animate-shake' : ''
                        } ${
                          passwordValid === true
                            ? 'bg-emerald-500 text-white cursor-default shadow-lg shadow-emerald-500/20'
                            : passwordValid === false
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20 cursor-not-allowed'
                              : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30'
                        }`}
                        style={{
                          transform: `translate(${dodgeOffset.x}px, ${dodgeOffset.y}px)`,
                          transition: shaking ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        }}
                      >
                        {submitting ? (
                          <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Signing in...</>
                        ) : passwordValid === true ? (
                          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> Welcome!</>
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
                          className={inputWithToggleClasses}
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 z-10 text-gray-500 hover:text-gray-300 transition-colors" tabIndex={-1}>
                          {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                        </button>
                      </div>
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

            {/* Mobile news teaser */}
            <MobileNewsTeaser articles={articles} />
          </div>
        </div>
      </div>
    </div>
  );
}
