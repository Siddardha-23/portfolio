#!/usr/bin/env python3
"""Local tailor test harness — iterate on the prompt against the user's
real resume + Rippling JD without waiting for GHA deploys.

Builds a fixture for the user's parsed resume (matches what their actual
parsed_resume in MongoDB looks like, per the reference Cloud Engineer
PDF they uploaded), a fixture for the Rippling Software Engineer II
Backend Platform Team JD analysis, then invokes Bedrock Claude Sonnet
4.6 with the current tailor prompt directly.

Reports bullet counts + key checks so we can iterate on the prompt
phrasing locally instead of pushing/deploying every change.
"""
import json
import sys
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "portfolio-backend" / "services" / "jobs-resume"))
sys.path.insert(0, str(ROOT / "portfolio-backend" / "shared" / "python"))

os.environ.setdefault("AWS_PROFILE", "personal")
os.environ.setdefault("AWS_REGION_NAME", "us-east-1")

# Set up boto3 session with the personal profile so the Claude provider picks it up.
import boto3
boto3.setup_default_session(profile_name="personal", region_name="us-east-1")


# ---------------------------------------------------------------------------
# Fixture: user's parsed resume (from reference Cloud Engineer PDF)
# ---------------------------------------------------------------------------

USER_RESUME = {
    "contact": {
        "name": "Harshith Siddardha Manne",
        "email": "harshith.manne.jobs@gmail.com",
        "phone": "(602) 580-1838",
        "linkedin": "linkedin.com/in/harshith-siddardha",
        "github": "github.com/Siddardha-23",
        "location": "Tempe, AZ",
        "portfolio": "manneharshithsiddardha.com",
    },
    "summary": (
        "Cloud and DevOps Engineer with hands-on experience architecting production "
        "AWS infrastructure, automating deployments through Infrastructure as Code, "
        "and shipping containerized backend systems on ECS, EKS, and Kubernetes. "
        "Skilled in CI/CD automation, observability (Prometheus, Grafana, Loki, "
        "Datadog), and cost-efficient cloud-native design aligned with the AWS "
        "Well-Architected Framework. Extending these foundations into multi-tenant "
        "SaaS platforms and knowledge-graph-grounded AI systems."
    ),
    "skills": {
        "Cloud / DevOps / IaC": [
            "AWS", "EC2", "ECS", "EKS", "Lambda", "S3", "RDS", "DynamoDB",
            "VPC", "IAM", "ALB", "API Gateway", "CloudFront", "KMS", "Bedrock",
            "Linux", "Terraform", "CloudFormation", "Docker", "Kubernetes",
            "Helm", "HPA", "Nginx", "GitHub Actions", "AWS CodePipeline",
            "AWS CodeBuild", "Jenkins", "GitOps", "CI/CD", "Site Reliability Engineering (SRE)",
        ],
        "Observability": [
            "Prometheus", "Grafana", "Loki", "Datadog", "CloudWatch Logs",
            "CloudWatch Metrics", "CloudWatch Alarms", "CloudTrail",
            "Distributed Tracing", "Golden Signal Monitoring",
        ],
        "Backend / AI Systems": [
            "Python", "FastAPI", "Flask", "Django", "Asyncio", "SQLAlchemy",
            "Java", "Spring Boot", "Reactive Spring", "TypeScript",
            "REST APIs", "Microservices", "JWT", "OAuth", "RBAC",
        ],
        "Data / AI / Knowledge Systems": [
            "PostgreSQL", "MongoDB", "Alembic", "Amazon Bedrock", "Anthropic SDK",
            "RAG Pipelines", "Agentic AI Workflows", "Knowledge Graphs",
            "NetworkX", "MCP", "FinOps", "AWS Well-Architected Framework",
        ],
        "OS / Networking / Scripting": [
            "Linux (Ubuntu, Amazon Linux)", "Bash", "Shell Scripting",
            "TCP/IP", "DNS", "VPC Subnetting", "Security Groups", "NACLs",
            "NAT Gateway", "Load Balancing",
        ],
    },
    "experience": [
        {
            "title": "Cloud/DevOps Engineer",
            "company": "DEEP ALGORITHMS & SOLUTIONS",
            "location": "",
            "dates": "May 2023 - May 2024",
            "type": "Full-time",
            "bullets": [
                "Architected a highly available 3-tier AWS infrastructure with Terraform and CloudFormation across VPC, ALB, ECS, RDS, and S3, cutting provisioning errors by 40% and infrastructure setup time by 35% through standardized IaC modules.",
                "Containerized Python-Flask microservices and deployed to ECS Fargate and Kubernetes (EKS) with Helm-managed workloads, Horizontal Pod Autoscaling, and Nginx ingress, supporting 2x traffic growth without performance degradation.",
                "Engineered CI/CD pipelines with AWS CodePipeline, CodeBuild, and CodeCommit, Jenkins, and GitHub Actions following GitOps workflows, reducing deployment failures by 30% and accelerating release cycles by 40% across dev and staging environments.",
                "Built observability with Prometheus, Grafana, and Loki for cluster metrics, application logs, and SLO dashboards; integrated CloudWatch alarms and Datadog-style golden-signal monitoring to cut incident MTTR by 35%.",
                "Optimized Docker multi-stage builds and ECS task definitions to cut deployment time by 45%; configured autoscaling, Multi-AZ RDS, and developed Lambda-based ML batch pipelines in private subnets using SSM, Secrets Manager, S3, and NAT Gateway for secure outbound access.",
            ],
        },
        {
            "title": "Associate Software Developer Intern",
            "company": "BACKFLIPT (XENOVOUS, INC.)",
            "location": "",
            "dates": "Jan 2023 - Apr 2023",
            "type": "Internship",
            "bullets": [
                "Designed high-concurrency RESTful services in Java, Spring Boot, and Reactive Spring for the International Data Corporation (IDC) project, improving API response efficiency by 30% under load.",
                "Integrated backend APIs with React and React Native clients using Redux state management, reducing frontend-backend integration defects by 25%.",
                "Tuned and resolved production issues across AWS-hosted environments, cutting incident turnaround time by 35% through faster debugging, monitoring, and release support.",
            ],
        },
        {
            "title": "DevOps & Backend Engineer Intern",
            "company": "DEEP ALGORITHMS & SOLUTIONS",
            "location": "",
            "dates": "Jan 2021 - Mar 2022",
            "type": "Internship",
            "bullets": [
                "Engineered RESTful APIs for an AI NLP chatbot using Python, Flask, and Django with JWT authentication, request validation, and SQL/NoSQL persistence; containerized services with Docker and Docker Compose.",
                "Provisioned AWS infrastructure using CloudFormation across EC2, S3, IAM, and ALB with autoscaling and lifecycle policies; integrated CloudWatch and CloudTrail for monitoring and audit visibility.",
                "Built end-to-end CI/CD pipelines with AWS CodePipeline, CodeBuild, and CodeCommit using PR-based branching across dev, stage, and prod environments.",
            ],
        },
    ],
    "education": [
        {
            "degree": "Master of Science in Information Technology",
            "institution": "Arizona State University",
            "location": "Tempe, AZ",
            "dates": "May 2026",
            "gpa": "",
            "coursework": "",
        },
        {
            "degree": "Bachelor's in Computer Science",
            "institution": "Jawaharlal Nehru Technological University (JNTU) Kakinada",
            "location": "",
            "dates": "May 2023",
            "gpa": "",
            "coursework": "",
        },
    ],
    "projects": [
        {
            "name": "Infratrix — Dual Knowledge Graph for AWS Cost Optimization",
            "dates": "",
            "bullets": [
                "Building Infratrix (under Aithrex), a multi-tenant SaaS platform that ingests live AWS topology, CloudWatch metrics, and Cost Explorer data, projecting resources onto a 12k-node / 14k-edge knowledge graph using NetworkX MultiDiGraph.",
                "Modeling AWS services, 104 optimization patterns, and cost factors to surface ranked recommendations through a deterministic 5-stage solver, validated end-to-end with a scenario-based regression harness.",
                "Implemented graph-grounded RAG chat on Amazon Bedrock with Claude Sonnet, citation-required prompts, and a heuristic-then-upgrade polling flow to operate within API Gateway's 30-second HTTP limit.",
                "Built a live AWS scanner using STS AssumeRole and boto3 across 12+ services including EC2, RDS, EKS, Lambda, DynamoDB, and S3, feeding both the solver and a hierarchical SVG architecture view.",
                "Implemented multi-tenant RBAC with Postgres row-level isolation, JWT and refresh tokens, and compliance filtering for SOC 2, HIPAA, and PCI-DSS; deployed FastAPI as containerized Lambdas via Terraform with GitHub Actions CI/CD.",
            ],
            "tech": "Python, FastAPI, PostgreSQL, NetworkX, AWS Bedrock, Anthropic SDK, Terraform",
        },
    ],
    "certifications": [],
}

