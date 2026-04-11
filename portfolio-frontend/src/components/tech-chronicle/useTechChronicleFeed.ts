/**
 * Tech Chronicle — Client-Side News Feed
 *
 * Single-file implementation of live tech news aggregation.
 * Fetches from 4 CORS-enabled public APIs directly in the browser:
 *   1. Hacker News (Firebase)  — community-curated tech
 *   2. Dev.to                  — developer articles
 *   3. Lobsters                — invite-only curated tech
 *   4. Hashnode                — developer blogging platform
 *
 * Career intel still comes from the backend (Gemini API via Lambda).
 *
 * See README.md in this directory for full architecture docs.
 */

import { useState, useEffect, useCallback } from "react";
import { apiService } from "@/lib/api";
import type {
  TechNewsItem,
  CareerIntelItem,
  TechChronicleItem,
  TechCategory,
} from "@/types/techChronicle";

// ═════════════════════════════════════════════════════════════════════════════
// §1  CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

const NEWS_TTL = 4 * 60 * 60 * 1000;   // 4 hours
const CAREER_TTL = 6 * 60 * 60 * 1000; // 6 hours
const SEEN_TTL = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_NEWS_ITEMS = 15;

// ═════════════════════════════════════════════════════════════════════════════
// §2  CACHE — localStorage utilities
// ═════════════════════════════════════════════════════════════════════════════

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* full/unavailable */ }
}
function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

function isExpired(tsKey: string, ttl: number): boolean {
  const ts = lsGet(tsKey);
  if (!ts) return true;
  return Date.now() - new Date(ts).getTime() > ttl;
}

function getCachedItems<T>(itemsKey: string, tsKey: string, ttl: number): { items: T[]; ts: string } | null {
  if (isExpired(tsKey, ttl)) return null;
  const raw = lsGet(itemsKey);
  if (!raw) return null;
  try { return { items: JSON.parse(raw), ts: lsGet(tsKey) || "" }; }
  catch { return null; }
}

function setCachedItems<T>(itemsKey: string, tsKey: string, items: T[]): void {
  lsSet(itemsKey, JSON.stringify(items));
  lsSet(tsKey, new Date().toISOString());
}

// Seen-ID tracking: prevents showing the same story twice within 24h
function getSeenIds(): Set<string> {
  if (isExpired("tc_seen_ts", SEEN_TTL)) {
    lsDel("tc_seen_ids");
    lsSet("tc_seen_ts", new Date().toISOString());
    return new Set();
  }
  const raw = lsGet("tc_seen_ids");
  try { return raw ? new Set(JSON.parse(raw)) : new Set(); }
  catch { return new Set(); }
}

function addSeenIds(ids: string[]): void {
  const seen = getSeenIds();
  ids.forEach((id) => seen.add(id));
  lsSet("tc_seen_ids", JSON.stringify([...seen]));
}

// Rotation cycle: 0/1/2, advances every 4 hours
function getEffectiveCycle(): number {
  const override = lsGet("tc_cycle_override");
  if (override !== null) {
    lsDel("tc_cycle_override");
    return parseInt(override, 10) % 3;
  }
  return Math.floor(Date.now() / (4 * 60 * 60 * 1000)) % 3;
}

function advanceCycle(): void {
  const next = (Math.floor(Date.now() / (4 * 60 * 60 * 1000)) + 1) % 3;
  lsSet("tc_cycle_override", String(next));
}

// ═════════════════════════════════════════════════════════════════════════════
// §3  FILTERS — tech-relevance check + category classification
// ═════════════════════════════════════════════════════════════════════════════

const NEGATIVE_RE =
  /\b(nasa|artemis|spacecraft|lunar|orbit|mars rover|spacex launch|asteroid|exoplanet|soccer|football|nfl|nba|fifa|olympics|world cup|premier league|boxing|wrestling|election|congress|senate|tariff|democrat|republican|immigration|abortion|gun control|box office|movie review|celebrity|kardashian|grammy|oscar|emmy|reality tv|geology|volcano|earthquake|fossil|dinosaur|yellowstone|mantle|battery recycl|solar panel|wind farm|climate summit|coral reef|wildfire|hurricane|tornado|recipe|cookbook|diet|weight loss|fashion|makeup|skincare)\b/i;

