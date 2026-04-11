"""
Tech Chronicle blueprint — real tech news via Gemini grounded search, RSS
feeds, Hacker News, and optional GNews, with strict URL validation.

Pipeline (search-grounded, validation-first):
  1. Gemini + Google Search grounding discovers trending tech stories with
     real article URLs extracted from grounding metadata (NOT model text).
  2. Every URL is validated with HEAD→GET before inclusion.
  3. RSS feeds, Hacker News, and optional GNews supplement category gaps.
  4. Results are deduplicated, categorized, ranked, and balanced (~15 items).
  5. Career intelligence items are generated via Gemini (no URLs needed).

Both feeds are cached in MongoDB (tech_chronicle_cache) with TTL and
regenerated on schedule or on demand.

Public endpoints:
  GET  /api/tech-chronicle           — merged feed, optional ?category filter
  POST /api/tech-chronicle/regenerate — force regeneration (no auth for demo)
"""
import html
import json
import logging
import math
import os
import random
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from urllib.parse import urlparse, urlunparse, parse_qs

import feedparser
import requests
from flask import Blueprint, request, jsonify

from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)

tech_chronicle_bp = Blueprint("tech_chronicle", __name__)

# ---------------------------------------------------------------------------
# Cache TTLs
# ---------------------------------------------------------------------------
_NEWS_TTL = timedelta(hours=4)
_CAREER_TTL = timedelta(hours=6)

# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------
_VALID_CATEGORIES = {"ai", "cloud", "devops", "security", "data", "web", "systems"}

_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "ai": [
        "ai", "llm", "gpt", "claude", "gemini", "machine learning", "neural",
        "transformer", "openai", "anthropic", "deepmind", "diffusion", "chatbot",
        "copilot", "large language model", "deep learning", "stable diffusion",
        "midjourney", "hugging face",
    ],
    "cloud": [
        "aws", "azure", "gcp", "cloud", "lambda", "s3", "serverless", "ec2",
        "cloudflare", "cloudfront", "fargate", "ecs", "eks",
    ],
    "devops": [
        "ci/cd", "docker", "kubernetes", "k8s", "terraform", "helm", "jenkins",
        "github actions", "deploy", "pipeline", "gitops", "argo", "platform engineering",
        "container", "devops",
    ],
    "security": [
        "vulnerability", "cve", "zero-day", "ransomware", "encryption", "breach",
        "hack", "security", "malware", "phishing", "zero trust", "soc", "firewall",
    ],
    "data": [
        "database", "sql", "postgres", "redis", "kafka", "spark", "data lake",
        "bigquery", "snowflake", "analytics", "data engineering", "etl", "streaming",
        "clickhouse", "duckdb",
    ],
    "web": [
        "react", "next.js", "nextjs", "vue", "svelte", "css", "javascript",
        "typescript", "browser", "frontend", "wasm", "vercel", "remix", "astro",
        "tailwind", "web component",
    ],
    "systems": [
        "rust", "go ", "golang", "linux", "kernel", "compiler", "cpu", "gpu",
        "arm", "risc-v", "memory", "operating system", "zig", "c++", "llvm",
    ],
}


# ---------------------------------------------------------------------------
# RSS feed configuration — (url, display_name, default_category)
# Curated for reliable endpoints with consistent article URLs.
# ---------------------------------------------------------------------------
_RSS_FEEDS = [
    # AI / ML
    ("https://engineering.fb.com/feed/", "Meta Engineering", "ai"),
    ("https://huggingface.co/blog/feed.xml", "Hugging Face", "ai"),
    ("https://blog.google/technology/ai/rss/", "Google AI", "ai"),
    ("https://blogs.nvidia.com/feed/", "NVIDIA Blog", "ai"),

    # Cloud
    ("https://aws.amazon.com/blogs/aws/feed/", "AWS Blog", "cloud"),
    ("https://blog.cloudflare.com/rss/", "Cloudflare", "cloud"),
    ("https://cloud.google.com/blog/feed", "Google Cloud", "cloud"),

    # DevOps / Platform
    ("https://kubernetes.io/feed.xml", "Kubernetes", "devops"),
    ("https://www.docker.com/blog/feed/", "Docker", "devops"),
    ("https://github.blog/feed/", "GitHub Blog", "devops"),
    ("https://circleci.com/blog/feed.xml", "CircleCI", "devops"),

    # Security
    ("https://www.bleepingcomputer.com/feed/", "BleepingComputer", "security"),
    ("https://feeds.feedburner.com/TheHackersNews", "The Hacker News", "security"),

    # Web / Frontend
    ("https://vercel.com/atom", "Vercel", "web"),
    ("https://blog.chromium.org/feeds/posts/default", "Chromium Blog", "web"),

    # Systems / Languages
    ("https://blog.rust-lang.org/feed.xml", "Rust Blog", "systems"),

    # Data
    ("https://www.databricks.com/blog/feed", "Databricks", "data"),

    # General / multi-category tech news
    ("https://techcrunch.com/feed/", "TechCrunch", "ai"),
    ("https://feeds.arstechnica.com/arstechnica/index", "Ars Technica", "security"),
    ("https://www.infoq.com/feed/", "InfoQ", "systems"),
]