# ---------------------------------------------------------------------------
# Fixture: Rippling JD analysis (Software Engineer II, Backend - Platform Team)
# ---------------------------------------------------------------------------

JD_ANALYSIS = {
    "job_title": "Software Engineer II, Backend - Platform Team",
    "company": "Rippling",
    "location": "San Francisco, CA",
    "employment_type": "Full-time",
    "required_skills": [
        "Python", "Go", "PostgreSQL", "RESTful APIs", "API Design",
        "Backend Engineering", "Data Modeling", "Event Modeling",
        "Microservices", "Distributed Systems",
    ],
    "preferred_skills": [
        "Production Environment", "Service Performance Optimization",
        "Shared Services", "Platform Engineering", "Scalable Systems",
    ],
    "responsibilities": [
        "Design, implement, and test reliable backend services and APIs",
        "Work across API design, data modeling, event modeling, performance optimization",
        "Own the development lifecycle for features",
        "Integrate into cross-functional teams",
    ],
    "qualifications": ["2+ years professional backend experience"],
    "experience_years": "2+",
    "industry": "HR Tech / SaaS",
    "keywords": [
        "backend engineering", "platform engineering", "shared services",
        "relational databases", "API design", "data modeling", "event modeling",
        "service performance optimization", "scalable systems", "microservices",
        "production environment", "cross-functional collaboration",
    ],
}