const POSITIVE_RE =
  /\b(software|code|coding|programming|programmer|developer|engineer|devops|sre|backend|frontend|fullstack|full.stack|api|sdk|framework|library|open.source|github|gitlab|npm|pip|cloud|aws|azure|gcp|lambda|serverless|docker|container|kubernetes|k8s|terraform|ansible|ci.?cd|pipeline|deploy|infrastructure|server|microservice|database|sql|nosql|postgres|mysql|mongo|redis|data pipeline|etl|spark|kafka|analytics|ai\b|artificial intelligence|machine learning|deep learning|neural|llm|gpt|claude|gemini|copilot|transformer|nlp|security|vulnerability|cve|breach|encryption|zero.day|malware|ransomware|cybersecurity|react|next\.?js|vue|svelte|angular|css|javascript|typescript|node\.?js|deno|bun|browser|webpack|vite|rust|golang|\bgo\b|linux|kernel|compiler|wasm|performance|networking|tcp|http|grpc|graphql|python|java\b|kotlin|swift|ruby|elixir|zig|git\b|startup|saas|fintech|crypto|blockchain)\b/i;

const CATEGORY_RULES: { cat: TechCategory; re: RegExp }[] = [
  { cat: "ai", re: /\b(ai\b|artificial intelligence|machine learning|deep learning|neural|llm|gpt|claude|gemini|copilot|transformer|nlp|diffusion|openai|anthropic|hugging.?face|chatbot|agent|rag\b|fine.?tun|embedding|vector|langchain)\b/i },
  { cat: "security", re: /\b(security|vulnerability|cve|breach|encryption|zero.day|malware|ransomware|phishing|cybersecurity|pentest|exploit|backdoor|firewall|oauth|jwt|ssl|tls)\b/i },
  { cat: "cloud", re: /\b(aws|azure|gcp|cloud|serverless|lambda|s3|ec2|cloudflare|vercel|netlify|kubernetes|k8s|docker|container|helm|istio|service mesh)\b/i },
  { cat: "devops", re: /\b(ci.?cd|pipeline|terraform|ansible|github actions|deploy|infrastructure|sre|observability|monitoring|grafana|prometheus|jenkins|argo|gitops|platform engineering)\b/i },
  { cat: "data", re: /\b(database|sql|postgres|mysql|mongo|redis|data pipeline|etl|spark|kafka|warehouse|analytics|bigquery|snowflake|dbt|airflow|data lake|streaming)\b/i },
  { cat: "web", re: /\b(react|next\.?js|vue|svelte|angular|css|html|javascript|typescript|node\.?js|deno|bun|browser|webpack|vite|tailwind|pwa|frontend|web.?dev|wasm|webassembly|ssr|ssg)\b/i },
  { cat: "systems", re: /\b(rust|golang|\bgo\b|linux|kernel|compiler|wasm|performance|networking|tcp|http|grpc|protocol|zig|c\+\+|memory|thread|concurren|async|ebpf|syscall)\b/i },
];

function isTechRelevant(title: string, tags: string[]): boolean {
  const text = `${title} ${tags.join(" ")}`;
  if (NEGATIVE_RE.test(text)) return false;
  return POSITIVE_RE.test(text);
}

