"""
Portfolio Knowledge Base — structured corpus the agentic AI reasons over.

The corpus is split into typed entries (project, experience, skill, education,
certification, philosophy, contact). Each entry carries a stable id, a short
summary, full text, evidence links, and skill tags. The same data backs:

    - Curator (search_my_work, explain_project, show_evidence)
    - Analyst (am_i_a_fit — needs the skill index)
    - Concierge (book_chat — pulls contact channels)

Search uses lightweight TF-IDF cosine similarity computed in-process. No new
infrastructure needed; <2ms per query for ~30 entries. Easy to swap for Atlas
Vector Search later by replacing `_search_corpus`.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ──────────────────────────────────────────────────────────────────────────
# Data model
# ──────────────────────────────────────────────────────────────────────────

@dataclass
class KBEntry:
    id: str
    kind: str           # project | experience | skill | education | certification | philosophy | contact
    title: str
    summary: str        # 1-2 sentence pitch
    body: str           # full text used for RAG
    skills: List[str] = field(default_factory=list)
    evidence: List[Dict[str, str]] = field(default_factory=list)  # [{label, url}]
    period: Optional[str] = None
    impact: Optional[str] = None  # quantified outcome
    metadata: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "summary": self.summary,
            "skills": self.skills,
            "evidence": self.evidence,
            "period": self.period,
            "impact": self.impact,
            "metadata": self.metadata,
        }


# ──────────────────────────────────────────────────────────────────────────
# The corpus — single source of truth referenced by every tool
# ──────────────────────────────────────────────────────────────────────────

CONTACT = {
    "name": "Harshith Siddardha Manne",
    "email": "harshith.siddardha@gmail.com",
    "phone": "602-580-1838",
    "linkedin": "https://linkedin.com/in/harshith-siddardha",
    "github": "https://github.com/Siddardha-23",
    "site": "https://manneharshithsiddardha.com",
    "calendar_hint": "Reach out by email or LinkedIn for the fastest reply.",
}

CORPUS: List[KBEntry] = [
    # ── PHILOSOPHY / ELEVATOR PITCH ────────────────────────────────────────
    KBEntry(
        id="who",
        kind="philosophy",
        title="Who Harshith is",
        summary="Cloud & DevOps engineer + AI builder. ASU MS-IT (4.0 GPA). Ships small, real, often.",
        body=(
            "Harshith is a Cloud & DevOps engineer pursuing his MS in Information Technology at "
            "Arizona State University (Aug 2024 - May 2026, 4.0 GPA). He has ~1.5 years of "
            "professional experience plus an active portfolio of side projects spanning AWS Lambda "
            "serverless, EKS production migrations, multi-tenant SaaS, and agentic AI. He prefers "
            "building things end-to-end and showing receipts over claiming skills."
        ),
        skills=["cloud", "devops", "aws", "ai", "python", "react"],
    ),

    # ── PROJECTS ───────────────────────────────────────────────────────────
    KBEntry(
        id="proj-portfolio",
        kind="project",
        title="Cloud-Deployed Personal Portfolio",
        summary="Serverless full-stack portfolio on AWS — 5 Flask Lambdas + React SPA, ~$3/mo to run.",
        body=(
            "Production-grade portfolio site: React + TypeScript SPA on S3/CloudFront, five Flask "
            "microservices on AWS Lambda fronted by API Gateway HTTP API, MongoDB Atlas as the "
            "persistence layer, all secrets in SSM Parameter Store, X-Ray distributed tracing wired "
            "across services. CI/CD via GitHub Actions matrix deploy with cache invalidation. "
            "Hosts an agentic AI concierge, 3D visitor globe (Three.js), edge latency tester, AWS "
            "infra cost calculator, security scorecard, and a full ATS resume-tailoring pipeline."
        ),
        skills=["aws", "lambda", "cloudfront", "s3", "api gateway", "terraform", "react",
                "typescript", "flask", "python", "mongodb", "ci/cd", "github actions", "x-ray"],
        evidence=[
            {"label": "Live site", "url": "https://manneharshithsiddardha.com"},
            {"label": "GitHub repo", "url": "https://github.com/Siddardha-23/portfolio"},
        ],
        period="Dec 2024 – Present",
        impact="<$5/mo total AWS spend, sub-200ms edge latency, 5 services deployed in parallel",
    ),
    KBEntry(
        id="proj-aerosec",
        kind="project",
        title="AEROSEC — Cybersecurity in Connected Aviation",
        summary="Honeywell-guided real-time vendor cyber risk platform for aviation third-party APIs.",
        body=(
            "Capstone-level innovation project targeting the aviation industry's third-party API "
            "attack surface (PSS, payment, loyalty, booking systems). Conducted 20+ stakeholder "
            "interviews including FAA, Air France-KLM, Delta, and aviation cybersecurity engineers. "
            "Built a vendor cyber risk dashboard with AI-driven anomaly detection and automated "
            "compliance scoring against NIST CSF 2.0, ISO 27001, and DO-326A. Includes full "
            "TAM-SAM-SOM analysis ($200B → $15B → $2B) and a 5-year SaaS financial projection."
        ),
        skills=["cybersecurity", "nist csf", "iso 27001", "do-326a", "api security", "ai/ml",
                "risk analytics", "aviation"],
        period="Aug 2025 – Dec 2025",
        impact="20+ industry interviews, full compliance-mapped dashboard prototype",
    ),
    KBEntry(
        id="proj-cicd",
        kind="project",
        title="AWS CI/CD Microservices Architecture",
        summary="Fully automated 4-service ECS Fargate platform with 3-tier VPC, zero-downtime deploys.",
        body=(
            "Designed and deployed a production-grade microservices architecture: 3-tier VPC, four "
            "containerized ECS Fargate services (Frontend, Backend, AI Service, Third-party API) "
            "behind an Application Load Balancer with path-based routing. End-to-end CI/CD: "
            "CodeCommit → EventBridge → CodePipeline → CodeBuild → ECR → ECS rolling updates. "
            "Defense-in-depth via chained security groups, private-only RDS, ACM-issued TLS."
        ),
        skills=["aws", "ecs", "fargate", "cloudformation", "docker", "ci/cd", "rds", "alb", "vpc"],
        period="Jan 2025 – May 2025",
        impact="Zero-downtime deploys, immutable Docker images, full IaC provisioning",
    ),
    KBEntry(
        id="proj-multitenant",
        kind="project",
        title="Cross-Account CI/CD Multi-Tenancy Architecture",
        summary="Single DevOps account building → many isolated tenant accounts deploying. Blast-radius zero.",
        body=(
            "Centralized build pipeline in a primary DevOps AWS account that deploys to multiple "
            "isolated tenant accounts via cross-account IAM roles, KMS-encrypted artifact sharing "
            "in S3, and per-tenant CloudFormation stacks. Each tenant has its own ECS cluster, "
            "VPC, and RDS — guaranteeing zero cross-tenant data leakage and allowing horizontal "
            "scale of environments without blast-radius overlap."
        ),
        skills=["aws", "iam", "kms", "cloudformation", "ecs", "multi-tenancy", "ci/cd"],
        period="Mar 2025 – May 2025",
        impact="True account-level isolation across N tenants from one pipeline",
    ),
    KBEntry(
        id="proj-slate",
        kind="project",
        title="SLATE — Ephemeral Test Environments",
        summary="GitOps system that spins up production-like sandbox per PR, auto-destroys on merge.",
        body=(
            "Each pull request triggers a GitHub Actions workflow that runs Terraform to provision "
            "an isolated AWS environment — containerized Flask app, dedicated DB, supporting "
            "services. A web dashboard lets engineers request, monitor, and tear down environments "
            "on demand. Teardown is automatic on PR close, eliminating staging-server contention "
            "and giving every PR a real production-like testbed."
        ),
        skills=["aws", "terraform", "github actions", "docker", "flask", "ecs", "gitops"],
        period="Jan 2025 – Present",
        impact="Eliminated staging bottleneck, 1 environment per PR with auto-cleanup",
    ),
    KBEntry(
        id="proj-agent",
        kind="project",
        title="Agentic AI Concierge (this site)",
        summary="Multi-agent orchestrator with Gemini function calling — Curator, Builder, Analyst, Concierge.",
        body=(
            "The concierge you're talking to right now. A multi-agent system on top of Google "
            "Gemini with native function calling: an orchestrator decomposes intent and routes to "
            "specialist sub-agents (Curator searches the portfolio knowledge base, Builder reports "
            "live engineering activity from GitHub commits, Analyst scores fit against a job "
            "description, Concierge handles intros and contact). Streams reasoning + tool calls "
            "live via Server-Sent Events. Backed by the existing Flask Lambda + MongoDB Atlas "
            "stack — zero new infrastructure."
        ),
        skills=["agentic ai", "gemini", "function calling", "rag", "sse", "python", "lambda",
                "mongodb", "react", "typescript", "framer-motion"],
        period="Apr 2026",
        impact="Live multi-agent UX with visible reasoning trail",
    ),

    # ── EXPERIENCE ─────────────────────────────────────────────────────────
    KBEntry(
        id="exp-deepalg",
        kind="experience",
        title="Associate Data Scientist (Cloud/DevOps) — Deep Algorithms & Solutions",
        summary="Architected 3-tier VPC + end-to-end CI/CD on AWS. +45% deploy efficiency.",
        body=(
            "Full-time role (May 2023 – May 2024, Hyderabad): architected and deployed a secure, "
            "scalable 3-tier VPC using Terraform and CloudFormation, integrated EC2 / S3 / ECS / "
            "ECR / CodePipeline / CodeCommit for end-to-end CI/CD. Containerized Python-Flask "
            "backends with Docker, embedded Nginx for routing, deployed to ECS Fargate. Improved "
            "deployment efficiency by 45% via Dockerfile optimization and ECS task tuning. "
            "Enforced AWS Well-Architected compliance with strict IAM and CloudTrail auditing."
        ),
        skills=["aws", "terraform", "cloudformation", "docker", "flask", "ci/cd", "ecs", "iam"],
        period="May 2023 – May 2024",
        impact="+45% deployment efficiency, +50% scalability via autoscaled multi-tier networking",
    ),
    KBEntry(
        id="exp-backflipt",
        kind="experience",
        title="Associate Software Developer Intern — Backflipt Xenovous",
        summary="Reactive Spring Boot backend + React Native feature work for IDC project.",
        body=(
            "Internship (Jan 2023 – Apr 2023): backend developer on the International Data "
            "Corporation (IDC) project. Built scalable APIs in Java + Spring Boot + Reactive "
            "Spring Boot. Supported React Native debugging and feature delivery including Redux "
            "state management and React Navigation."
        ),
        skills=["java", "spring boot", "reactive spring", "react native", "redux"],
        period="Jan 2023 – Apr 2023",
    ),
    KBEntry(
        id="exp-deepalg-intern",
        kind="experience",
        title="Data Science & Cloud Intern — Deep Algorithms & Solutions",
        summary="Onboarded to Python/Flask and AWS; +30% troubleshooting via bash automation.",
        body=(
            "Internship (Jan 2021 – May 2022): learned Python, Flask, and DevOps basics; "
            "automated Flask deployments to EC2 and ECS using Docker; explored 15+ AWS services "
            "(CodeCommit, S3, CloudWatch, CloudFormation); wrote bash automation for Linux log "
            "parsing and system maintenance, improving troubleshooting speed by 30%."
        ),
        skills=["python", "flask", "docker", "aws", "bash", "linux"],
        period="Jan 2021 – May 2022",
        impact="+30% troubleshooting efficiency via bash automation",
    ),

    # ── EDUCATION ──────────────────────────────────────────────────────────
    KBEntry(
        id="edu-asu",
        kind="education",
        title="MS in Information Technology — Arizona State University",
        summary="Ira A. Fulton Schools of Engineering, 4.0 / 4.0 GPA, graduating May 2026.",
        body=(
            "Master of Science in Information Technology at Arizona State University (Aug 2024 – "
            "May 2026, 4.0 GPA). Coursework spans Cloud Architecture, Cloud Security & Ops, "
            "Network Forensics, Advanced DBMS, Information Systems Security, Security Compliance, "
            "and Technology Innovation Lab."
        ),
        skills=["cloud architecture", "cloud security", "network forensics", "dbms", "security compliance"],
        period="Aug 2024 – May 2026",
    ),
    KBEntry(
        id="edu-jntu",
        kind="education",
        title="BTech in Computer Science — JNTU Kakinada",
        summary="First Class with Distinction, 3.7 / 4.0 GPA, Best Project Award, Technical Club Lead.",
        body=(
            "Bachelor of Technology, Computer Science, JNTU Kakinada / University College of "
            "Engineering, Kakinada, India (2019 – May 2023). 3.7 GPA. First Class with Distinction. "
            "Technical Club Lead and Best Project Award winner. Coursework: DSA, DBMS, Networks, "
            "OS, Machine Learning."
        ),
        skills=["data structures", "algorithms", "dbms", "networks", "operating systems", "ml"],
        period="2019 – May 2023",
    ),

    # ── CERTIFICATIONS ─────────────────────────────────────────────────────
    KBEntry(
        id="cert-aws",
        kind="certification",
        title="AWS Academy Graduate (Security Foundations, Cloud Operations, Architecting) + Cloud Quest",
        summary="Four AWS credentials: Cloud Practitioner (2024), Architecting (Apr 2025), Cloud Ops (Oct 2025), Security Foundations (Oct 2025).",
        body=(
            "AWS Cloud Quest: Cloud Practitioner (Dec 2024). AWS Academy Graduate — Cloud "
            "Architecting (Apr 2025). AWS Academy Graduate — Cloud Operations (Oct 2025). "
            "AWS Academy Graduate — Cloud Security Foundations (Oct 2025). Targeting AWS "
            "Solutions Architect Associate next."
        ),
        skills=["aws", "cloud architecting", "cloud security", "cloud operations"],
    ),

    # ── SKILL CLUSTERS (helps Analyst.am_i_a_fit) ──────────────────────────
    KBEntry(
        id="skill-cloud",
        kind="skill",
        title="Cloud & DevOps depth",
        summary="AWS-first (EC2, S3, VPC, ECS, Lambda, CloudFront, API Gateway, IAM, KMS, CloudWatch, X-Ray). Terraform + CloudFormation. GitHub Actions CI/CD.",
        body="AWS services hands-on across compute, storage, networking, IAM, observability. Terraform and CloudFormation for IaC. Docker for packaging. Nginx for routing. GitHub Actions for CI/CD with matrix deploys.",
        skills=["aws", "ec2", "s3", "vpc", "ecs", "lambda", "cloudfront", "api gateway", "iam",
                "kms", "cloudwatch", "x-ray", "terraform", "cloudformation", "docker", "nginx",
                "ci/cd", "github actions"],
    ),
    KBEntry(
        id="skill-fullstack",
        kind="skill",
        title="Full-stack engineering",
        summary="Python/Flask + React/TypeScript + MongoDB. Production JWT auth, SSE, REST.",
        body="Backend: Python 3.12, Flask 3.1, JWT auth, MongoDB Atlas, REST + SSE patterns. Frontend: React 18, TypeScript, Vite, Tailwind, shadcn/ui, framer-motion, React Query, Three.js.",
        skills=["python", "flask", "javascript", "typescript", "react", "vite", "tailwind",
                "mongodb", "jwt", "sse", "rest"],
    ),
    KBEntry(
        id="skill-ai",
        kind="skill",
        title="Applied AI & agentic systems",
        summary="Gemini SDK function calling, multi-agent orchestration, RAG, prompt engineering.",
        body="Google Gemini SDK with native function calling. Multi-agent orchestration (orchestrator + specialist pattern). Retrieval-augmented generation. Streaming via SSE. Resume tailoring + ATS scoring pipelines using LLMs.",
        skills=["gemini", "llm", "function calling", "rag", "agents", "prompt engineering", "ats"],
    ),
    KBEntry(
        id="skill-security",
        kind="skill",
        title="Cloud security & compliance",
        summary="NIST CSF 2.0, ISO 27001, DO-326A, AWS Well-Architected security pillar.",
        body="Compliance frameworks: NIST CSF 2.0, ISO 27001, DO-326A (aviation). AWS security: IAM least-privilege, KMS encryption, private VPCs, security groups, CloudTrail auditing. API security threat modeling for the AEROSEC project.",
        skills=["nist csf", "iso 27001", "do-326a", "iam", "kms", "vpc", "security groups",
                "cloudtrail", "api security", "threat modeling"],
    ),
]


# ──────────────────────────────────────────────────────────────────────────
# Lightweight TF-IDF semantic search
# ──────────────────────────────────────────────────────────────────────────

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[a-z0-9\.\-/]*[a-z0-9])?")
_STOP = {
    "the", "a", "an", "and", "or", "of", "in", "to", "for", "with", "on", "at",
    "by", "is", "are", "was", "were", "be", "been", "being", "as", "this",
    "that", "it", "its", "his", "her", "their", "from", "into", "via", "i",
    "he", "she", "they", "we", "you", "what", "which", "who", "when", "where",
    "how", "do", "does", "did", "have", "has", "had", "will", "would", "should",
    "can", "could", "may", "might", "tell", "me", "about", "show",
}


def _tokenize(text: str) -> List[str]:
    text = (text or "").lower()
    return [t for t in _TOKEN_RE.findall(text) if t not in _STOP and len(t) > 1]


def _entry_text(entry: KBEntry) -> str:
    return " ".join([
        entry.title,
        entry.summary,
        entry.body,
        " ".join(entry.skills),
        entry.kind,
        entry.impact or "",
    ])


# Pre-compute TF and document frequency
_DOC_TOKENS: Dict[str, Counter] = {e.id: Counter(_tokenize(_entry_text(e))) for e in CORPUS}
_DF: Counter = Counter()
for tokens in _DOC_TOKENS.values():
    for term in tokens:
        _DF[term] += 1
_N = len(CORPUS) or 1
_IDF: Dict[str, float] = {
    term: math.log((_N + 1) / (df + 1)) + 1 for term, df in _DF.items()
}


def _vectorize(tokens: Counter) -> Dict[str, float]:
    if not tokens:
        return {}
    max_tf = max(tokens.values())
    return {
        term: (count / max_tf) * _IDF.get(term, math.log((_N + 1) / 1) + 1)
        for term, count in tokens.items()
    }


def _cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a).intersection(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


_DOC_VECTORS: Dict[str, Dict[str, float]] = {
    eid: _vectorize(tokens) for eid, tokens in _DOC_TOKENS.items()
}


def search(query: str, *, top_k: int = 4, kind: Optional[str] = None) -> List[Dict]:
    """Semantic search over the corpus. Returns ranked dicts with score + snippet."""
    q_vec = _vectorize(Counter(_tokenize(query)))
    if not q_vec:
        return []
    scored: List[tuple[float, KBEntry]] = []
    for entry in CORPUS:
        if kind and entry.kind != kind:
            continue
        score = _cosine(q_vec, _DOC_VECTORS[entry.id])
        if score > 0:
            scored.append((score, entry))
    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for score, entry in scored[:top_k]:
        d = entry.to_dict()
        d["score"] = round(score, 4)
        d["snippet"] = entry.summary
        results.append(d)
    return results


def get_entry(entry_id: str) -> Optional[Dict]:
    for entry in CORPUS:
        if entry.id == entry_id:
            d = entry.to_dict()
            d["body"] = entry.body
            return d
    return None


def find_by_title(needle: str) -> Optional[Dict]:
    """Best-effort title match — exact substring (case-insensitive) wins."""
    needle_low = (needle or "").lower().strip()
    if not needle_low:
        return None
    # Exact id match first
    for entry in CORPUS:
        if entry.id == needle_low:
            return get_entry(entry.id)
    # Substring on title or id
    for entry in CORPUS:
        if needle_low in entry.title.lower() or needle_low in entry.id.lower():
            return get_entry(entry.id)
    # Fall back to top semantic hit
    hits = search(needle, top_k=1)
    return get_entry(hits[0]["id"]) if hits else None


def all_skills() -> List[str]:
    skills = set()
    for entry in CORPUS:
        for s in entry.skills:
            skills.add(s.lower())
    return sorted(skills)


def evidence_for_skill(skill: str) -> List[Dict]:
    """Return entries (with evidence links) that demonstrate a given skill."""
    skill_low = skill.lower().strip()
    matches = []
    for entry in CORPUS:
        if any(skill_low in s.lower() or s.lower() in skill_low for s in entry.skills):
            matches.append({
                "id": entry.id,
                "kind": entry.kind,
                "title": entry.title,
                "summary": entry.summary,
                "evidence": entry.evidence,
                "impact": entry.impact,
                "period": entry.period,
            })
    return matches[:5]