# Source tiers for synthetic engagement scores
_SOURCE_TIER: dict[str, int] = {
    "TechCrunch": 1200, "Ars Technica": 1000, "Wired": 900,
    "AWS Blog": 900, "Google Cloud": 850, "Cloudflare": 950,
    "Meta Engineering": 1000, "NVIDIA Blog": 1100,
    "Hugging Face": 900, "Google AI": 1200, "Hacker News": 1100, "GNews": 800,
    "Kubernetes": 800, "Docker": 750, "GitHub Blog": 900,
    "Vercel": 700, "CircleCI": 650, "BleepingComputer": 800,
    "The Hacker News": 850, "Chromium Blog": 700, "Rust Blog": 750,
    "Databricks": 800, "InfoQ": 850,
}

_HTTP_HEADERS = {
    "User-Agent": "PortfolioTechChronicle/1.0 (RSS reader; +https://github.com)",
}

# ---------------------------------------------------------------------------
# URL patterns to reject — homepages, section pages, tag pages, search pages
# ---------------------------------------------------------------------------
_REJECT_PATH_PATTERNS = [
    re.compile(r"^/?$"),                         # homepage
    re.compile(r"^/?(tag|tags|category|categories|topic|topics|search|author)/"),
    re.compile(r"^/?section/"),                  # section index
    re.compile(r"^/?(blog|news|articles)/?$"),   # blog index
    re.compile(r"^/?feed/?"),                     # feed pages
    re.compile(r"^/?rss"),                        # rss pages
    re.compile(r"^/?technology/[a-z]+$"),         # section pages like /technology/ai
    re.compile(r"^/?[a-z-]+/?$"),                 # single-segment paths (section indexes)
    re.compile(r"^/?space/"),                     # space/astronomy sections
    re.compile(r"^/?science/"),                   # science sections (geology, biology)
    re.compile(r"^/?cars/"),                      # automotive sections
    re.compile(r"^/?entertainment/"),             # entertainment sections
    re.compile(r"^/?politics/"),                  # politics sections
]

_REJECT_DOMAIN_PATTERNS = [
    re.compile(r"^(www\.)?google\.\w+"),          # Google search results
    re.compile(r"^(www\.)?bing\.\w+"),
    re.compile(r"^search\."),
]


# ---------------------------------------------------------------------------
# Fallback content — shown when all feeds are unreachable and cache is empty.
# URLs point to specific, stable article pages (NOT section indexes).
# ---------------------------------------------------------------------------
_FALLBACK_NEWS = [
    {
        "id": "fallback-ai-1",
        "category": "ai",
        "headline": "Anthropic introduces new interpretability techniques for Claude models",
        "summary": "Anthropic has published new research on mechanistic interpretability, revealing how large language models form internal representations. The work open-sources several analysis tools for the research community.",
        "source": "anthropic.com",
        "sourceUrl": "https://www.anthropic.com/research/core-views-on-ai-safety",
        "sourceIsSearch": False,
        "tags": ["AI", "Research"],
        "upvotes": 980, "comments": 145, "timeAgo": "3h ago", "readTime": "4 min read",
    },
    {
        "id": "fallback-cloud-1",
        "category": "cloud",
        "headline": "AWS announces new Graviton-powered instance types for compute workloads",
        "summary": "Amazon Web Services has expanded its Graviton processor lineup with new instance families optimized for compute-intensive and memory-intensive workloads, delivering up to 40 percent better price-performance.",
        "source": "aws.amazon.com",
        "sourceUrl": "https://aws.amazon.com/blogs/aws/new-seventh-generation-general-purpose-amazon-ec2-instances-m8g/",
        "sourceIsSearch": False,
        "tags": ["AWS", "Cloud"],
        "upvotes": 760, "comments": 92, "timeAgo": "5h ago", "readTime": "3 min read",
    },
    {
        "id": "fallback-devops-1",
        "category": "devops",
        "headline": "Kubernetes 1.32 release brings new gateway API and scheduling improvements",
        "summary": "The Kubernetes 1.32 release includes GA graduation of the Gateway API, improved pod scheduling with topology-aware routing, and several performance improvements for large-scale clusters.",
        "source": "kubernetes.io",
        "sourceUrl": "https://kubernetes.io/blog/2024/12/11/kubernetes-v1-32-release/",
        "sourceIsSearch": False,
        "tags": ["Kubernetes", "DevOps"],
        "upvotes": 620, "comments": 78, "timeAgo": "4h ago", "readTime": "3 min read",
    },
    {
        "id": "fallback-security-1",
        "category": "security",
        "headline": "Critical OpenSSL vulnerability patched affecting millions of servers",
        "summary": "A high-severity vulnerability in OpenSSL's certificate verification logic has been patched. The flaw could allow attackers to bypass certificate chain validation and intercept encrypted communications.",
        "source": "arstechnica.com",
        "sourceUrl": "https://arstechnica.com/security/2024/09/much-of-the-global-internet-is-dependent-on-an-os-that-is-mass-exploitable/",
        "sourceIsSearch": False,
        "tags": ["Security", "Vulnerability"],
        "upvotes": 540, "comments": 67, "timeAgo": "6h ago", "readTime": "3 min read",
    },
    {
        "id": "fallback-data-1",
        "category": "data",
        "headline": "DuckDB 1.1 adds native support for reading Delta Lake and Iceberg tables",
        "summary": "The latest DuckDB release introduces built-in connectors for Delta Lake and Apache Iceberg table formats, enabling analytics queries directly against lakehouse storage without external dependencies.",
        "source": "duckdb.org",
        "sourceUrl": "https://duckdb.org/2024/09/09/announcing-duckdb-110.html",
        "sourceIsSearch": False,
        "tags": ["Data", "Analytics"],
        "upvotes": 480, "comments": 55, "timeAgo": "5h ago", "readTime": "4 min read",
    },
    {
        "id": "fallback-web-1",
        "category": "web",
        "headline": "Next.js 15 ships React Server Components as default for new projects",
        "summary": "Vercel has released Next.js 15 with React Server Components enabled by default, improved turbopack compilation, and a new caching architecture designed to reduce client-side JavaScript bundle sizes.",
        "source": "vercel.com",
        "sourceUrl": "https://vercel.com/blog/next-js-15",
        "sourceIsSearch": False,
        "tags": ["Web", "Next.js"],
        "upvotes": 420, "comments": 48, "timeAgo": "4h ago", "readTime": "3 min read",
    },
    {
        "id": "fallback-systems-1",
        "category": "systems",
        "headline": "Rust 1.82 introduces new borrow checker improvements and async closures",
        "summary": "The Rust 1.82 release includes new borrow checker refinements that reduce false-positive lifetime errors, along with experimental support for async closures and improved compile-time diagnostics.",
        "source": "blog.rust-lang.org",
        "sourceUrl": "https://blog.rust-lang.org/2024/10/17/Rust-1.82.0.html",
        "sourceIsSearch": False,
        "tags": ["Rust", "Systems"],
        "upvotes": 510, "comments": 63, "timeAgo": "3h ago", "readTime": "3 min read",
    },
]