function classify(title: string, tags: string[]): TechCategory {
  const text = `${title} ${tags.join(" ")}`;
  for (const { cat, re } of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return "web";
}

function timeAgo(unixSeconds: number): string {
  const mins = Math.floor((Date.now() - unixSeconds * 1000) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// ═════════════════════════════════════════════════════════════════════════════
// §4  DATA SOURCES
// ═════════════════════════════════════════════════════════════════════════════

interface RawItem {
  id: string;
  title: string;
  url: string;
  source: string;
  score: number;
  comments: number;
  tags: string[];
  timestamp: number;
}

// ─── Hacker News ─────────────────────────────────────────────────────────────
// Rotates: topstories → beststories → newstories

const HN = "https://hacker-news.firebaseio.com/v0";
const HN_ENDPOINTS = ["topstories", "beststories", "newstories"];

async function fetchHackerNews(cycle: number, seen: Set<string>): Promise<RawItem[]> {
  try {
    const endpoint = HN_ENDPOINTS[cycle % 3];
    const res = await fetch(`${HN}/${endpoint}.json`);
    if (!res.ok) return [];
    const ids: number[] = await res.json();

    const fresh = ids.filter((id) => !seen.has(`hn-${id}`)).slice(0, 50);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    const results = await Promise.allSettled(
      fresh.map((id) =>
        fetch(`${HN}/item/${id}.json`, { signal: ctrl.signal })
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );
    clearTimeout(timer);

    const items: RawItem[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const h = r.value;
      if (!h.url || !h.title || h.type === "poll") continue;
      try {
        items.push({
          id: `hn-${h.id}`,
          title: h.title,
          url: h.url,
          source: new URL(h.url).hostname.replace("www.", ""),
          score: h.score || 0,
          comments: h.descendants || 0,
          tags: [],
          timestamp: h.time || Math.floor(Date.now() / 1000),
        });
      } catch { /* invalid URL, skip */ }
      if (items.length >= 30) break;
    }
    return items;
  } catch {
    return [];
  }
}

// ─── Dev.to ──────────────────────────────────────────────────────────────────
// Rotates: top this week → top today → top this month

const DEVTO_WINDOWS = [7, 1, 30];

async function fetchDevto(cycle: number, seen: Set<string>): Promise<RawItem[]> {
  try {
    const top = DEVTO_WINDOWS[cycle % 3];
    const res = await fetch(`https://dev.to/api/articles?per_page=20&top=${top}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const articles: any[] = await res.json();

    return articles
      .filter((a: any) => !seen.has(`devto-${a.id}`))
      .map((a: any) => ({
        id: `devto-${a.id}`,
        title: a.title,
        url: a.url,
        source: "dev.to",
        score: a.positive_reactions_count || 0,
        comments: a.comments_count || 0,
        tags: a.tag_list || [],
        timestamp: Math.floor(new Date(a.published_at).getTime() / 1000),
      }));
  } catch {
    return [];
  }
}

// ─── Lobsters ────────────────────────────────────────────────────────────────

async function fetchLobsters(seen: Set<string>): Promise<RawItem[]> {
  try {
    const res = await fetch("https://lobste.rs/hottest.json");
    if (!res.ok) return [];
    const stories: any[] = await res.json();

    return stories
      .filter((s: any) => s.url && !seen.has(`lob-${s.short_id}`))
      .map((s: any) => ({
        id: `lob-${s.short_id}`,
        title: s.title,
        url: s.url,
        source: "lobste.rs",
        score: s.score || 0,
        comments: s.comment_count || 0,
        tags: s.tags || [],
        timestamp: Math.floor(new Date(s.created_at).getTime() / 1000),
      }));
  } catch {
    return [];
  }
}

// ─── Hashnode ────────────────────────────────────────────────────────────────

const HASHNODE_QUERY = `
  query {
    feed(first: 15, filter: { type: BEST }) {
      edges {
        node {
          id
          title
          brief
          url
          publishedAt
          reactionCount
          tags { name }
        }
      }
    }
  }
`;

async function fetchHashnode(seen: Set<string>): Promise<RawItem[]> {
  try {
    const res = await fetch("https://gql.hashnode.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: HASHNODE_QUERY }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const edges = json?.data?.feed?.edges || [];

    return edges
      .filter((e: any) => e.node?.url && !seen.has(`hn-node-${e.node.id}`))
      .map((e: any) => {
        const n = e.node;
        return {
          id: `hashnode-${n.id}`,
          title: n.title,
          url: n.url,
          source: "hashnode.com",
          score: n.reactionCount || 0,
          comments: 0,
          tags: (n.tags || []).map((t: any) => t.name),
          timestamp: Math.floor(new Date(n.publishedAt).getTime() / 1000),
        };
      });
  } catch {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §5  FALLBACK — one per category (last resort, ensures no empty tabs)
// ═════════════════════════════════════════════════════════════════════════════

const FALLBACK_NEWS: TechNewsItem[] = [
  {
    id: "fb-ai", category: "ai", headline: "How Large Language Models Are Reshaping Software Engineering",
    summary: "LLMs are becoming integral to code generation, review, and documentation workflows.",
    source: "github.blog", sourceUrl: "https://github.blog/ai-and-ml/github-copilot/", tags: ["AI", "LLM"],
    upvotes: 421, comments: 95, timeAgo: "1d ago", readTime: "5 min read",
  },
  {
    id: "fb-cloud", category: "cloud", headline: "AWS Lambda Now Supports 10GB Ephemeral Storage",
    summary: "Lambda functions can now use up to 10GB ephemeral storage for data processing workloads.",
    source: "aws.amazon.com", sourceUrl: "https://aws.amazon.com/blogs/compute/", tags: ["AWS", "Cloud"],
    upvotes: 198, comments: 45, timeAgo: "2d ago", readTime: "3 min read",
  },
  {
    id: "fb-devops", category: "devops", headline: "GitHub Actions: Advanced CI/CD Patterns for Monorepos",
    summary: "Efficient pipeline strategies for large-scale monorepo deployments.",
    source: "github.blog", sourceUrl: "https://github.blog/engineering/", tags: ["DevOps", "CI"],
    upvotes: 342, comments: 89, timeAgo: "1d ago", readTime: "4 min read",
  },
  {
    id: "fb-security", category: "security", headline: "OWASP Top 10 for LLM Applications Published",
    summary: "New security guidelines for large language model applications.",
    source: "owasp.org", sourceUrl: "https://owasp.org/www-project-top-10-for-large-language-model-applications/", tags: ["Security", "AI"],
    upvotes: 289, comments: 67, timeAgo: "1d ago", readTime: "5 min read",
  },
  {
    id: "fb-web", category: "web", headline: "React Server Components: A Complete Guide",
    summary: "Understanding the architecture and benefits of React Server Components.",
    source: "react.dev", sourceUrl: "https://react.dev/blog", tags: ["React", "Web"],
    upvotes: 567, comments: 123, timeAgo: "3d ago", readTime: "8 min read",
  },
  {
    id: "fb-data", category: "data", headline: "PostgreSQL 17: Performance Improvements and New Features",
    summary: "Major query optimizer improvements and JSON enhancements in the latest release.",
    source: "postgresql.org", sourceUrl: "https://www.postgresql.org/about/news/", tags: ["SQL", "Data"],
    upvotes: 356, comments: 72, timeAgo: "2d ago", readTime: "4 min read",
  },
  {
    id: "fb-systems", category: "systems", headline: "Rust 2024 Edition: What's New for Systems Programming",
    summary: "The latest Rust edition brings async improvements and better error handling.",
    source: "blog.rust-lang.org", sourceUrl: "https://blog.rust-lang.org/", tags: ["Rust", "Systems"],
    upvotes: 412, comments: 98, timeAgo: "2d ago", readTime: "6 min read",
  },
];

const FALLBACK_CAREER: CareerIntelItem[] = [
  {
    id: "fc-1", category: "trend", headline: "AI/ML Engineer Demand Surges 45% in 2026",
    summary: "Companies are rapidly hiring for applied AI roles as LLM adoption accelerates.",
    tags: ["AI", "Hiring"], timeAgo: "2h ago", readTime: "2 min read",
  },
  {
    id: "fc-2", category: "tip", headline: "Tailor Your Resume: 70% of Recruiters Use ATS Keyword Filters",
    summary: "Matching job description keywords can significantly improve your callback rate.",
    tags: ["Resume", "Tips"], timeAgo: "4h ago", readTime: "2 min read",
  },
  {
    id: "fc-3", category: "stat", headline: "85% of Tech Professionals Prefer Hybrid or Remote Roles",
    summary: "Remote work remains the top factor in job selection for software engineers.",
    tags: ["Remote", "Culture"], timeAgo: "6h ago", readTime: "1 min read",
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// §6  PIPELINE — fetch all sources, filter, rank, deduplicate
// ═════════════════════════════════════════════════════════════════════════════

const ALL_CATEGORIES: TechCategory[] = ["ai", "cloud", "devops", "security", "web", "data", "systems"];

function rawToTechNewsItem(raw: RawItem): TechNewsItem {
  const category = classify(raw.title, raw.tags);

  // Normalize tags using acronym-aware function
  let displayTags = raw.tags.slice(0, 2).map(normalizeTag);

  // If no tags (common with HN), inject the category as a tag
  if (displayTags.length === 0) {
    const catLabel: Record<string, string> = {
      ai: "AI", cloud: "Cloud", devops: "DevOps", security: "Security",
      web: "Web", data: "Data", systems: "Systems",
    };
    displayTags = [catLabel[category] || "Tech"];
  }

  return {
    id: raw.id,
    category,
    headline: raw.title,
    summary: "",
    source: raw.source,
    sourceUrl: raw.url,
    sourceIsSearch: false,
    tags: displayTags,
    upvotes: raw.score,
    comments: raw.comments,
    timeAgo: timeAgo(raw.timestamp),
    readTime: `${Math.max(2, Math.floor(raw.title.length / 30))} min read`,
  };
}

async function fetchAllNews(): Promise<TechNewsItem[]> {
  const cycle = getEffectiveCycle();
  const seen = getSeenIds();

  // Fetch all 4 sources in parallel
  const [hn, devto, lobsters, hashnode] = await Promise.allSettled([
    fetchHackerNews(cycle, seen),
    fetchDevto(cycle, seen),
    fetchLobsters(seen),
    fetchHashnode(seen),
  ]);

  // Merge all results
  const allRaw: RawItem[] = [];
  for (const result of [hn, devto, lobsters, hashnode]) {
    if (result.status === "fulfilled") allRaw.push(...result.value);
  }

  if (allRaw.length === 0) return FALLBACK_NEWS;

  // Filter for tech-relevance
  const relevant = allRaw.filter((r) => isTechRelevant(r.title, r.tags));

  // Deduplicate by URL domain+path
  const urlSet = new Set<string>();
  const deduped = relevant.filter((r) => {
    try {
      const u = new URL(r.url);
      const key = `${u.hostname}${u.pathname}`;
      if (urlSet.has(key)) return false;
      urlSet.add(key);
      return true;
    } catch { return true; }
  });

  // Convert to TechNewsItem with categories
  const allItems = deduped.map((r) => ({
    item: rawToTechNewsItem(r),
    rankScore: (r.score + r.comments * 2) * (0.85 + Math.random() * 0.3),
  }));

  // ─── Category-diverse selection ─────────────────────────────────────────
  // Step 1: Pick the best item from EACH category (guarantees coverage)
  const selected: TechNewsItem[] = [];
  const usedIds = new Set<string>();

  for (const cat of ALL_CATEGORIES) {
    const catItems = allItems
      .filter((x) => x.item.category === cat && !usedIds.has(x.item.id))
      .sort((a, b) => b.rankScore - a.rankScore);

    if (catItems.length > 0) {
      selected.push(catItems[0].item);
      usedIds.add(catItems[0].item.id);
    }
  }

  // Step 2: Fill remaining slots with highest-scored items across all categories
  const remaining = allItems
    .filter((x) => !usedIds.has(x.item.id))
    .sort((a, b) => b.rankScore - a.rankScore);

  for (const r of remaining) {
    if (selected.length >= MAX_NEWS_ITEMS) break;
    selected.push(r.item);
  }

  // Step 3: For any category still empty, inject its fallback item
  const coveredCats = new Set(selected.map((s) => s.category));
  for (const fb of FALLBACK_NEWS) {
    if (!coveredCats.has(fb.category)) {
      selected.push(fb);
      coveredCats.add(fb.category);
    }
  }

  // Track seen IDs
  addSeenIds(selected.map((t) => t.id));

  return selected;
}

// ═════════════════════════════════════════════════════════════════════════════
// §7  CAREER INTEL — fetched from backend (Gemini via Lambda)
// ═════════════════════════════════════════════════════════════════════════════

async function fetchCareerIntel(): Promise<CareerIntelItem[]> {
  try {
    const resp = await apiService.getTechChronicle("all");
    if (resp.data?.items) {
      // Extract only career items from backend response
      const career = resp.data.items.filter(
        (i: any) => i.category === "trend" || i.category === "tip" || i.category === "stat"
      ) as CareerIntelItem[];
      if (career.length > 0) return career;
    }
  } catch { /* backend unavailable */ }
  return FALLBACK_CAREER;
}

// ═════════════════════════════════════════════════════════════════════════════
// §8  TRENDING TAGS — extracted from all items
// ═════════════════════════════════════════════════════════════════════════════

// Known acronyms/abbreviations that should keep their uppercase form
const ACRONYMS = new Set([
  "AI", "ML", "API", "AWS", "GCP", "CSS", "HTML", "JS", "TS",
  "SQL", "CLI", "CI", "CD", "UI", "UX", "SSH", "SSL", "TLS",
  "DNS", "TCP", "HTTP", "GPU", "CPU", "RAM", "SSD", "NLP",
  "LLM", "GPT", "SRE", "K8S", "IAM", "VPC", "CDN", "JWT",
  "OAuth", "GraphQL", "NoSQL", "DevOps", "GitHub", "GitLab",
  "TypeScript", "JavaScript", "PostgreSQL", "MySQL", "MongoDB",
  "WebAssembly", "WASM", "Docker", "Linux", "React", "NextJS",
  "NodeJS", "Python", "Rust", "Golang",
]);

function normalizeTag(tag: string): string {
  const upper = tag.toUpperCase();
  // Check if it's a known acronym (case-insensitive match)
  for (const acr of ACRONYMS) {
    if (acr.toUpperCase() === upper) return acr;
  }
  // Default: capitalize first letter, lowercase rest
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
}

function extractTrendingTags(items: TechChronicleItem[]): string[] {
  const tagCount = new Map<string, number>();
  const tagDisplay = new Map<string, string>(); // lowercase → display form
  for (const item of items) {
    for (const tag of item.tags || []) {
      const key = tag.toLowerCase();
      const display = normalizeTag(tag);
      tagCount.set(key, (tagCount.get(key) || 0) + 1);
      tagDisplay.set(key, display);
    }
  }
  return [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key]) => tagDisplay.get(key) || key);
}

// ═════════════════════════════════════════════════════════════════════════════
// §9  REACT HOOK — useTechChronicleFeed
// ═════════════════════════════════════════════════════════════════════════════

export function useTechChronicleFeed() {
  const [items, setItems] = useState<TechChronicleItem[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Check localStorage cache first (instant, 0ms)
      if (!isRefresh) {
        const cachedNews = getCachedItems<TechNewsItem>("tc_news_items", "tc_news_ts", NEWS_TTL);
        const cachedCareer = getCachedItems<CareerIntelItem>("tc_career_items", "tc_career_ts", CAREER_TTL);
        if (cachedNews && cachedCareer) {
          const all = [...cachedNews.items, ...cachedCareer.items];
          setItems(all);
          setTrendingTags(extractTrendingTags(all));
          setGeneratedAt(cachedNews.ts);
          setLoading(false);
          return;
        }
      }

      // Fetch news (client-side) and career (backend) in parallel
      const [news, career] = await Promise.all([
        fetchAllNews(),
        // For career: also use cache if not refreshing
        (async () => {
          if (!isRefresh) {
            const cached = getCachedItems<CareerIntelItem>("tc_career_items", "tc_career_ts", CAREER_TTL);
            if (cached) return cached.items;
          }
          return fetchCareerIntel();
        })(),
      ]);

      // Cache the results
      setCachedItems("tc_news_items", "tc_news_ts", news);
      setCachedItems("tc_career_items", "tc_career_ts", career);

      const all: TechChronicleItem[] = [...news, ...career];
      setItems(all);
      setTrendingTags(extractTrendingTags(all));
      setGeneratedAt(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feed");
      // Use fallback content on error
      const fallbackAll: TechChronicleItem[] = [...FALLBACK_NEWS, ...FALLBACK_CAREER];
      setItems(fallbackAll);
      setTrendingTags(extractTrendingTags(fallbackAll));
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  // Manual refresh: advance cycle to get different content
  const refresh = useCallback(async () => {
    // Clear news cache + advance rotation cycle
    lsDel("tc_news_items");
    lsDel("tc_news_ts");
    advanceCycle();
    await loadFeed(true);
  }, [loadFeed]);

  // Initial load
  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Auto-refresh every 4 hours
  useEffect(() => {
    const interval = setInterval(() => {
      lsDel("tc_news_items");
      lsDel("tc_news_ts");
      loadFeed(true);
    }, NEWS_TTL);
    return () => clearInterval(interval);
  }, [loadFeed]);

  return { items, trendingTags, generatedAt, loading, refreshing, error, refresh };
}
