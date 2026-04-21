"""
Job Search Service - JSearch API integration, skill matching, resume parsing, AI analysis

Provides:
- Job search via JSearch (RapidAPI) with MongoDB caching
- Skill-based job matching and scoring
- Resume parsing via Gemini AI
- Job analysis (summary, missing skills, cover letter)
- Saved jobs CRUD
- Saved job search filter preferences
- H1B sponsor detection
"""
import hashlib
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode

import requests

from utils.config import _get_config_value
from utils.db_connect import DBConnect

logger = logging.getLogger(__name__)

# ---- Portfolio skills (same source as chat_service.PORTFOLIO_CONTEXT) ----
PORTFOLIO_SKILLS = [
    "Python", "Java", "Bash", "JavaScript", "SQL", "HTML", "CSS",
    "AWS", "EC2", "S3", "VPC", "ECS", "Lambda", "CloudWatch", "CloudTrail",
    "CodePipeline", "CloudFormation", "Terraform", "Docker", "Nginx", "Git",
    "GitHub", "Flask", "Postgres", "PostgreSQL", "Linux", "Unix",
    "React", "TypeScript", "CI/CD", "MongoDB", "REST", "API Gateway",
    "IAM", "RDS", "Fargate", "CodeBuild", "ECR", "ALB",
    "Kubernetes", "Jenkins", "Ansible", "Prometheus", "Grafana",
]

# ---- Known H1B sponsors (top tech + consulting + finance) ----
H1B_SPONSORS = {
    "google", "meta", "amazon", "apple", "microsoft", "netflix", "uber",
    "lyft", "airbnb", "stripe", "salesforce", "oracle", "ibm", "intel",
    "cisco", "vmware", "adobe", "nvidia", "qualcomm", "paypal",
    "twitter", "snap", "pinterest", "linkedin", "spotify", "shopify",
    "databricks", "snowflake", "palantir", "splunk", "datadog",
    "cloudflare", "twilio", "okta", "zscaler", "palo alto networks",
    "crowdstrike", "fortinet", "elastic", "mongodb", "confluent",
    "hashicorp", "github", "atlassian", "servicenow", "workday",
    "zoom", "docusign", "hubspot", "zendesk", "freshworks",
    "deloitte", "accenture", "pwc", "ey", "ernst & young", "kpmg",
    "mckinsey", "bain", "boston consulting", "bcg", "capgemini",
    "cognizant", "infosys", "tcs", "wipro", "hcl", "tech mahindra",
    "jpmorgan", "jp morgan", "goldman sachs", "morgan stanley",
    "bank of america", "citibank", "citi", "wells fargo", "barclays",
    "capital one", "american express", "visa", "mastercard",
    "blackrock", "citadel", "two sigma", "jane street", "de shaw",
    "bloomberg", "fidelity", "charles schwab", "robinhood",
    "walmart", "target", "costco", "home depot",
    "johnson & johnson", "pfizer", "abbvie", "merck", "bristol-myers",
    "lockheed martin", "raytheon", "boeing", "northrop grumman",
    "general electric", "ge", "siemens", "honeywell", "3m",
    "tesla", "rivian", "spacex", "relativity space",
    "epic systems", "cerner", "veeva", "medidata",
    "samsung", "sony", "lg", "toshiba", "hitachi",
    "sap", "dell", "hp", "hewlett packard", "lenovo",
    "red hat", "canonical", "suse",
    "figma", "notion", "vercel", "supabase", "retool",
    "anduril", "shield ai", "applied intuition",
    "openai", "anthropic", "cohere", "stability ai",
    "waymo", "cruise", "aurora", "nuro", "argo ai",
    "doordash", "instacart", "grubhub",
    "reddit", "discord", "roblox", "epic games", "unity",
    "plaid", "brex", "chime", "sofi", "affirm", "klarna",
    "nike", "tiktok", "bytedance", "lucid", "lucid motors",
    "thermo fisher", "thermofisher", "state farm", "zelle",
    "early warning services", "jobright",
}

# ---- New-grad keywords ----
NEW_GRAD_KEYWORDS = [
    "new grad", "new graduate", "entry level", "entry-level",
    "junior", "associate", "early career", "recent graduate",
    "0-2 years", "0-1 years", "graduate program",
]

CONTRACT_KEYWORDS = [
    "contract", "contractor", "contract-to-hire", "contract to hire",
    "c2c", "corp-to-corp", "w2 contract", "consultant",
]

TOP_COMPANY_CAREER_URLS = [
    "https://www.amazon.jobs",
    "https://careers.google.com",
    "https://www.metacareers.com",
    "https://www.apple.com/careers",
    "https://jobs.netflix.com",
    "https://careers.microsoft.com",
    "https://jobs.nike.com",
    "https://careers.walmart.com",
    "https://careers.tiktok.com",
    "https://jobs.lucidmotors.com",
    "https://www.qualcomm.com/company/careers",
    "https://jobs.thermofisher.com",
    "https://www.paypal.com/us/cshelp/article/how-do-i-apply-for-a-job-at-paypal-help528",
    "https://jobs.statefarm.com",
    "https://www.earlywarning.com/careers",
    "https://www.deloitte.com/us/en/careers.html",
    "https://www.tcs.com/careers",
    "https://www.infosys.com/careers",
]

COMPANY_CAREER_BATCH_SIZE = 3
COMPANY_CAREER_MAX_BATCHES = 4
COMPANY_CAREER_MAX_JOBS_PER_COMPANY = 2
MAX_RETURNED_JOBS = 80
JOB_DESCRIPTION_MAX_CHARS = 1600

# Max Apify actor runs per (source, query) batch. Keeps parallel fan-out bounded
# so we don't spawn hundreds of actor runs for a 6-query × 5-source batch.
APIFY_MAX_WORKERS = 12
# Max queries sent to each live Apify actor per batch. Sources with heavy
# per-run cost (Google, company) cap lower via _max_queries_for_source.
MAX_QUERIES_PER_APIFY_SOURCE = 3
# Max JSearch (RapidAPI) queries per batch — RapidAPI plans meter per call.
MAX_JSEARCH_QUERIES_PER_BATCH = 4
# Reuse identical Apify actor responses across users/filter post-processing.
# This prevents re-running paid/credit-consuming actors for repeated searches.
APIFY_ACTOR_CACHE_TTL_SECONDS = 3600
APIFY_ACTOR_CACHE_VERSION = "v6-jsearch-linkedin-workday"
# Bump this when the result schema/source behavior changes so old cached
# entries are bypassed.
JOBS_CACHE_VERSION = "v7-apify-filter-fallback"

# Tokens that should never end up in stored error strings or responses.
_SECRET_QUERY_PARAMS = ("token", "apify_token", "api_key", "X-RapidAPI-Key")
_SECRET_PATTERN = re.compile(
    r"(" + "|".join(_SECRET_QUERY_PARAMS) + r")=([^&\s]+)",
    re.IGNORECASE,
)


def _redact_secrets(text: str) -> str:
    """Strip token=… / api_key=… values from any string before logging/storing."""
    if not text:
        return text
    return _SECRET_PATTERN.sub(r"\1=***", str(text))