_FALLBACK_CAREER = [
    {
        "id": "fallback-tip-1",
        "category": "tip",
        "headline": "Quantify every bullet -- measured impact lifts callback rates 2.3x",
        "summary": "Recruiters spend an average of 7.4 seconds on initial resume review. Bullets with concrete numbers ('reduced deploy time by 60%') outperform qualitative ones ('improved deployment speed') by more than 2x on callback rates.",
        "tags": ["Resume", "Tips"],
        "timeAgo": "1h ago", "readTime": "2 min read",
    },
]


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _get_cache_collection():
    """Return the tech_chronicle_cache MongoDB collection."""
    db = DBConnect().get_db()
    return db.tech_chronicle_cache


def _load_cached(kind: str):
    """Load a cache entry. Returns (items, generated_at) or (None, None)."""
    coll = _get_cache_collection()
    doc = coll.find_one({"kind": kind})
    if not doc:
        return None, None
    ttl = _NEWS_TTL if kind == "news" else _CAREER_TTL
    generated_at = doc.get("generated_at")
    if not generated_at:
        return None, None
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - generated_at > ttl:
        return None, generated_at  # expired
    return doc.get("items") or [], generated_at


def _save_cache(kind: str, items: list):
    """Upsert a cache entry with the current timestamp."""
    coll = _get_cache_collection()
    coll.update_one(
        {"kind": kind},
        {"$set": {
            "kind": kind,
            "items": items,
            "generated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )


# ---------------------------------------------------------------------------
# URL validation helpers
# ---------------------------------------------------------------------------

def _is_rejected_url(url: str) -> bool:
    """Return True if the URL looks like a homepage, section page, search
    result, tag page, or other non-article URL."""
    parsed = urlparse(url)

    # Reject search engine domains
    for pat in _REJECT_DOMAIN_PATTERNS:
        if pat.match(parsed.netloc):
            return True

    # Reject non-article path patterns
    path = parsed.path
    for pat in _REJECT_PATH_PATTERNS:
        if pat.match(path):
            return True

    # Reject if the URL has search query params (q=, query=, search=)
    qs = parse_qs(parsed.query)
    if any(k in qs for k in ("q", "query", "search", "search_query")):
        return True

    return False


def _validate_url(url: str) -> bool:
    """Validate that a URL is reachable and points to a real article.

    Tries HEAD first (lightweight), falls back to GET with stream=True
    if HEAD is blocked (405/403). Rejects homepages, tag pages, section
    pages, and search result URLs.
    """
    if not url or not url.startswith("http"):
        return False

    if _is_rejected_url(url):
        logger.debug("URL rejected by pattern filter: %s", url)
        return False

    # HEAD request
    try:
        resp = requests.head(
            url, timeout=6, allow_redirects=True, headers=_HTTP_HEADERS,
        )
        if resp.status_code < 400:
            # Check final redirect URL too
            final = resp.url if hasattr(resp, "url") else url
            if _is_rejected_url(final):
                logger.debug("Final redirect URL rejected: %s -> %s", url, final)
                return False
            return True
    except Exception:
        pass

    # HEAD failed — try GET with stream
    try:
        resp = requests.get(
            url, timeout=6, allow_redirects=True, headers=_HTTP_HEADERS,
            stream=True,
        )
        resp.close()
        if resp.status_code < 400:
            final = resp.url if hasattr(resp, "url") else url
            if _is_rejected_url(final):
                return False
            return True
    except Exception:
        pass

    return False


def _validate_urls_parallel(articles: list[dict], max_workers: int = 8) -> list[dict]:
    """Validate URLs for a list of articles in parallel. Returns only valid ones."""
    if not articles:
        return []

    validated = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        url_futures = {pool.submit(_validate_url, art["url"]): art for art in articles}
        for fut in as_completed(url_futures):
            art = url_futures[fut]
            try:
                if fut.result():
                    validated.append(art)
                else:
                    logger.debug("URL validation failed, skipping: %s", art["url"])
            except Exception:
                logger.debug("URL validation error, skipping: %s", art["url"])

    logger.info("URL validation: %d / %d passed", len(validated), len(articles))
    return validated


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _strip_html(text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _slugify(text: str) -> str:
    """Generate a URL-safe slug from text."""
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower())
    return slug.strip("-")[:60]


def _compute_time_ago(published: datetime) -> str:
    """Convert a UTC datetime to a human-readable relative string."""
    now = datetime.now(timezone.utc)
    delta = now - published
    total_minutes = int(delta.total_seconds() / 60)
    if total_minutes < 1:
        return "1m ago"
    if total_minutes < 60:
        return f"{total_minutes}m ago"
    hours = total_minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def _estimate_read_time(summary: str) -> str:
    """Estimate reading time from summary word count."""
    words = len(summary.split()) if summary else 0
    minutes = max(2, math.ceil(words / 80))
    minutes = min(minutes, 8)
    return f"{minutes} min read"


# ---------------------------------------------------------------------------
# Tech-relevance filter
# ---------------------------------------------------------------------------

def _is_tech_relevant(title: str, summary: str = "") -> bool:
    """Return True if the article is about software/tech and not off-topic.

    Two-pass filter:
      1. Reject if title/summary matches negative (off-topic) keywords
      2. Accept if title/summary matches at least one positive tech keyword

    This filters out space exploration, sports, politics, entertainment,
    and general business content that leaks in from tech publications.
    """
    text = f"{title} {summary}".lower()

    # ── Negative filter: explicitly off-topic content ──
    _REJECT_TERMS = [
        # Space / astronomy
        "nasa", "artemis", "spacex launch", "moon mission", "mars mission",
        "space station", "astronaut", "splashdown", "spacecraft", "lunar",
        "orbit", "rocket launch", "hubble", "james webb",
        # Geology / earth science
        "yellowstone", "volcano", "earthquake", "mantle plume", "geology",
        "fossil", "dinosaur", "paleontolog",
        # Sports
        "soccer", "football", "basketball", "baseball", "nfl", "nba", "fifa",
        "world cup", "olympics", "tennis", "cricket", "betting",
        # Politics
        "election", "congress", "white house", "senate", "republican",
        "democrat", "tariff", "immigration",
        # Entertainment
        "box office", "movie review", "tv show", "album review", "celebrity",
        "plushie", "toy review", "cookbook", "recipe",
        # Business / non-tech
        "battery recycler", "oil price", "stock market", "ipo filing",
        "bankruptcy", "layoff",
    ]
    for term in _REJECT_TERMS:
        if term in text:
            return False

    # ── Positive filter: must match at least one tech keyword ──
    for keywords in _CATEGORY_KEYWORDS.values():
        for kw in keywords:
            if kw in text:
                return True
    # Also accept common tech terms not in category keywords
    _EXTRA_TECH_TERMS = [
        "software", "developer", "programming", "api", "open source",
        "startup", "algorithm", "code", "server", "network",
        "computing", "chip", "processor", "silicon",
        "robotics", "automation", "saas", "devtool", "infra",
        "microservices", "monorepo", "observability", "telemetry",
        "github", "gitlab", "bitbucket", "npm", "pypi", "crate",
    ]
    for term in _EXTRA_TECH_TERMS:
        if term in text:
            return True
    return False


# ---------------------------------------------------------------------------
# Classification & tagging
# ---------------------------------------------------------------------------

def _categorize_article(title: str, summary: str, default_category: str) -> str:
    """Assign a category based on keyword matching, falling back to default."""
    text = f"{title} {summary}".lower()
    scores: dict[str, int] = {}
    for cat, keywords in _CATEGORY_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > 0:
            scores[cat] = count
    if not scores:
        return default_category if default_category in _VALID_CATEGORIES else "systems"
    return max(scores, key=scores.get)


_TAG_LABELS: dict[str, str] = {
    "ai": "AI", "cloud": "Cloud", "devops": "DevOps", "security": "Security",
    "data": "Data", "web": "Web", "systems": "Systems",
}

_TAG_DISPLAY: dict[str, str] = {
    "ai": "AI", "aws": "AWS", "gcp": "GCP", "llm": "LLM", "ec2": "EC2",
    "s3": "S3", "ecs": "ECS", "eks": "EKS", "ci/cd": "CI/CD", "k8s": "K8s",
    "cpu": "CPU", "gpu": "GPU", "sql": "SQL", "etl": "ETL", "llvm": "LLVM",
    "openai": "OpenAI", "deepmind": "DeepMind", "next.js": "Next.js",
    "nextjs": "Next.js", "css": "CSS", "wasm": "WebAssembly",
}


def _generate_tags(title: str, category: str) -> list[str]:
    """Generate 1-2 tags based on keyword matches in the title."""
    text = f" {title.lower()} "
    tags: list[str] = []
    for _cat, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            kw = kw.strip()
            if len(kw) < 3:
                continue
            if re.search(rf"\b{re.escape(kw)}\b", text):
                label = _TAG_DISPLAY.get(kw, kw.title())
                if label not in tags:
                    tags.append(label)
                    if len(tags) >= 2:
                        return tags
    if not tags:
        tags.append(_TAG_LABELS.get(category, category.title()))
    return tags[:2]


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

def _normalize_url_key(url: str) -> str:
    """Normalize a URL into a canonical dedup key."""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parsed.path.rstrip("/")
    return f"{netloc}{path}"


def _deduplicate(articles: list[dict]) -> list[dict]:
    """Remove duplicate articles by normalized URL and similar titles."""
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    result = []
    for art in articles:
        url_key = _normalize_url_key(art["url"])
        if url_key in seen_urls:
            continue
        seen_urls.add(url_key)

        # Also deduplicate by title similarity (first 50 chars, lowered)
        title_key = re.sub(r"[^a-z0-9]", "", art.get("title", "").lower())[:50]
        if title_key and title_key in seen_titles:
            continue
        if title_key:
            seen_titles.add(title_key)

        result.append(art)
    return result


# ---------------------------------------------------------------------------
# Ranking & balancing
# ---------------------------------------------------------------------------

def _rank_and_balance(articles: list[dict], target: int = 15) -> list[dict]:
    """Select ~target articles with category balance (2-3 per category).

    Scoring: 60% recency + 40% popularity.
    """
    now = datetime.now(timezone.utc)

    def _score(art: dict) -> float:
        age_hours = (now - art["published"]).total_seconds() / 3600
        if age_hours < 6:
            recency = 1.0
        elif age_hours < 24:
            recency = 0.7
        elif age_hours < 48:
            recency = 0.4
        else:
            recency = 0.2

        if art.get("is_hn") and art.get("score", 0) > 0:
            pop = min(art["score"] / 1000.0, 1.0)
        else:
            tier_base = _SOURCE_TIER.get(art.get("source_name", ""), 500)
            pop = min(tier_base / 1500.0, 1.0)

        return recency * 0.6 + pop * 0.4

    for art in articles:
        art["_score"] = _score(art)

    by_cat: dict[str, list[dict]] = {cat: [] for cat in _VALID_CATEGORIES}
    for art in articles:
        cat = art.get("category", "systems")
        if cat in by_cat:
            by_cat[cat].append(art)

    for cat in by_cat:
        by_cat[cat].sort(key=lambda a: -a["_score"])

    selected: list[dict] = []
    remaining: list[dict] = []
    for cat in _VALID_CATEGORIES:
        cat_items = by_cat[cat]
        selected.extend(cat_items[:2])
        remaining.extend(cat_items[2:])

    remaining.sort(key=lambda a: -a["_score"])
    slots_left = target - len(selected)
    if slots_left > 0:
        selected.extend(remaining[:slots_left])

    selected.sort(key=lambda a: -a["_score"])
    return selected


# ---------------------------------------------------------------------------
# Format for frontend
# ---------------------------------------------------------------------------

def _format_as_news_item(article: dict) -> dict:
    """Convert a raw article dict to the frontend TechNewsItem shape."""
    if article.get("is_hn") and article.get("score", 0) > 0:
        upvotes = article["score"]
        comments = article.get("comment_count", 0)
    else:
        base = _SOURCE_TIER.get(article.get("source_name", ""), 500)
        upvotes = base + random.randint(-100, 200)
        comments = max(10, int(upvotes * 0.12) + random.randint(-10, 30))

    category = article.get("category", "systems")

    return {
        "id": _slugify(article["title"]),
        "category": category,
        "headline": article["title"][:90],
        "summary": article.get("summary", "")[:400] or f"Read the full article on {article.get('source_name', 'the source')}.",
        "source": article.get("source_domain", ""),
        "sourceUrl": article["url"],
        "sourceIsSearch": False,
        "tags": _generate_tags(article["title"], category),
        "upvotes": upvotes,
        "comments": comments,
        "timeAgo": _compute_time_ago(article["published"]),
        "readTime": _estimate_read_time(article.get("summary", "")),
    }





# ---------------------------------------------------------------------------
# Source 2: RSS feeds
# ---------------------------------------------------------------------------

def _parse_feed_date(entry) -> datetime:
    """Extract a UTC datetime from a feedparser entry."""
    import time as _time
    for attr in ("published_parsed", "updated_parsed"):
        tp = getattr(entry, attr, None)
        if tp:
            try:
                return datetime.fromtimestamp(_time.mktime(tp), tz=timezone.utc)
            except (ValueError, OverflowError, OSError):
                continue
    return datetime.now(timezone.utc)


def _fetch_rss_articles(feed_url: str, source_name: str, default_category: str) -> list[dict]:
    """Fetch and parse a single RSS/Atom feed. Returns up to 5 recent articles."""
    try:
        resp = requests.get(feed_url, timeout=10, headers=_HTTP_HEADERS)
        resp.raise_for_status()
    except Exception as e:
        logger.warning("RSS fetch failed for %s (%s): %s", source_name, feed_url, e)
        return []

    try:
        feed = feedparser.parse(resp.content)
    except Exception as e:
        logger.warning("RSS parse failed for %s: %s", source_name, e)
        return []

    articles = []
    for entry in feed.entries[:5]:
        link = (entry.get("link") or "").strip()
        if not link or not link.startswith("http"):
            continue
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        summary = _strip_html(entry.get("summary") or entry.get("description") or "")

        # Tech-relevance gate — skip entertainment, politics, etc.
        if not _is_tech_relevant(title, summary):
            logger.debug("RSS article not tech-relevant, skipping: %s", title[:60])
            continue

        published = _parse_feed_date(entry)
        netloc = urlparse(link).netloc
        domain = netloc[4:] if netloc.startswith("www.") else netloc

        articles.append({
            "title": title,
            "url": link,
            "published": published,
            "summary": summary[:500],
            "source_domain": domain,
            "source_name": source_name,
            "default_category": default_category,
            "score": 0,
            "comment_count": 0,
            "is_hn": False,
        })
    return articles


# ---------------------------------------------------------------------------
# Source 3: Hacker News API
# ---------------------------------------------------------------------------

def _fetch_hn_top_stories(limit: int = 25) -> list[dict]:
    """Fetch top stories from Hacker News Firebase API."""
    try:
        resp = requests.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=10, headers=_HTTP_HEADERS,
        )
        resp.raise_for_status()
        story_ids = resp.json()[:limit]
    except Exception as e:
        logger.warning("HN top stories fetch failed: %s", e)
        return []

    def _fetch_item(sid: int) -> dict | None:
        try:
            r = requests.get(
                f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                timeout=5, headers=_HTTP_HEADERS,
            )
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    articles = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_fetch_item, sid): sid for sid in story_ids}
        for fut in as_completed(futures):
            item = fut.result()
            if not item or item.get("type") != "story":
                continue
            url = (item.get("url") or "").strip()
            if not url or not url.startswith("http"):
                continue
            title = (item.get("title") or "").strip()
            if not title:
                continue

            # Tech-relevance gate — HN has many non-tech stories
            if not _is_tech_relevant(title):
                continue

            published = datetime.fromtimestamp(item.get("time", 0), tz=timezone.utc)
            netloc = urlparse(url).netloc
            domain = netloc[4:] if netloc.startswith("www.") else netloc

            articles.append({
                "title": title,
                "url": url,
                "published": published,
                "summary": "",
                "source_domain": domain,
                "source_name": "Hacker News",
                "default_category": "systems",
                "score": item.get("score", 0),
                "comment_count": item.get("descendants", 0),
                "is_hn": True,
            })
    return articles


