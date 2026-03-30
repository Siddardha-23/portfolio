"""
Job Search Service - JSearch API integration, skill matching, resume parsing, AI analysis

Provides:
- Job search via JSearch (RapidAPI) with MongoDB caching
- Skill-based job matching and scoring
- Resume parsing via Gemini AI
- Job analysis (summary, missing skills, cover letter)
- Saved jobs CRUD
- H1B sponsor detection
"""
import hashlib
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

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
}

# ---- New-grad keywords ----
NEW_GRAD_KEYWORDS = [
    "new grad", "new graduate", "entry level", "entry-level",
    "junior", "associate", "early career", "recent graduate",
    "0-2 years", "0-1 years", "graduate program",
]


def _make_cache_key(params: dict) -> str:
    """Create a deterministic MD5 hash from query parameters."""
    normalized = json.dumps(params, sort_keys=True)
    return hashlib.md5(normalized.encode()).hexdigest()


class JobService:
    """Singleton service for job search, matching, analysis, and saved-jobs."""

    JSEARCH_BASE = "https://jsearch.p.rapidapi.com"
    CACHE_TTL_SECONDS = 6 * 3600  # 6 hours

    def __init__(self):
        self.db = DBConnect().get_db()
        self.jobs_cache = self.db.jobs_cache
        self.user_resumes = self.db.user_resumes
        self.saved_jobs = self.db.saved_jobs
        self._ensure_indexes()

    def _ensure_indexes(self):
        try:
            self.jobs_cache.create_index("query_hash", unique=True)
            self.jobs_cache.create_index(
                "cached_at", expireAfterSeconds=self.CACHE_TTL_SECONDS
            )
            self.saved_jobs.create_index("job_id", unique=True)
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
        user_email: str = "",
    ) -> Dict[str, Any]:
        params = {
            "query": query,
            "page": page,
            "location": location,
            "date_posted": date_posted,
            "remote_only": remote_only,
            "employment_type": employment_type,
            # Cache results per-user because match_score is resume-specific.
            "user_email": user_email,
        }
        cache_key = _make_cache_key(params)

        # Check cache
        cached = self.jobs_cache.find_one({"query_hash": cache_key})
        if cached:
            cached.pop("_id", None)
            return cached["result"]

        # Fetch from JSearch
        api_key = _get_config_value('JSEARCH_API_KEY', '')
        if not api_key:
            raise RuntimeError("JSEARCH_API_KEY is not configured")

        headers = {
            "X-RapidAPI-Key": api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
        api_params = {
            "query": query,
            "page": str(page),
            "num_pages": "1",
            "date_posted": date_posted,
        }
        if location:
            api_params["query"] = f"{query} in {location}"
        if remote_only:
            api_params["remote_jobs_only"] = "true"
        if employment_type:
            api_params["employment_types"] = employment_type

        resp = requests.get(
            f"{self.JSEARCH_BASE}/search",
            headers=headers,
            params=api_params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        jobs = [self._normalize_job(j) for j in data.get("data", [])]
        matched = self.match_jobs(jobs, user_email=user_email)

        result = {
            "jobs": matched,
            "total": data.get("parameters", {}).get("num_pages", 1),
            "page": page,
        }

        # Store in cache
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

        return result

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
        user_email: str = "",
    ) -> Dict[str, Any]:
        """Run multiple search queries in parallel, deduplicate, and re-score."""
        seen_ids: set = set()
        all_jobs: List[Dict] = []
        errors: List[str] = []
        cache_hits = 0

        def _run_query(query: str) -> Dict[str, Any]:
            """Execute a single search query (may hit cache)."""
            params = {
                "query": query, "page": 1, "location": location,
                "date_posted": date_posted, "remote_only": remote_only,
                "employment_type": employment_type,
                "user_email": user_email,
            }
            cache_key = _make_cache_key(params)
            cached = self.jobs_cache.find_one({"query_hash": cache_key})
            if cached:
                cached.pop("_id", None)
                return {"jobs": cached["result"].get("jobs", []), "cached": True}

            # Not cached — call JSearch API
            result = self.search_jobs(
                query=query, page=1, location=location,
                date_posted=date_posted, remote_only=remote_only,
                employment_type=employment_type,
                user_email=user_email,
            )
            return {"jobs": result.get("jobs", []), "cached": False}

        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {pool.submit(_run_query, q): q for q in queries}
            for future in as_completed(futures):
                query = futures[future]
                try:
                    result = future.result()
                    if result["cached"]:
                        cache_hits += 1
                    for job in result["jobs"]:
                        jid = job.get("job_id")
                        if jid and jid not in seen_ids:
                            seen_ids.add(jid)
                            all_jobs.append(job)
                except Exception as e:
                    logger.warning(f"Batch query '{query}' failed: {e}")
                    errors.append(f"{query}: {str(e)}")

        # Filter stale results when searching for today
        if date_posted == "today":
            all_jobs = self._filter_today_jobs(all_jobs)

        # Re-score the merged set
        all_jobs = self.match_jobs(all_jobs, user_email=user_email)

        return {
            "jobs": all_jobs,
            "total": len(all_jobs),
            "queries_executed": len(queries),
            "cache_hits": cache_hits,
            "errors": errors,
        }

    @staticmethod
    def _filter_today_jobs(jobs: List[Dict]) -> List[Dict]:
        """Keep only jobs whose date_posted starts with today's ISO date prefix."""
        today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filtered = []
        for job in jobs:
            dp = job.get("date_posted", "")
            # Keep if date matches today OR if date is missing (don't discard)
            if not dp or dp.startswith(today_prefix):
                filtered.append(job)
        return filtered

    def _normalize_job(self, raw: dict) -> Dict[str, Any]:
        company = (raw.get("employer_name") or "Unknown").strip()
        return {
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
        }

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
                {"user_email": user_email},
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
            {"user_email": user_email},
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


# Singleton
_job_service = None


def get_job_service() -> JobService:
    global _job_service
    if _job_service is None:
        _job_service = JobService()
    return _job_service
