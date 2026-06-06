#!/usr/bin/env python3
"""Render a sample resume PDF + DOCX using the CURRENT renderer spacing.

No AI involved. Reuses the USER_RESUME fixture from test_tailor_local.py and
feeds it straight through ResumeRenderer so you can eyeball exactly how the
current spacing/density looks on a real (2-3 exp + 1 project) resume.

It also prints a full report of every spacing/font constant the renderer uses,
and the two-pass adaptive values it actually picked for THIS resume — so you
can see how much vertical slack is left for adding projects / extra bullets.

Outputs (next to repo root):
    sample_resume_current.pdf
    sample_resume_current.docx
    sample_resume_spacing_report.txt
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVC = ROOT / "portfolio-backend" / "services" / "jobs-resume"
sys.path.insert(0, str(SVC))
sys.path.insert(0, str(ROOT / "portfolio-backend" / "shared" / "python"))

from services.resume_renderer import ResumeRenderer  # noqa: E402
from services.bullet_allocator import allocate_bullets  # noqa: E402

# Inlined fixture (mirrors USER_RESUME in test_tailor_local.py). Kept here so
# the sample renders standalone without test_tailor_local's boto3 session
# bootstrap (which needs an AWS 'personal' profile).
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
            "name": "Infratrix - Dual Knowledge Graph for AWS Cost Optimization",
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


def fmt(v):
    return f"{v:.2f}mm" if isinstance(v, float) else str(v)


def spacing_report(r: ResumeRenderer, tailored) -> str:
    L = []
    A = L.append
    A("=" * 72)
    A("CURRENT RESUME RENDERER — SPACING / LAYOUT REPORT")
    A(f"RENDER_VERSION = {r.RENDER_VERSION}")
    A("=" * 72)

    A("\n--- PAGE GEOMETRY (PDF, A4) ---")
    A(f"  Page height                 : {r._PAGE_H:.1f} mm")
    A(f"  Margin top / bottom         : {r._MARGIN_TOP:.1f} / {r._MARGIN_BOTTOM:.1f} mm")
    A(f"  Margin left / right         : {r._MARGIN_LR:.1f} mm  (~{r._MARGIN_LR/25.4:.2f} in)")
    A(f"  Usable height (_AVAIL_H)    : {r._AVAIL_H:.1f} mm")

    A("\n--- FONT SIZES (pt) ---")
    A(f"  Name                        : {r._NAME_SIZE}")
    A(f"  Contact line                : {r._CONTACT_SIZE}")
    A(f"  Body (base, pre-adaptive)   : {r._BODY_SIZE}")
    A(f"  Section title               : {r._SECTION_TITLE_SIZE}")
    A(f"  Company name                : {r._COMPANY_SIZE}")
    A(f"  Job title (italic)          : {r._JOB_TITLE_SIZE}")

    A("\n--- LINE HEIGHTS (mm) ---")
    A(f"  Body  / Bullet / Skill      : {r._LH_BODY} / {r._LH_BULLET} / {r._LH_SKILL}")
    A(f"  Contact                     : {r._LH_CONTACT}")

    A("\n--- SPACING FLOORS (mm, minimum gaps) ---")
    A(f"  Section gap   (before hdr)  : {r._MIN_SECTION_GAP}")
    A(f"  Entry gap     (between)     : {r._MIN_ENTRY_GAP}")
    A(f"  Post-header   (after rule)  : {r._MIN_POST_HEADER}")
    A(f"  Header gap    (after name)  : {r._MIN_HEADER_GAP}")
    A(f"  Skill gap                   : {r._MIN_SKILL_GAP}")
    A(f"  Bullet gap (within list)    : {r._BULLET_GAP}")
    A(f"  Pre-bullet gap (under title): {r._PRE_BULLET_GAP}")
    A(f"  Edu entry gap (between edus): {r._EDU_ENTRY_GAP}")
    A(f"  Job-title cell height       : {r._JOB_TITLE_CELL_H}")
    A(f"  Bullet indent               : {r._BULLET_INDENT}")

    A("\n--- SPACING CEILINGS (mm, Pass-2 max inflation) ---")
    A(f"  Section / Entry             : {r._MAX_SECTION_GAP} / {r._MAX_ENTRY_GAP}")
    A(f"  Post-header / Header        : {r._MAX_POST_HEADER} / {r._MAX_HEADER_GAP}")
    A(f"  Skill                       : {r._MAX_SKILL_GAP}")

    # --- Slot counts + adaptive pass for THIS resume ---
    slots = r._count_spacing_slots(tailored)
    A("\n--- SLOT COUNTS FOR THIS RESUME ---")
    A(f"  Sections    : {slots['sections']}")
    A(f"  Entry gaps  : {slots['entry_gaps']}")
    A(f"  Skill rows  : {slots['skill_rows']}")

    # Walk the SAME tier ladder generate_pdf() uses, at minimum gaps, to find
    # the first (font, line-height) tier whose measured height fits one page.
    avail = r._AVAIL_H

    def measure(bs, lh, lhs):
        _, h = r._render_pdf(
            tailored,
            section_gap=r._MIN_SECTION_GAP, entry_gap=r._MIN_ENTRY_GAP,
            post_header=r._MIN_POST_HEADER, header_gap=r._MIN_HEADER_GAP,
            skill_gap=r._MIN_SKILL_GAP,
            body_size=bs, lh=lh, lh_s=lhs, measure_only=True,
        )
        return h

    ladder = [
        ("10pt / lh 3.40 (base)", 10.0, 3.40, 3.08),
        ("10pt / lh 3.35 (tier 1)", 10.0, 3.35, 3.08),
        ("10pt / lh 3.22 (tier 2)", 10.0, 3.22, 3.08),
        ("10pt / lh 3.10 (tier 3)", 10.0, 3.10, 3.08),
        ("9.5pt / lh 3.50", 9.5, 3.50, 3.30),
        ("9pt / lh 3.20", 9.0, 3.20, 3.00),
    ]

    A("\n--- ADAPTIVE TIER LADDER (PDF, measured at MIN gaps) ---")
    A(f"  Usable height : {avail:.1f} mm")
    chosen = None
    for label, bs, lh, lhs in ladder:
        h = measure(bs, lh, lhs)
        fits = h <= avail
        mark = "FITS" if fits else "over"
        A(f"  {label:26} : {h:6.1f} mm  [{mark}]")
        if fits and chosen is None:
            chosen = (label, bs, lh, lhs, h)

    A("")
    if chosen:
        label, bs, lh, lhs, h = chosen
        slack = avail - h
        A(f"  -> CHOSEN TIER : {label}")
        A(f"  -> Slack at MIN gaps : {slack:.1f} mm  "
          f"(~{slack / lh:.1f} bullet-lines of free room)")
        if bs < 10.0:
            A("  -> NOTE: font was SHRUNK below 10pt to fit — content is heavy.")
        if slack < 4.0:
            A("  -> Page is effectively FULL: almost no whitespace to reclaim.")
            A("     Adding a project/bullets here forces a smaller font tier.")
        else:
            A("  -> Pass 2 inflates gaps to spread this slack across the page;")
            A("     this slack is the room available for extra content.")
    else:
        A("  -> Does not fit even at 9pt — content must be trimmed.")
    return "\n".join(L)


def main():
    r = ResumeRenderer()
    tailored = USER_RESUME

    # Optional output-name suffix so successive tweak passes don't overwrite
    # the previous sample (e.g. `python render_sample_resume.py v2`).
    suffix = f"_{sys.argv[1]}" if len(sys.argv) > 1 else ""

    report = spacing_report(r, tailored)
    print(report)

    (ROOT / f"sample_resume_spacing_report{suffix}.txt").write_text(report, encoding="utf-8")

    pdf_bytes = r.generate_pdf(tailored)
    (ROOT / f"sample_resume_current{suffix}.pdf").write_bytes(pdf_bytes)

    docx_bytes = r.generate_docx(tailored)
    (ROOT / f"sample_resume_current{suffix}.docx").write_bytes(docx_bytes)

    print("\nWrote (RAW fixture — untailored, 5/3/3 + 5):")
    print(f"  {ROOT / f'sample_resume_current{suffix}.pdf'}  ({len(pdf_bytes)} bytes)")
    print(f"  {ROOT / f'sample_resume_current{suffix}.docx'} ({len(docx_bytes)} bytes)")
    print(f"  {ROOT / f'sample_resume_spacing_report{suffix}.txt'}")

    # --- Allocated sample: what the real pipeline produces ---
    # The raw fixture is the model's INPUT. The live tailor now over-generates
    # ranked bullets, then bullet_allocator selects the JD-relevant set that
    # fits one page at 10pt. To show that here we simulate over-generation
    # (extra ranked candidate bullets on the thin roles) and run the SAME
    # allocator the pipeline calls in ResumeTailor._allocate_bullets.
    import copy
    allocated = copy.deepcopy(USER_RESUME)
    _candidate_bullets = [
        "Designed RESTful microservices in Python with PostgreSQL persistence "
        "and data modeling, cutting p95 API latency 30% under production load.",
        "Built event-driven backend services on a shared platform, raising "
        "throughput 2x while keeping tail latency flat across releases.",
        "Automated infrastructure drift detection in CI with Terraform plan "
        "diffs, catching 12 config regressions before merge each quarter.",
    ]
    allocated["experience"][0]["bullets"] += _candidate_bullets[:1]
    allocated["experience"][1]["bullets"] += _candidate_bullets
    allocated["experience"][2]["bullets"] += _candidate_bullets
    sample_jd = {
        "required_skills": ["Python", "PostgreSQL", "RESTful APIs", "Microservices",
                            "API Design", "Distributed Systems"],
        "keywords": ["backend", "platform", "data modeling", "scalable systems",
                     "service performance", "api"],
    }
    allocate_bullets(allocated, r, jd_analysis=sample_jd)
    alloc_pdf = r.generate_pdf(allocated)
    (ROOT / f"sample_resume_allocated{suffix}.pdf").write_bytes(alloc_pdf)

    exp_counts = [len(e["bullets"]) for e in allocated["experience"]]
    proj_counts = [len(p["bullets"]) for p in allocated["projects"]]
    print("\nWrote (ALLOCATED — JD-aware, post-pipeline):")
    print(f"  experience bullets: {exp_counts}  projects: {proj_counts}")
    print(f"  {ROOT / f'sample_resume_allocated{suffix}.pdf'}  ({len(alloc_pdf)} bytes)")


if __name__ == "__main__":
    main()