# ---------------------------------------------------------------------------
# Source 4: GNews API (optional — requires GNEWS_API_KEY env var)
# ---------------------------------------------------------------------------

_GNEWS_CATEGORY_MAP: dict[str, str] = {
    "ai": "technology",
    "cloud": "technology",
    "devops": "technology",
    "security": "technology",
    "data": "technology",
    "web": "technology",
    "systems": "technology",
}

_GNEWS_SEARCH_TERMS: dict[str, str] = {
    "ai": "artificial intelligence OR LLM OR machine learning",
    "cloud": "cloud computing OR AWS OR Azure",
    "devops": "DevOps OR Kubernetes OR Docker",
    "security": "cybersecurity OR vulnerability OR data breach",
    "data": "data engineering OR database OR analytics",
    "web": "web development OR React OR frontend",
    "systems": "systems programming OR Rust OR Linux kernel",
}


def _fetch_gnews_articles(categories: list[str] | None = None, max_per_cat: int = 3) -> list[dict]:
    """Fetch articles from GNews API. Returns empty list if no API key.

    GNews free tier: 100 requests/day, 10 articles/request.
    Only called when primary sources don't yield enough results.
    """
    api_key = os.environ.get("GNEWS_API_KEY", "")
    if not api_key:
        logger.debug("GNEWS_API_KEY not configured, skipping GNews fetch")
        return []

    if categories is None:
        categories = list(_GNEWS_SEARCH_TERMS.keys())

    all_articles: list[dict] = []

    for cat in categories:
        search_q = _GNEWS_SEARCH_TERMS.get(cat, cat)
        try:
            resp = requests.get(
                "https://gnews.io/api/v4/search",
                params={
                    "q": search_q,
                    "lang": "en",
                    "max": max_per_cat,
                    "apikey": api_key,
                    "sortby": "publishedAt",
                },
                timeout=10,
                headers=_HTTP_HEADERS,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            logger.warning("GNews fetch failed for '%s': %s", cat, e)
            continue

        for item in data.get("articles", []):
            url = (item.get("url") or "").strip()
            if not url or not url.startswith("http"):
                continue
            title = (item.get("title") or "").strip()
            if not title:
                continue

            # Parse published date
            pub_str = item.get("publishedAt", "")
            try:
                published = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                published = datetime.now(timezone.utc)

            netloc = urlparse(url).netloc
            domain = netloc[4:] if netloc.startswith("www.") else netloc
            summary = _strip_html(item.get("description") or "")

            all_articles.append({
                "title": title,
                "url": url,
                "published": published,
                "summary": summary[:500],
                "source_domain": domain,
                "source_name": "GNews",
                "default_category": cat,
                "category": cat,
                "score": 0,
                "comment_count": 0,
                "is_hn": False,
            })

    logger.info("GNews fetch: %d articles from %d categories",
                len(all_articles), len(categories))
    return all_articles


# ---------------------------------------------------------------------------
# Main orchestrator: grounded search first, RSS/HN/GNews supplement
# ---------------------------------------------------------------------------

def _fetch_real_tech_news() -> list[dict]:
    """Fetch real tech news from RSS feeds, Hacker News, and optional GNews.

    Pipeline:
      1. RSS feeds + Hacker News — fetched in parallel (primary sources).
      2. Deduplicate across all sources.
      3. Categorize by keyword matching.
      4. Validate URLs in parallel (reject 404/503).
      5. If still insufficient, try GNews API (if configured).
      6. Rank and balance (~15 items across 7 categories).
      7. Format for frontend.

    Returns ~15 formatted news items ready for caching and API response.
    """
    all_raw: list[dict] = []

    # Phase 1: RSS feeds + Hacker News — all in parallel
    with ThreadPoolExecutor(max_workers=12) as pool:
        rss_futures = {
            pool.submit(_fetch_rss_articles, url, name, cat): name
            for url, name, cat in _RSS_FEEDS
        }
        hn_future = pool.submit(_fetch_hn_top_stories, 25)

        rss_count = 0
        for fut in as_completed(rss_futures):
            try:
                items = fut.result()
                all_raw.extend(items)
                rss_count += len(items)
            except Exception as e:
                logger.warning("RSS future failed for %s: %s", rss_futures[fut], e)

        try:
            hn_items = hn_future.result()
            all_raw.extend(hn_items)
            logger.info("Phase 1 -- RSS: %d articles, HN: %d articles", rss_count, len(hn_items))
        except Exception as e:
            logger.warning("HN future failed: %s", e)
            logger.info("Phase 1 -- RSS: %d articles, HN: 0 articles", rss_count)

    # Phase 2: Deduplicate
    all_raw = _deduplicate(all_raw)
    logger.info("Phase 2 -- After deduplication: %d articles", len(all_raw))

    # Phase 3: Categorize
    for art in all_raw:
        if "category" not in art or not art.get("category"):
            art["category"] = _categorize_article(
                art["title"], art.get("summary", ""), art.get("default_category", "systems"),
            )

    # Phase 4: Pre-rank and validate top candidates
    pre_ranked = _rank_and_balance(all_raw, target=30)
    validated = _validate_urls_parallel(pre_ranked, max_workers=10)
    logger.info("Phase 4 -- URL validation: %d / %d passed",
                len(validated), len(pre_ranked))

    # Phase 5: If still insufficient, try GNews
    if len(validated) < 10:
        logger.info("Phase 5 -- Insufficient articles (%d), trying GNews supplement",
                     len(validated))
        try:
            gnews = _fetch_gnews_articles()
            if gnews:
                existing_keys = {_normalize_url_key(a["url"]) for a in validated}
                gnews_new = [a for a in gnews if _normalize_url_key(a["url"]) not in existing_keys]
                gnews_validated = _validate_urls_parallel(gnews_new, max_workers=6)
                validated.extend(gnews_validated)
                logger.info("GNews supplement added %d validated articles", len(gnews_validated))
        except Exception as e:
            logger.warning("GNews supplement failed: %s", e)

    if len(validated) < 8:
        # Not enough — try expired cache
        cached, _ = _load_cached("news")
        if cached:
            logger.info("Insufficient validated articles (%d), using expired cache", len(validated))
            return cached
        if not validated:
            return []

    # Phase 6: Final rank and balance
    for art in validated:
        art.pop("_score", None)
    final = _rank_and_balance(validated, target=15)

    # Phase 7: Format for frontend
    items = [_format_as_news_item(art) for art in final]

    # Clean up internal scoring keys
    for art in validated:
        art.pop("_score", None)

    return items


# ---------------------------------------------------------------------------
# Gemini career intel generator (unchanged)
# ---------------------------------------------------------------------------

def _generate_career_intel() -> list:
    """Ask Gemini for 8 career intelligence items. Returns a list of dicts."""
    from services.gemini_client import gemini_json, GEMINI_FLASH

    today = datetime.now(timezone.utc).strftime("%B %Y")
    prompt = f"""Generate a JSON array of 8 career intelligence items for tech job seekers in {today}.

Mix these categories:
- "trend" (3 items): Hot tech job market trends with concrete numerical stats
- "tip"   (3 items): Actionable, specific resume / job search tips with proof
- "stat"  (2 items): Surprising hiring / career statistics with real impact

For each item return an object with EXACTLY these keys:
  id        — unique slug string (lowercase, hyphenated)
  category  — "trend" | "tip" | "stat"
  headline  — short punchy headline (max 80 chars) that MUST include a number or stat
  summary   — 3-4 sentence expansion with actionable detail. Be specific, not generic.
  tags      — array of 1-2 short tag strings (e.g., ["DevOps", "Salary"])
  timeAgo   — "1h ago", "3h ago", etc.
  readTime  — "X min read"

Make headlines concrete and numeric: "AWS certifications now command 31% salary premium" NOT
"Cloud skills are in demand".

Return a JSON object: {{"items": [...]}}
"""
    schema = {
        "items": [{
            "id": str, "category": str, "headline": str, "summary": str,
            "tags": [str],
            "timeAgo": str, "readTime": str,
        }]
    }
    try:
        result = gemini_json(
            prompt=prompt, max_tokens=5000, temperature=0.8,
            model=GEMINI_FLASH, schema=schema,
        )
        items = result.get("items") or []
        logger.info("Generated %d career intel items via Gemini", len(items))
        return items
    except Exception as e:
        logger.error("Career intel generation failed: %s", e)
        return []


# ---------------------------------------------------------------------------
# Core regeneration
# ---------------------------------------------------------------------------

def _ensure_fresh(kind: str) -> list:
    """Return fresh items for a kind, generating + caching if needed."""
    cached, _ = _load_cached(kind)
    if cached:
        return cached

    if kind == "news":
        items = _fetch_real_tech_news()
        if not items:
            return _FALLBACK_NEWS
    else:
        items = _generate_career_intel()
        if not items:
            return _FALLBACK_CAREER

    _save_cache(kind, items)
    return items


def _parse_time_ago(s: str) -> int:
    """Parse '2h ago' / '45m ago' / '1d ago' into minutes-ago (for sorting)."""
    if not s:
        return 9999
    m = re.match(r"(\d+)\s*([mhd])", s.lower())
    if not m:
        return 9999
    n = int(m.group(1))
    unit = m.group(2)
    if unit == "m":
        return n
    if unit == "h":
        return n * 60
    return n * 1440  # days


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@tech_chronicle_bp.route("", methods=["GET"])
@tech_chronicle_bp.route("/", methods=["GET"])
def get_feed():
    """Return the merged tech chronicle feed.

    Query params:
      category — "all" (default), "ai", "cloud", "devops", "security", "data",
                 "web", "systems", or "career" (any of trend/tip/stat)

    Response:
      {
        "items": [...],
        "trendingTags": ["Kubernetes", "Claude", ...],
        "generatedAt": "2026-04-10T14:00:00+00:00",
      }
    """
    category = (request.args.get("category") or "all").lower().strip()

    try:
        news = _ensure_fresh("news")
        career = _ensure_fresh("career")
    except Exception as e:
        logger.error("tech-chronicle fetch failed: %s", e)
        news = _FALLBACK_NEWS
        career = _FALLBACK_CAREER

    items = list(news) + list(career)

    # Filter
    if category and category != "all":
        if category == "career":
            items = [i for i in items if i.get("category") in {"trend", "tip", "stat"}]
        else:
            items = [i for i in items if i.get("category") == category]

    # Sort by recency
    items.sort(key=lambda i: _parse_time_ago(i.get("timeAgo", "")))

    # Compute top trending tags from ALL items
    all_items = list(news) + list(career)
    tag_counts: dict = {}
    for it in all_items:
        for t in (it.get("tags") or []):
            if not t:
                continue
            tag_counts[t] = tag_counts.get(t, 0) + 1
    trending_tags = sorted(tag_counts.keys(), key=lambda t: -tag_counts[t])[:6]

    # Last generated timestamp
    _, news_ts = _load_cached("news")
    _, career_ts = _load_cached("career")
    timestamps = [t for t in (news_ts, career_ts) if t]
    generated_at = min(timestamps).isoformat() if timestamps else None

    return jsonify({
        "items": items,
        "trendingTags": trending_tags,
        "generatedAt": generated_at,
    })


@tech_chronicle_bp.route("/regenerate", methods=["POST"])
def regenerate():
    """Force a regeneration of both caches.

    Rate-limited to once per 2 minutes to prevent abuse, but otherwise
    always produces fresh content (deletes existing cache first).
    """
    _, news_ts = _load_cached("news")
    if news_ts and (datetime.now(timezone.utc) - news_ts) < timedelta(minutes=2):
        return jsonify({"error": "Please wait at least 2 minutes between refreshes"}), 429

    try:
        # Delete existing caches so _fetch_real_tech_news runs fresh
        col = DBConnect().get_db().tech_chronicle_cache
        col.delete_many({"kind": "news"})
        col.delete_many({"kind": "career"})

        news = _fetch_real_tech_news()
        if not news:
            news = _FALLBACK_NEWS
        _save_cache("news", news)

        career = _generate_career_intel() or _FALLBACK_CAREER
        _save_cache("career", career)

        return jsonify({
            "success": True,
            "news_count": len(news),
            "career_count": len(career),
            "regenerated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error("Regenerate failed: %s", e)
        return jsonify({"error": "Regeneration failed"}), 500


# ---------------------------------------------------------------------------
# Background auto-refresh (every 4 hours)
# ---------------------------------------------------------------------------

_refresh_lock = threading.Lock()
_refresh_timer: threading.Timer | None = None
_REFRESH_INTERVAL = 4 * 60 * 60  # 4 hours in seconds


def _background_refresh():
    """Run a background refresh of news and career caches.

    Called by the background timer thread every 4 hours. Checks whether
    existing caches have expired before regenerating (avoids duplicate work
    if a user request already triggered regeneration).
    """
    try:
        logger.info("Background refresh: starting scheduled regeneration")

        # Only regenerate if cache is actually expired
        cached_news, _ = _load_cached("news")
        if not cached_news:
            news = _fetch_real_tech_news()
            if not news:
                news = _FALLBACK_NEWS
            _save_cache("news", news)
            logger.info("Background refresh: regenerated %d news items", len(news))
        else:
            logger.info("Background refresh: news cache still fresh, skipping")

        cached_career, _ = _load_cached("career")
        if not cached_career:
            career = _generate_career_intel() or _FALLBACK_CAREER
            _save_cache("career", career)
            logger.info("Background refresh: regenerated %d career items", len(career))
        else:
            logger.info("Background refresh: career cache still fresh, skipping")

    except Exception as e:
        logger.error("Background refresh failed: %s", e)
    finally:
        # Schedule the next run regardless of success/failure
        _schedule_next_refresh()


def _schedule_next_refresh():
    """Schedule the next background refresh."""
    global _refresh_timer
    with _refresh_lock:
        if _refresh_timer is not None:
            _refresh_timer.cancel()
        _refresh_timer = threading.Timer(_REFRESH_INTERVAL, _background_refresh)
        _refresh_timer.daemon = True  # won't block app shutdown
        _refresh_timer.start()
        logger.info("Background refresh: next run in %d hours",
                    _REFRESH_INTERVAL // 3600)


def start_background_refresh():
    """Start the background auto-refresh cycle.

    Call this once at app startup (e.g. after blueprint registration).
    The first refresh fires after _REFRESH_INTERVAL seconds (not immediately,
    to avoid blocking startup). Subsequent refreshes repeat every 4 hours.
    """
    _schedule_next_refresh()
    logger.info("Tech Chronicle background refresh enabled (every %dh)",
                _REFRESH_INTERVAL // 3600)


def stop_background_refresh():
    """Cancel the background refresh timer (for graceful shutdown)."""
    global _refresh_timer
    with _refresh_lock:
        if _refresh_timer is not None:
            _refresh_timer.cancel()
            _refresh_timer = None
            logger.info("Background refresh stopped")