# Tokens commonly paired with resume-search queries that aren't useful as
# free-text keywords for JSearch / Google Jobs (they hurt relevance there).
_JSEARCH_STOPWORDS = {
    "h1b", "h-1b", "sponsor", "sponsorship", "visa",
    "new", "grad", "graduate", "entry", "level",
    "contract", "c2c", "corp-to-corp", "w2",
}


def _simplify_jsearch_query(query: str) -> str:
    """Drop filter-style tokens that confuse JSearch's keyword scoring."""
    parts = [p for p in re.split(r"\s+", query.lower()) if p]
    kept = [p for p in parts if p not in _JSEARCH_STOPWORDS]
    simplified = " ".join(kept).strip()
    return simplified or query.strip()


def _make_cache_key(params: dict) -> str:
    """Create a deterministic MD5 hash from query parameters."""
    normalized = json.dumps({**params, "_v": JOBS_CACHE_VERSION}, sort_keys=True)
    return hashlib.md5(normalized.encode()).hexdigest()


def _make_apify_cache_key(actor_id: str, payload: dict, max_items: int) -> str:
    """Create a stable cache key for one concrete Apify actor invocation."""
    normalized = json.dumps(
        {
            "_v": APIFY_ACTOR_CACHE_VERSION,
            "actor_id": actor_id,
            "payload": payload,
            "max_items": max_items,
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.md5(normalized.encode()).hexdigest()


class JobService:
    """Singleton service for job search, matching, analysis, and saved-jobs."""

    JSEARCH_BASE = "https://jsearch.p.rapidapi.com"
    APIFY_BASE = "https://api.apify.com/v2/acts"
    # Apify actors are optional and must be configured explicitly.
    # Pricing changes often; use only actor ids you have verified/approved.
    # Configure via APIFY_LINKEDIN_ACTOR / APIFY_WORKDAY_ACTOR /
    # APIFY_INDEED_ACTOR / APIFY_GOOGLE_ACTOR / APIFY_COMPANY_ACTOR /
    # APIFY_JOBRIGHT_ACTOR.
    APIFY_ACTORS = {
        "linkedin": "curious_coder/linkedin-jobs-scraper",
        "workday": "fantastic-jobs/workday-jobs-api",
        "indeed": "",
        "google": "",
        "company": "",
        "jobright": "",
    }
    CACHE_TTL_SECONDS = 6 * 3600  # 6 hours

    def __init__(self):
        self.db = DBConnect().get_db()
        self.jobs_cache = self.db.jobs_cache
        self.apify_actor_cache = self.db.apify_actor_cache
        self.user_resumes = self.db.user_resumes
        self.saved_jobs = self.db.saved_jobs
        self.job_filter_preferences = self.db.job_filter_preferences
        self._ensure_indexes()

    def _ensure_indexes(self):
        try:
            self.jobs_cache.create_index("query_hash", unique=True)
            self.jobs_cache.create_index(
                "cached_at", expireAfterSeconds=self.CACHE_TTL_SECONDS
            )
            self.apify_actor_cache.create_index("cache_key", unique=True)
            self.apify_actor_cache.create_index(
                "cached_at",
                expireAfterSeconds=APIFY_ACTOR_CACHE_TTL_SECONDS,
                name="apify_actor_cache_cached_at_ttl",
            )
            self.saved_jobs.create_index("job_id", unique=True)
            self.job_filter_preferences.create_index("user_email", unique=True)
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    # ------------------------------------------------------------------
    # JSearch API
    # ------------------------------------------------------------------

    def search_jobs(
        self,
        query: str,
        page: int = 1,
        location: str = "",
        date_posted: str = "month",
        remote_only: bool = False,
        employment_type: str = "",
        h1b_only: bool = False,
        visa_or_contract: bool = False,
        experience_level: str = "",
        source: str = "all",
        include_company_careers: bool = True,
        use_resume_recommendations: bool = True,
        user_email: str = "",
        partial_cb: Optional[Any] = None,
    ) -> Dict[str, Any]:
        params = {
            "query": query,
            "page": page,
            "location": location,
            "date_posted": date_posted,
            "remote_only": remote_only,
            "employment_type": employment_type,
            "h1b_only": h1b_only,
            "visa_or_contract": visa_or_contract,
            "experience_level": experience_level,
            "source": source,
            "include_company_careers": include_company_careers,
            "use_resume_recommendations": use_resume_recommendations,
            # Cache results per-user because match_score is resume-specific.
            "user_email": user_email if use_resume_recommendations else "",
        }
        cache_key = _make_cache_key(params)

        # Check cache
        cached = self.jobs_cache.find_one({"query_hash": cache_key})
        if cached:
            cached.pop("_id", None)
            return self._prepare_result_for_response(cached["result"])

        if not self._get_apify_token() and not self._get_jsearch_key():
            raise RuntimeError("APIFY_API_KEY/APIFY_TOKEN or JSEARCH_API_KEY is not configured")

        result = self._search_apify_jobs(
            queries=[query],
            location=location,
            date_posted=date_posted,
            remote_only=remote_only,
            employment_type=employment_type,
            h1b_only=h1b_only,
            visa_or_contract=visa_or_contract,
            experience_level=experience_level,
            source=source,
            include_company_careers=include_company_careers,
            user_email=user_email if use_resume_recommendations else "",
            partial_cb=partial_cb,
        )
        result["page"] = page
        result.setdefault("total_pages", 1)
        self._write_cache(cache_key, result)
        return result

    @staticmethod
    def _get_jsearch_key() -> str:
        return _get_config_value('JSEARCH_API_KEY', '')

    def _search_jsearch_raw(
        self,
        query: str,
        location: str,
        date_posted: str,
        remote_only: bool,
        employment_type: str,
    ) -> List[Dict[str, Any]]:
        """Run one JSearch query and return normalized jobs (no scoring/caching).

        JSearch's relevance drops sharply on filter-style tokens (e.g. "h1b
        sponsor", "new grad"). We strip those before the request and apply
        the intent as post-filters in the main pipeline. We also widen
        date_posted from "today" → "3days" because JSearch's daily index
        lags ~1 day for many sources.
        """
        api_key = self._get_jsearch_key()
        if not api_key:
            logger.info("JSearch skipped: JSEARCH_API_KEY not configured")
            return []

        clean_query = _simplify_jsearch_query(query)
        effective_date = {
            "today": "3days",
        }.get(date_posted, date_posted if date_posted in ("3days", "week", "month", "all") else "week")

        headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
        api_params = {
            "query": f"{clean_query} in {location}" if location else clean_query,
            "page": "1",
            "num_pages": "1",
            "country": "us",
            "language": "en",
            "date_posted": effective_date,
        }
        if remote_only:
            api_params["remote_jobs_only"] = "true"
            api_params["work_from_home"] = "true"
        if employment_type:
            api_params["employment_types"] = employment_type

        resp = requests.get(
            f"{self.JSEARCH_BASE}/search",
            headers=headers,
            params=api_params,
            timeout=20,
        )
        if not resp.ok:
            raise RuntimeError(f"JSearch returned {resp.status_code} {resp.reason}")
        data = resp.json()
        items = data.get("data") or []
        logger.info(
            "JSearch query=%r date=%s returned %d items",
            clean_query, effective_date, len(items),
        )
        return [self._normalize_job(j) for j in items]

    # ------------------------------------------------------------------
    # Batch Search (multiple queries in parallel)
    # ------------------------------------------------------------------

    def batch_search_jobs(
        self,
        queries: List[str],
        location: str = "",
        date_posted: str = "today",
        remote_only: bool = False,
        employment_type: str = "",
        h1b_only: bool = False,
        visa_or_contract: bool = False,
        experience_level: str = "",
        source: str = "all",
        include_company_careers: bool = True,
        use_resume_recommendations: bool = True,
        user_email: str = "",
        partial_cb: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Run multiple search queries in parallel, deduplicate, and re-score."""
        params = {
            "queries": queries,
            "location": location,
            "date_posted": date_posted,
            "remote_only": remote_only,
            "employment_type": employment_type,
            "h1b_only": h1b_only,
            "visa_or_contract": visa_or_contract,
            "experience_level": experience_level,
            "source": source,
            "include_company_careers": include_company_careers,
            "user_email": user_email if use_resume_recommendations else "",
        }
        cache_key = _make_cache_key(params)
        cached = self.jobs_cache.find_one({"query_hash": cache_key})
        if cached:
            cached.pop("_id", None)
            result = cached["result"]
            result["cache_hits"] = result.get("queries_executed", len(queries))
            return self._prepare_result_for_response(result)

        if not self._get_apify_token() and not self._get_jsearch_key():
            raise RuntimeError("APIFY_API_KEY/APIFY_TOKEN or JSEARCH_API_KEY is not configured")

        result = self._search_apify_jobs(
            queries=queries[:6],
            location=location,
            date_posted=date_posted,
            remote_only=remote_only,
            employment_type=employment_type,
            h1b_only=h1b_only,
            visa_or_contract=visa_or_contract,
            experience_level=experience_level,
            source=source,
            include_company_careers=include_company_careers,
            user_email=user_email if use_resume_recommendations else "",
            partial_cb=partial_cb,
        )
        result["queries_executed"] = min(len(queries), 6)
        result["cache_hits"] = 0
        self._write_cache(cache_key, result)
        return result

    def _write_cache(self, cache_key: str, result: Dict[str, Any]) -> None:
        try:
            self.jobs_cache.update_one(
                {"query_hash": cache_key},
                {
                    "$set": {
                        "query_hash": cache_key,
                        "result": result,
                        "cached_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"Cache write failed: {e}")

    def _read_apify_actor_cache(
        self,
        actor_id: str,
        payload: Dict[str, Any],
        max_items: int,
    ) -> Optional[List[Dict[str, Any]]]:
        cache_key = _make_apify_cache_key(actor_id, payload, max_items)
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=APIFY_ACTOR_CACHE_TTL_SECONDS)
        try:
            cached = self.apify_actor_cache.find_one(
                {"cache_key": cache_key, "cached_at": {"$gte": cutoff}},
                {"_id": 0, "items": 1},
            )
            if cached and isinstance(cached.get("items"), list):
                logger.info(
                    "Apify actor cache hit for %s (%d items)",
                    actor_id,
                    len(cached["items"]),
                )
                return cached["items"]
        except Exception as e:
            logger.warning("Apify actor cache read failed for %s: %s", actor_id, e)
        return None

    def _write_apify_actor_cache(
        self,
        actor_id: str,
        payload: Dict[str, Any],
        max_items: int,
        items: List[Dict[str, Any]],
    ) -> None:
        cache_key = _make_apify_cache_key(actor_id, payload, max_items)
        try:
            self.apify_actor_cache.update_one(
                {"cache_key": cache_key},
                {
                    "$set": {
                        "cache_key": cache_key,
                        "actor_id": actor_id,
                        "items": items,
                        "cached_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
        except Exception as e:
            logger.warning("Apify actor cache write failed for %s: %s", actor_id, e)

    @staticmethod
    def _get_apify_token() -> str:
        return _get_config_value("APIFY_API_KEY", "") or _get_config_value("APIFY_TOKEN", "")

    def _run_apify_actor(
        self,
        actor_id: str,
        payload: Dict[str, Any],
        max_items: int = 50,
        timeout_seconds: int = 120,
        memory_mb: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        cached = self._read_apify_actor_cache(actor_id, payload, max_items)
        if cached is not None:
            return cached

        token = self._get_apify_token()
        actor_path = quote(actor_id.replace("/", "~"), safe="")
        url = f"{self.APIFY_BASE}/{actor_path}/run-sync-get-dataset-items"
        if memory_mb is None:
            memory_mb = self._get_apify_memory_mb()
        params = {
            "token": token,
            "format": "json",
            "clean": "true",
            "timeout": str(timeout_seconds),
            "maxItems": str(max_items),
            "memory": str(memory_mb),
        }
        resp = requests.post(url, params=params, json=payload, timeout=timeout_seconds + 30)
        if not resp.ok:
            # Build an error that doesn't echo the token in the URL.
            raise RuntimeError(
                f"Apify actor {actor_id} returned {resp.status_code} {resp.reason}"
            )
        data = resp.json()
        if isinstance(data, dict) and data.get("error"):
            # Apify returns {"error": {...}} on timeouts/abort inside run-sync.
            err = data.get("error", {})
            msg = err.get("message") or err.get("type") or "actor run failed"
            raise RuntimeError(f"Apify actor {actor_id}: {msg}")
        items = data if isinstance(data, list) else []
        self._write_apify_actor_cache(actor_id, payload, max_items, items)
        return items

    @staticmethod
    def _get_apify_memory_mb() -> int:
        raw = _get_config_value("APIFY_ACTOR_MEMORY_MB", "1024")
        try:
            return max(512, min(int(raw), 8192))
        except (TypeError, ValueError):
            return 1024

    @staticmethod
    def _get_apify_memory_mb_for_source(source: str) -> int:
        if source in ("company", "workday"):
            raw = _get_config_value("APIFY_COMPANY_ACTOR_MEMORY_MB", "1024")
            try:
                return max(1024, min(int(raw), 8192))
            except (TypeError, ValueError):
                return 1024
        return JobService._get_apify_memory_mb()

    @staticmethod
    def _chunks(items: List[str], size: int) -> List[List[str]]:
        return [items[i:i + size] for i in range(0, len(items), size)]

    def _search_apify_jobs(
        self,
        queries: List[str],
        location: str,
        date_posted: str,
        remote_only: bool,
        employment_type: str,
        h1b_only: bool,
        visa_or_contract: bool,
        experience_level: str,
        source: str,
        include_company_careers: bool,
        user_email: str,
        partial_cb: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Parallel multi-source job search.

        Runs JSearch (RapidAPI) and any configured Apify actors concurrently,
        then deduplicates, filters, and re-scores. Apify actor ids are
        configured-only so subscription/rental errors from Store defaults do
        not block normal job results.

        If ``partial_cb`` is provided, it is invoked with a snapshot of the
        partial result dict after each source completes, so the caller can
        stream progress to the client.
        """
        supported = {"all", "linkedin", "workday", "indeed", "google", "company", "jobright", "jsearch"}
        source = source if source in supported else "all"

        apify_token = self._get_apify_token()
        jsearch_key = self._get_jsearch_key()

        # Pick which sources to fan out to. JSearch is first so the UI can
        # render useful results while optional Apify actors are still running.
        # An Apify source only joins if its actor ID is explicitly configured.
        selected: List[str] = []
        if source == "all":
            if jsearch_key:
                selected.append("jsearch")
            if apify_token:
                for src in ("linkedin", "indeed", "google", "jobright"):
                    if self._actor_id(src):
                        selected.append(src)
                if include_company_careers and self._actor_id("workday"):
                    selected.append("workday")
                if include_company_careers and self._actor_id("company"):
                    selected.append("company")
        elif source == "jsearch":
            if jsearch_key:
                selected = ["jsearch"]
        else:
            # A specific Apify source was requested.
            if apify_token and self._actor_id(source):
                selected = [source]
            elif jsearch_key:
                # Keep the dashboard useful when a paid/rented Apify actor is
                # not configured. The source badge will show JSearch.
                selected = ["jsearch"]

        if not selected:
            return {
                "jobs": [], "total": 0, "page": 1, "total_pages": 1,
                "queries_executed": len(queries), "cache_hits": 0,
                "errors": ["Set JSEARCH_API_KEY or configure an APIFY_*_ACTOR source"],
                "sources": {},
            }

        all_jobs: List[Dict[str, Any]] = []
        fallback_jobs: List[Dict[str, Any]] = []
        errors: List[str] = []
        seen_ids: set = set()
        fallback_seen_ids: set = set()
        source_counts: Dict[str, int] = {}
        fallback_source_counts: Dict[str, int] = {}

        def _collect_apify(src: str, q: str, company_urls: Optional[List[str]] = None) -> List[Dict[str, Any]]:
            actor = self._actor_id(src)
            if not actor:
                raise RuntimeError(f"APIFY_{src.upper()}_ACTOR is not configured")
            payload = self._build_apify_input(
                source=src,
                query=q,
                location=location,
                date_posted=date_posted,
                remote_only=remote_only,
                employment_type=employment_type,
                experience_level=experience_level,
                company_urls=company_urls,
            )
            try:
                raw_items = self._run_apify_actor(
                    actor,
                    payload,
                    max_items=35 if src != "company" else max(10, len(company_urls or []) * COMPANY_CAREER_MAX_JOBS_PER_COMPANY),
                    timeout_seconds=180 if src != "company" else 120,
                    memory_mb=self._get_apify_memory_mb_for_source(src),
                )
            except Exception:
                if src != "company" or not company_urls or len(company_urls) == 1:
                    raise
                raw_items = []
                for url in company_urls:
                    single_payload = self._build_apify_input(
                        source=src,
                        query=q,
                        location=location,
                        date_posted=date_posted,
                        remote_only=remote_only,
                        employment_type=employment_type,
                        experience_level=experience_level,
                        company_urls=[url],
                    )
                    try:
                        raw_items.extend(
                            self._run_apify_actor(
                                actor,
                                single_payload,
                                max_items=COMPANY_CAREER_MAX_JOBS_PER_COMPANY,
                                timeout_seconds=60,
                                memory_mb=self._get_apify_memory_mb_for_source(src),
                            )
                        )
                    except Exception as e:
                        logger.warning(f"Company career scrape failed for {url}: {e}")
            return [self._normalize_apify_job(item, src) for item in raw_items]

        def _collect_jsearch(q: str) -> List[Dict[str, Any]]:
            """Run one JSearch query and return normalized jobs (no scoring yet)."""
            result = self._search_jsearch_raw(
                query=q,
                location=location,
                date_posted=date_posted,
                remote_only=remote_only,
                employment_type=employment_type,
            )
            return result

        queries = [q for q in (queries or []) if q] or [""]

        tasks = []
        task_meta: Dict[Any, str] = {}
        with ThreadPoolExecutor(max_workers=APIFY_MAX_WORKERS) as pool:
            for src in selected:
                max_q = self._max_queries_for_source(src, total_queries=len(queries))
                src_queries = queries[:max_q] if src != "company" else [queries[0]]
                if src == "company":
                    url_batches = self._chunks(
                        TOP_COMPANY_CAREER_URLS,
                        COMPANY_CAREER_BATCH_SIZE,
                    )[:COMPANY_CAREER_MAX_BATCHES]
                    for urls in url_batches:
                        fut = pool.submit(_collect_apify, src, src_queries[0], urls)
                        tasks.append(fut)
                        task_meta[fut] = src
                    continue
                if src == "jsearch":
                    for q in src_queries:
                        fut = pool.submit(_collect_jsearch, q)
                        tasks.append(fut)
                        task_meta[fut] = src
                    continue
                for q in src_queries:
                    fut = pool.submit(_collect_apify, src, q)
                    tasks.append(fut)
                    task_meta[fut] = src

            pending_sources = {task_meta[t] for t in tasks}

            for future in as_completed(tasks):
                src = task_meta.get(future, "?")
                try:
                    jobs_from_future = future.result()
                    kept = 0
                    fallback_kept = 0
                    for job in jobs_from_future:
                        if not job.get("title") or not job.get("company"):
                            continue
                        jid = job.get("job_id") or _make_cache_key(job)
                        if self._job_matches_filters(
                            job=job,
                            query_terms=queries,
                            location=location,
                            date_posted=date_posted,
                            h1b_only=h1b_only,
                            visa_or_contract=False,
                            experience_level="",
                        ) and jid not in fallback_seen_ids:
                            fallback_seen_ids.add(jid)
                            fallback_jobs.append(job)
                            fallback_kept += 1
                        if not self._job_matches_filters(
                            job=job,
                            query_terms=queries,
                            location=location,
                            date_posted=date_posted,
                            h1b_only=h1b_only,
                            visa_or_contract=visa_or_contract,
                            experience_level=experience_level,
                        ):
                            continue
                        if jid in seen_ids:
                            continue
                        seen_ids.add(jid)
                        all_jobs.append(job)
                        kept += 1
                    source_counts[src] = source_counts.get(src, 0) + kept
                    fallback_source_counts[src] = fallback_source_counts.get(src, 0) + fallback_kept
                    logger.info(
                        "Job source %s returned %d raw, kept %d strict / %d closest after filters",
                        src, len(jobs_from_future), kept, fallback_kept,
                    )
                except Exception as e:
                    raw_msg = str(e)
                    redacted = _redact_secrets(raw_msg)
                    # Classify into a short, user-friendly reason.
                    lower = raw_msg.lower()
                    if "timed out" in lower or "timeout" in lower:
                        reason = "timed out"
                    elif "403" in lower or "forbidden" in lower:
                        reason = "access denied (actor may require rental)"
                    elif "401" in lower or "unauthorized" in lower:
                        reason = "invalid credentials"
                    elif "429" in lower:
                        reason = "rate limited"
                    else:
                        reason = redacted
                    logger.warning("Job source %s failed: %s", src, redacted)
                    errors.append(f"{src}: {reason}")

                # Stream what we have so far to the client.
                if partial_cb is not None:
                    pending_sources.discard(src)
                    try:
                        partial_scored = self.match_jobs(
                            list(all_jobs), user_email=user_email,
                        )
                        partial_cb({
                            "jobs": self._prepare_jobs_for_response(partial_scored),
                            "total": len(partial_scored),
                            "page": 1,
                            "total_pages": 1,
                            "queries_executed": len(queries),
                            "cache_hits": 0,
                            "errors": list(errors),
                            "sources": dict(source_counts),
                            "pending": sorted(pending_sources),
                            "streaming": True,
                        })
                    except Exception as stream_err:
                        logger.warning(
                            "Partial stream callback failed for %s: %s",
                            src, stream_err,
                        )

        matched = self.match_jobs(all_jobs, user_email=user_email)
        if not matched and fallback_jobs and not h1b_only:
            logger.info(
                "Strict job filters produced no rows; showing %d closest matches",
                len(fallback_jobs),
            )
            matched = self.match_jobs(fallback_jobs, user_email=user_email)
            source_counts = fallback_source_counts
        returned_jobs = self._prepare_jobs_for_response(matched)
        return {
            "jobs": returned_jobs,
            "total": len(matched),
            "page": 1,
            "total_pages": 1,
            "queries_executed": len(queries),
            "cache_hits": 0,
            "errors": errors,
            "sources": source_counts,
        }

    @staticmethod
    def _max_queries_for_source(src: str, total_queries: int) -> int:
        """How many queries each source is willing to absorb in one batch."""
        if src == "jsearch":
            return min(total_queries, MAX_JSEARCH_QUERIES_PER_BATCH)
        if src == "google":
            # parseforge/google-jobs-scraper is heavy — keep it small.
            return min(total_queries, 2)
        if src in ("company", "workday"):
            return 1  # company scraper is URL-driven, not query-driven
        return min(total_queries, MAX_QUERIES_PER_APIFY_SOURCE)

    def _actor_id(self, source: str) -> str:
        env_key = f"APIFY_{source.upper()}_ACTOR"
        configured = _get_config_value(env_key, "")
        return configured or self.APIFY_ACTORS[source]

    @staticmethod
    def _linkedin_search_url(
        query: str,
        location: str,
        date_posted: str,
        remote_only: bool,
        employment_type: str,
        experience_level: str,
    ) -> str:
        clean_query = _simplify_jsearch_query(query)
        params: Dict[str, str] = {
            "keywords": clean_query or query,
            "location": location or "United States",
        }
        days = JobService._date_posted_days(date_posted)
        if days:
            seconds = days * 24 * 60 * 60
            params["f_TPR"] = f"r{seconds}"
        if remote_only:
            params["f_WT"] = "2"
        linked_in_types = {
            "FULLTIME": "F",
            "PARTTIME": "P",
            "CONTRACTOR": "C",
            "INTERN": "I",
        }
        if employment_type in linked_in_types:
            params["f_JT"] = linked_in_types[employment_type]
        if experience_level in ("entry", "associate"):
            params["f_E"] = "2"
        elif experience_level == "internship":
            params["f_E"] = "1"
        return "https://www.linkedin.com/jobs/search/?" + urlencode(params)

    @staticmethod
    def _workday_location(location: str) -> str:
        normalized = (location or "").strip()
        if not normalized or normalized.lower() in {"us", "usa", "united states"}:
            return "United States"
        return normalized

    def _build_apify_input(
        self,
        source: str,
        query: str,
        location: str,
        date_posted: str,
        remote_only: bool,
        employment_type: str,
        experience_level: str,
        company_urls: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        days = self._date_posted_days(date_posted)
        location = location or "United States"
        query = query or "software engineer entry level"
        linkedin_type = {
            "FULLTIME": "full-time",
            "PARTTIME": "part-time",
            "INTERN": "internship",
            "CONTRACTOR": "contract",
        }.get(employment_type, "")
        indeed_type = {
            "FULLTIME": "fulltime",
            "PARTTIME": "parttime",
            "INTERN": "internship",
            "CONTRACTOR": "contract",
        }.get(employment_type, "")

        # Individual free-actor schemas vary wildly, so we send a permissive
        # payload containing the common field-name variants. Unknown fields
        # are ignored by each actor — this lets us swap actor IDs via env
        # var without retuning inputs.
        proxy_cfg = {"useApifyProxy": True, "apifyProxyCountry": "US"}
        days_str = str(days or 0)
        time_posted = (
            "past-24h" if days == 1
            else "past-week" if days and days <= 7
            else "past-month" if days else ""
        )

        if source == "linkedin":
            return {
                "urls": [
                    self._linkedin_search_url(
                        query=query,
                        location=location,
                        date_posted=date_posted,
                        remote_only=remote_only,
                        employment_type=employment_type,
                        experience_level=experience_level,
                    )
                ],
                "scrapeCompany": False,
                "count": 50,
                "splitByLocation": False,
            }
        if source == "workday":
            clean_query = _simplify_jsearch_query(query)
            workday_type = {
                "FULLTIME": "FULL_TIME",
                "PARTTIME": "PART_TIME",
                "INTERN": "INTERN",
                "CONTRACTOR": "CONTRACTOR",
            }.get(employment_type, "")
            payload: Dict[str, Any] = {
                "limit": 200,
                "includeAi": True,
                "includeLinkedIn": False,
                "titleSearch": [clean_query or query],
                "locationSearch": [self._workday_location(location)],
                "descriptionType": "text",
                "removeAgency": True,
            }
            if workday_type:
                payload["aiEmploymentTypeFilter"] = [workday_type]
            if remote_only:
                payload["aiWorkArrangementFilter"] = ["Remote OK", "Remote Solely"]
            if experience_level in ("entry", "internship", "associate"):
                payload["aiExperienceLevelFilter"] = ["0-2"]
            return payload
        if source == "indeed":
            return {
                "keyword": query, "keywords": query, "query": query,
                "position": query, "searchTerms": query,
                "country": "US", "countryCode": "us",
                "location": location,
                "maxItems": 50, "maxResults": 50, "limit": 50, "maxRows": 50,
                "datePosted": days_str,
                "fromDays": days_str,
                "remote": remote_only,
                "isRemote": remote_only,
                "sort": "date",
                "proxy": proxy_cfg,
                "proxyConfiguration": proxy_cfg,
            }
        if source == "google":
            google_date = {
                "today": "today", "3days": "3days",
                "week": "week", "month": "month",
            }.get(date_posted, "")
            return {
                "keyword": query, "keywords": query, "query": query,
                "searchTerms": query, "title": query,
                "location": location,
                "countryCode": "us", "country": "US", "languageCode": "en",
                "maxItems": 50, "maxResults": 50, "limit": 50,
                "includeDetails": True,
                "dateFilter": google_date,
                "datePosted": google_date,
                "fromDays": days_str,
                "proxy": proxy_cfg,
                "proxyConfiguration": proxy_cfg,
            }
        if source == "jobright":
            return {
                "query": query,
                "keywords": query,
                "location": location,
                "country": "United States",
                "countryCode": "us",
                "datePosted": date_posted,
                "fromDays": str(days or 0),
                "remote": remote_only,
                "employmentType": employment_type,
                "experienceLevel": experience_level,
                "maxItems": 35,
                "proxyConfiguration": {"useApifyProxy": True, "apifyProxyCountry": "US"},
            }
        return {
            "startUrls": [{"url": url} for url in (company_urls or TOP_COMPANY_CAREER_URLS[:COMPANY_CAREER_BATCH_SIZE])],
            "maxJobsPerCompany": COMPANY_CAREER_MAX_JOBS_PER_COMPANY,
            "includeClosed": False,
            "outputFormat": "jobs",
        }

    @staticmethod
    def _format_apify_location(raw: Dict[str, Any]) -> str:
        locations = raw.get("locations_derived")
        if isinstance(locations, list):
            formatted: List[str] = []
            for loc in locations[:3]:
                if isinstance(loc, dict):
                    parts = [loc.get("city"), loc.get("admin"), loc.get("country")]
                    text = ", ".join(str(p) for p in parts if p)
                else:
                    text = str(loc or "")
                if text and text not in formatted:
                    formatted.append(text)
            if formatted:
                return " | ".join(formatted)

        for key in ("locations_alt_raw", "locations_raw", "cities_derived", "regions_derived", "countries_derived"):
            values = raw.get(key)
            if isinstance(values, list) and values:
                formatted = []
                for value in values[:3]:
                    if isinstance(value, dict):
                        text = value.get("address") or value.get("name") or json.dumps(value, sort_keys=True)
                    else:
                        text = str(value or "")
                    if text and text not in formatted:
                        formatted.append(text)
                if formatted:
                    return " | ".join(formatted)
        return ""

    @staticmethod
    def _format_apify_salary(raw: Dict[str, Any]) -> str:
        salary_info = raw.get("salaryInfo")
        if isinstance(salary_info, list) and salary_info:
            return " - ".join(str(item) for item in salary_info if item)

        salary_raw = raw.get("salary_raw")
        if isinstance(salary_raw, dict):
            text = salary_raw.get("value") or salary_raw.get("text") or salary_raw.get("unitText")
            if text:
                return str(text)

        currency = raw.get("ai_salary_currency") or "$"
        unit = raw.get("ai_salary_unittext") or ""
        def _money(value: Any) -> Optional[float]:
            try:
                return float(str(value).replace(",", ""))
            except (TypeError, ValueError):
                return None

        min_salary = _money(raw.get("ai_salary_minvalue"))
        max_salary = _money(raw.get("ai_salary_maxvalue"))
        value = _money(raw.get("ai_salary_value"))
        if min_salary and max_salary:
            return f"{currency}{min_salary:,.0f} - {currency}{max_salary:,.0f} {unit}".strip()
        if value:
            return f"{currency}{value:,.0f} {unit}".strip()
        return ""

    def _normalize_apify_job(self, raw: Dict[str, Any], source: str) -> Dict[str, Any]:
        nested_job = raw.get("job") if isinstance(raw.get("job"), dict) else {}
        nested_company = raw.get("company") if isinstance(raw.get("company"), dict) else {}
        nested_apply = raw.get("apply") if isinstance(raw.get("apply"), dict) else {}
        nested_location = raw.get("location") if isinstance(raw.get("location"), dict) else {}
        nested_dates = nested_job.get("dates") if isinstance(nested_job.get("dates"), dict) else {}
        nested_branding = nested_company.get("branding") if isinstance(nested_company.get("branding"), dict) else {}

        company = (
            raw.get("company")
            if isinstance(raw.get("company"), str)
            else raw.get("companyName")
            or nested_company.get("name")
            or nested_company.get("displayName")
            or raw.get("organization")
            or "Unknown"
        )
        title = (
            raw.get("title")
            or raw.get("jobTitle")
            or raw.get("positionName")  # misceres/indeed-scraper
            or nested_job.get("title")
            or nested_job.get("displayTitle")
            or "Unknown"
        )
        description = (
            raw.get("description")
            or raw.get("description_text")
            or raw.get("description_html")
            or raw.get("descriptionText")
            or raw.get("jobDescription")
            or nested_job.get("descriptionText")
            or nested_job.get("jobDescription")
            or raw.get("ai_core_responsibilities")
            or raw.get("ai_requirements_summary")
            or raw.get("details")
            or ""
        )
        location = (
            raw.get("location")
            if isinstance(raw.get("location"), str)
            else raw.get("locationShort")
            or raw.get("jobLocation")
            or raw.get("formattedLocation")
            or nested_location.get("display")
            or nested_location.get("text")
            or ", ".join([p for p in [nested_location.get("city"), nested_location.get("state"), nested_location.get("country")] if p])
            or self._format_apify_location(raw)
            or "Not specified"
        )
        salary_obj = nested_job.get("salary") if isinstance(nested_job.get("salary"), dict) else {}
        salary_insights = raw.get("salaryInsights") if isinstance(raw.get("salaryInsights"), dict) else {}
        salary = (
            raw.get("salary")
            or raw.get("salaryText")
            or raw.get("salarySnippet")
            or salary_obj.get("text")
            or salary_insights.get("compensationRange")
            or salary_insights.get("text")
            or self._format_apify_salary(raw)
            or ""
        )
        employment_type = raw.get("employmentType") or raw.get("employment_type") or raw.get("ai_employment_type") or nested_job.get("jobType") or ""
        if isinstance(employment_type, list):
            employment_type = ", ".join(str(t) for t in employment_type)
        posted = (
            raw.get("postedDate")
            or raw.get("date_posted")
            or raw.get("datePosted")
            or raw.get("postedAt")
            or raw.get("publishedAt")
            or raw.get("posted_time")
            or nested_dates.get("datePublished")
            or ""
        )
        posted_text = raw.get("postedTimeAgo") or raw.get("postedText") or raw.get("postedTime") or nested_dates.get("postedText") or ""
        apply_links = raw.get("applyLinks") if isinstance(raw.get("applyLinks"), list) else []
        first_apply_link = apply_links[0] if apply_links else {}
        if isinstance(first_apply_link, dict):
            first_apply_link = first_apply_link.get("url") or first_apply_link.get("link") or ""
        apply_link = (
            raw.get("applyUrl")
            or raw.get("apply_link")
            or raw.get("jobUrl")
            or raw.get("externalApplyLink")  # misceres/indeed-scraper
            or raw.get("link")                # bebity/linkedin-jobs-scraper
            or raw.get("url")
            or first_apply_link
            or nested_apply.get("thirdPartyApplyUrl")
            or nested_apply.get("url")
            or ""
        )
        logo = (
            raw.get("companyLogo")
            or raw.get("organization_logo")
            or raw.get("logoUrl")             # bebity
            or raw.get("companyLogoUrl")      # misceres
            or raw.get("logo")
            or nested_branding.get("logoUrl")
            or ""
        )
        is_remote = bool(
            raw.get("isRemote")
            or raw.get("remote")
            or raw.get("remote_derived")
            or str(raw.get("location_type") or "").upper() == "TELECOMMUTE"
            or "remote" in str(raw.get("ai_work_arrangement") or "").lower()
            or nested_job.get("isRemote")
            or "remote" in str(location).lower()
        )
        contract = self._is_contract_friendly({"title": title, "description": description, "employment_type": employment_type})
        h1b = bool(raw.get("ai_visa_sponsorship")) or self._check_h1b(str(company), description)
        job_id = str(raw.get("jobId") or raw.get("job_id") or raw.get("id") or nested_job.get("id") or nested_job.get("jobKey") or "")
        if not job_id:
            job_id = hashlib.md5(f"{source}|{company}|{title}|{apply_link}".encode()).hexdigest()

        return {
            "job_id": f"{source}:{job_id}",
            "title": str(title).strip(),
            "company": str(company).strip(),
            "logo": logo,
            "location": str(location).strip(),
            "apply_link": apply_link,
            "description": str(description),
            "salary": str(salary),
            "employment_type": str(employment_type),
            "date_posted": str(posted),
            "posted_text": str(posted_text),
            "is_remote": is_remote,
            "h1b_sponsor": h1b,
            "contract_friendly": contract,
            "source": source.title() if source != "company" else "Company Careers",
        }

    @staticmethod
    def _prepare_jobs_for_response(jobs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        prepared: List[Dict[str, Any]] = []
        for job in jobs[:MAX_RETURNED_JOBS]:
            item = dict(job)
            description = str(item.get("description") or "")
            if len(description) > JOB_DESCRIPTION_MAX_CHARS:
                item["description"] = description[:JOB_DESCRIPTION_MAX_CHARS].rstrip() + "..."
            missing = item.get("missing_skills")
            if isinstance(missing, list) and len(missing) > 30:
                item["missing_skills"] = missing[:30]
            matched = item.get("matched_skills")
            if isinstance(matched, list) and len(matched) > 20:
                item["matched_skills"] = matched[:20]
            prepared.append(item)
        return prepared

    def _prepare_result_for_response(self, result: Dict[str, Any]) -> Dict[str, Any]:
        prepared = dict(result)
        jobs = prepared.get("jobs")
        if isinstance(jobs, list):
            prepared["jobs"] = self._prepare_jobs_for_response(jobs)
            prepared["total"] = len(prepared["jobs"])
            prepared["total_pages"] = prepared.get("total_pages", 1)
        return prepared

    def _job_matches_filters(
        self,
        job: Dict[str, Any],
        query_terms: List[str],
        location: str,
        date_posted: str,
        h1b_only: bool,
        visa_or_contract: bool,
        experience_level: str,
    ) -> bool:
        if date_posted != "all" and not self._is_recent_job(job, date_posted):
            return False
        if h1b_only and not job.get("h1b_sponsor"):
            return False
        if visa_or_contract and not (job.get("h1b_sponsor") or job.get("contract_friendly")):
            return False
        if experience_level in ("entry", "internship", "associate") and not self._is_entry_level(job):
            return False
        if location and location.lower() not in {"united states", "usa", "us"}:
            loc = (job.get("location") or "").lower()
            if location.lower() not in loc and "remote" not in loc:
                return False
        if job.get("source") == "Company Careers" and query_terms:
            haystack = f"{job.get('title', '')} {job.get('description', '')}".lower()
            keywords = set()
            for query in query_terms:
                keywords.update(t for t in re.split(r"[^a-z0-9+#.]+", query.lower()) if len(t) > 2)
            ignored = {"entry", "level", "new", "grad", "h1b", "sponsor", "contract", "engineer"}
            keywords -= ignored
            if keywords and not any(k in haystack for k in keywords):
                return False
        return True

    @staticmethod
    def _date_posted_days(date_posted: str) -> Optional[int]:
        return {
            "today": 1,
            "3days": 3,
            "week": 7,
            "month": 30,
            "all": None,
        }.get(date_posted, 1)

    def _is_recent_job(self, job: Dict[str, Any], date_posted: str) -> bool:
        days = self._date_posted_days(date_posted)
        if not days:
            return True
        raw_date = str(job.get("date_posted") or "")
        posted_text = str(job.get("posted_text") or "").lower()
        if posted_text:
            if any(token in posted_text for token in ("hour", "minute", "just now", "today")):
                return True
            match = re.search(r"(\d+)\s+day", posted_text)
            if match:
                return int(match.group(1)) <= days
            if "week" in posted_text:
                return days >= 7
            if "month" in posted_text:
                return days >= 30
        if not raw_date:
            return True
        candidates = [raw_date, raw_date[:10]]
        for candidate in candidates:
            try:
                normalized = candidate.replace("Z", "+00:00")
                dt = datetime.fromisoformat(normalized)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt >= datetime.now(timezone.utc) - timedelta(days=days)
            except Exception:
                continue
        return True

    @staticmethod
    def _is_contract_friendly(job: Dict[str, Any]) -> bool:
        text = f"{job.get('title', '')} {job.get('description', '')} {job.get('employment_type', '')}".lower()
        return any(keyword in text for keyword in CONTRACT_KEYWORDS)

    @staticmethod
    def _is_entry_level(job: Dict[str, Any]) -> bool:
        text = f"{job.get('title', '')} {job.get('description', '')} {job.get('employment_type', '')}".lower()
        senior_markers = ["senior", "sr.", "principal", "staff", "lead", "manager", "director", "architect"]
        if any(marker in text for marker in senior_markers):
            return False
        return any(kw in text for kw in NEW_GRAD_KEYWORDS)

    def _normalize_job(self, raw: dict) -> Dict[str, Any]:
        company = (raw.get("employer_name") or "Unknown").strip()
        normalized = {
            "job_id": raw.get("job_id", ""),
            "title": raw.get("job_title", "Unknown"),
            "company": company,
            "logo": raw.get("employer_logo", ""),
            "location": self._build_location(raw),
            "apply_link": raw.get("job_apply_link", ""),
            "description": raw.get("job_description", ""),
            "salary": self._build_salary(raw),
            "employment_type": raw.get("job_employment_type", ""),
            "date_posted": raw.get("job_posted_at_datetime_utc", ""),
            "is_remote": raw.get("job_is_remote", False),
            "h1b_sponsor": self._check_h1b(company, raw.get("job_description", "")),
            "source": "JSearch",
            "posted_text": raw.get("job_posted_at", ""),
        }
        normalized["contract_friendly"] = self._is_contract_friendly(normalized)
        return normalized

    @staticmethod
    def _build_location(raw: dict) -> str:
        city = raw.get("job_city", "")
        state = raw.get("job_state", "")
        country = raw.get("job_country", "")
        parts = [p for p in [city, state, country] if p]
        return ", ".join(parts) or "Not specified"

    @staticmethod
    def _build_salary(raw: dict) -> str:
        min_s = raw.get("job_min_salary")
        max_s = raw.get("job_max_salary")
        period = raw.get("job_salary_period", "")
        if min_s and max_s:
            return f"${min_s:,.0f} - ${max_s:,.0f} {period}".strip()
        if min_s:
            return f"${min_s:,.0f}+ {period}".strip()
        if max_s:
            return f"Up to ${max_s:,.0f} {period}".strip()
        return ""

    @staticmethod
    def _check_h1b(company: str, description: str) -> bool:
        company_lower = company.lower()
        for sponsor in H1B_SPONSORS:
            if sponsor in company_lower:
                return True
        desc_lower = description.lower()
        if "h1b" in desc_lower or "h-1b" in desc_lower or "visa sponsor" in desc_lower:
            return True
        return False

    # ------------------------------------------------------------------
    # Skill Matching
    # ------------------------------------------------------------------

    def match_jobs(self, jobs: List[Dict], user_email: str = "") -> List[Dict]:
        resume_skills = self._get_resume_skills(user_email=user_email)
        all_skills = set(s.lower() for s in PORTFOLIO_SKILLS)
        all_skills.update(s.lower() for s in resume_skills)

        for job in jobs:
            desc_lower = (job.get("description", "") + " " + job.get("title", "")).lower()
            matched = []
            for skill in all_skills:
                pattern = r"\b" + re.escape(skill) + r"\b" if len(skill) > 2 else re.escape(skill)
                if re.search(pattern, desc_lower, re.IGNORECASE):
                    matched.append(skill)

            score = min(len(matched) * 10, 70)  # cap skill portion at 70
            if job.get("h1b_sponsor"):
                score += 15
            title_desc = (job.get("title", "") + " " + job.get("description", "")).lower()
            if any(kw in title_desc for kw in NEW_GRAD_KEYWORDS):
                score += 10
            if job.get("is_remote"):
                score += 5
            score = min(score, 100)

            job["match_score"] = score
            job["matched_skills"] = sorted(set(matched))
            job["missing_skills"] = sorted(all_skills - set(matched))

        jobs.sort(key=lambda j: j["match_score"], reverse=True)
        return jobs

    def _get_resume_skills(self, user_email: str = "") -> List[str]:
        """Get flat skills list from the stored resume for this user."""
        if not user_email:
            return []
        try:
            resume = self.user_resumes.find_one(
                {"user_email": user_email, "skills": {"$exists": True}},
                sort=[("parsed_at", -1)],
            )
            if resume:
                return resume.get("skills", [])
        except Exception as e:
            logger.warning(f"Failed to load resume skills for {user_email}: {e}")
        return []

    def get_resume(self, user_email: str = "") -> Optional[Dict[str, Any]]:
        """Retrieve the latest stored resume for this user (used by analyze_job)."""
        if not user_email:
            return None
        resume = self.user_resumes.find_one(
            {"user_email": user_email, "skills": {"$exists": True}, "parsed_at": {"$exists": True}},
            sort=[("parsed_at", -1)],
        )
        if resume:
            resume.pop("_id", None)
        return resume

    # ------------------------------------------------------------------
    # AI Job Analysis
    # ------------------------------------------------------------------

    def analyze_job(self, job: Dict[str, Any], action: str, user_email: str = "") -> str:
        from services.chat_service import _get_client, PORTFOLIO_CONTEXT
        from google.genai import types

        client = _get_client()

        resume = self.get_resume(user_email=user_email)
        resume_info = ""
        if resume:
            resume_info = (
                f"\nCandidate skills: {', '.join(resume.get('skills', []))}\n"
                f"Experience: {resume.get('experience_years', 'N/A')} years\n"
                f"Summary: {resume.get('summary', 'N/A')}\n"
            )

        job_info = (
            f"Job Title: {job.get('title', 'N/A')}\n"
            f"Company: {job.get('company', 'N/A')}\n"
            f"Location: {job.get('location', 'N/A')}\n"
            f"Description:\n{job.get('description', 'N/A')[:4000]}\n"
        )

        prompts = {
            "summarize": (
                f"Summarize this job posting concisely. Highlight key responsibilities, "
                f"requirements, and what makes it a good or poor fit for the candidate.\n\n"
                f"{job_info}\n{resume_info}\n{PORTFOLIO_CONTEXT[:2000]}"
            ),
            "missing_skills": (
                f"Analyze the gap between the candidate's skills and this job's requirements. "
                f"List missing skills, suggest learning resources, and rate the gap (Low/Medium/High).\n\n"
                f"{job_info}\n{resume_info}\n{PORTFOLIO_CONTEXT[:2000]}"
            ),
            "cover_letter": (
                f"Write a professional cover letter for this job tailored to the candidate. "
                f"Highlight relevant projects and experience. Keep it under 400 words.\n\n"
                f"{job_info}\n{resume_info}\n{PORTFOLIO_CONTEXT[:2000]}"
            ),
        }

        prompt = prompts.get(action)
        if not prompt:
            raise ValueError(f"Unknown action: {action}")

        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=[types.Content(role="user", parts=[types.Part(text=prompt)])],
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=2048,
            ),
        )
        return response.text

    # ------------------------------------------------------------------
    # Saved Jobs CRUD
    # ------------------------------------------------------------------

    def get_saved_jobs(self, user_email: str) -> List[Dict[str, Any]]:
        jobs = list(self.saved_jobs.find({"user_email": user_email}).sort("saved_at", -1))
        for j in jobs:
            j["_id"] = str(j["_id"])
        return jobs

    def save_job(self, job: Dict[str, Any], user_email: str) -> Dict[str, Any]:
        doc = {
            "job_id": job.get("job_id", ""),
            "user_email": user_email,
            "job_data": job,
            "status": "interested",
            "notes": "",
            "saved_at": datetime.now(timezone.utc),
        }
        self.saved_jobs.update_one(
            {"job_id": doc["job_id"], "user_email": user_email},
            {"$set": doc},
            upsert=True,
        )
        result = self.saved_jobs.find_one({"job_id": doc["job_id"], "user_email": user_email})
        result["_id"] = str(result["_id"])
        return result

    def update_saved_job(
        self, job_id: str, status: Optional[str] = None, notes: Optional[str] = None,
        user_email: str = ""
    ) -> Optional[Dict[str, Any]]:
        update = {}
        if status is not None:
            update["status"] = status
        if notes is not None:
            update["notes"] = notes
        if not update:
            return None
        query = {"job_id": job_id, "user_email": user_email}
        self.saved_jobs.update_one(query, {"$set": update})
        result = self.saved_jobs.find_one(query)
        if result:
            result["_id"] = str(result["_id"])
        return result

    def delete_saved_job(self, job_id: str, user_email: str = "") -> bool:
        result = self.saved_jobs.delete_one({"job_id": job_id, "user_email": user_email})
        return result.deleted_count > 0

    # ------------------------------------------------------------------
    # Saved Search Filters
    # ------------------------------------------------------------------

    def get_saved_filters(self, user_email: str) -> Optional[Dict[str, Any]]:
        result = self.job_filter_preferences.find_one({"user_email": user_email})
        if not result:
            return None
        result["_id"] = str(result["_id"])
        if hasattr(result.get("updated_at"), "isoformat"):
            result["updated_at"] = result["updated_at"].isoformat()
        return result

    def save_filters(self, filters: Dict[str, Any], user_email: str) -> Dict[str, Any]:
        doc = {
            "user_email": user_email,
            "filters": filters,
            "updated_at": datetime.now(timezone.utc),
        }
        self.job_filter_preferences.update_one(
            {"user_email": user_email},
            {"$set": doc},
            upsert=True,
        )
        result = self.job_filter_preferences.find_one({"user_email": user_email})
        result["_id"] = str(result["_id"])
        if hasattr(result.get("updated_at"), "isoformat"):
            result["updated_at"] = result["updated_at"].isoformat()
        return result


# Singleton
_job_service = None


def get_job_service() -> JobService:
    global _job_service
    if _job_service is None:
        _job_service = JobService()
    return _job_service