def main():
    from services.resume_tailor import ResumeTailor
    from schemas.resume_schemas import TAILORED_RESUME_SCHEMA, validate_and_coerce

    print("=" * 78)
    print("LOCAL TAILOR TEST — Rippling Software Engineer II Backend Platform Team")
    print("=" * 78)
    print()

    print(f"Input resume: {len(USER_RESUME['experience'])} experience entries, "
          f"{len(USER_RESUME['projects'])} projects, "
          f"{sum(len(v) for v in USER_RESUME['skills'].values())} skills")
    print(f"Input JD: {JD_ANALYSIS['job_title']} @ {JD_ANALYSIS['company']}")
    print(f"  required_skills={len(JD_ANALYSIS['required_skills'])}, keywords={len(JD_ANALYSIS['keywords'])}")
    print()

    tailor = ResumeTailor()
    print("Calling ResumeTailor.tailor() ...")
    print("  (this invokes Bedrock Sonnet 4.6 — wait ~30-45s)")
    print()

    result = tailor.tailor(USER_RESUME, JD_ANALYSIS)

    # ----- Quality checks -----
    print()
    print("=" * 78)
    print("OUTPUT QUALITY CHECKS")
    print("=" * 78)
    print()

    summary = result.get("summary", "")
    print(f"SUMMARY ({len(summary)} chars, {summary.count('.')} sentences):")
    print(f"  > {summary[:200]}{'...' if len(summary) > 200 else ''}")
    print()

    summary_lower = summary.lower()
    BAD_PATTERNS = [
        ("candidate ", "third-person 'candidate'"),
        ("candidates ", "third-person 'candidates'"),
        ("this candidate", "third-person 'this candidate'"),
        ("the candidate", "third-person 'the candidate'"),
        ("should have", "JD-style 'should have'"),
        ("i build ", "first-person 'I build'"),
        ("i am a ", "first-person 'I am'"),
    ]
    bad_found = [label for pat, label in BAD_PATTERNS if pat in summary_lower]
    if bad_found:
        print(f"  ⚠️  BAD patterns in summary: {bad_found}")
    else:
        print(f"  ✅  No bad patterns in summary")

    if summary.strip().lower().startswith(JD_ANALYSIS["job_title"].lower()):
        print(f"  ⚠️  Summary opens with JD title verbatim")
    else:
        print(f"  ✅  Summary doesn't open with JD title verbatim")
    print()

    print("EXPERIENCE BULLET COUNTS (target: 5 / 3 / 3 = 11 total):")
    exp_counts = []
    for i, exp in enumerate(result.get("experience", [])):
        count = len(exp.get("bullets", []))
        exp_counts.append(count)
        print(f"  Role {i + 1}: {exp.get('company', '?')[:40]:40} — {count} bullets")
    total_exp = sum(exp_counts)
    target_counts = [5, 3, 3]
    if exp_counts == target_counts:
        print(f"  ✅  Exactly 5/3/3 ({total_exp} total)")
    else:
        print(f"  ⚠️  Got {exp_counts}, expected {target_counts}. Total: {total_exp} (target 11)")
    print()

    print("PROJECTS BULLET COUNTS (target: 5 per project):")
    for proj in result.get("projects", []):
        count = len(proj.get("bullets", []))
        marker = "✅" if count >= 5 else "⚠️"
        print(f"  {marker}  {proj.get('name', '?')[:40]:40} — {count} bullets")
    print()

    print(f"SKILLS CATEGORIES: {len(result.get('skills', {}))}")
    for cat, items in result.get("skills", {}).items():
        print(f"  {cat}: {len(items)} skills")
    print()

    # Banned words check
    banned = [
        "Versatile", "Proficient", "Leverages", "extensive experience",
        "proven track record", "results-driven", "passionate", "detail-oriented",
        "highly skilled", "seasoned", "cutting-edge", "innovative", "dynamic",
        "self-motivated", "Adept", "dedicated", "committed to excellence",
        "strong foundation", "strong record", "strong background",
        "robust experience", "hands-on expertise", "should have", "candidates should",
        "the candidate", "this candidate",
    ]
    text_blob = json.dumps(result).lower()
    banned_found = [b for b in banned if b.lower() in text_blob]
    if banned_found:
        print(f"⚠️  BANNED WORDS PRESENT: {banned_found}")
    else:
        print(f"✅  No banned words detected")
    print()

    # Save to disk for inspection
    out_path = ROOT / "tailor_local_output.json"
    out_path.write_text(json.dumps(result, indent=2))
    print(f"Full output saved to: {out_path}")


if __name__ == "__main__":
    main()
