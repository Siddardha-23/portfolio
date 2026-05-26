#!/usr/bin/env python3
"""Local test — verify adaptive bullets-per-project keeps body at 10pt with
2 projects. Same harness as test_full_pipeline_local.py but with a synthetic
2-project resume input."""
import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "portfolio-backend" / "services" / "jobs-resume"))
sys.path.insert(0, str(ROOT / "portfolio-backend" / "shared" / "python"))
sys.path.insert(0, str(ROOT / "scripts"))

os.environ.setdefault("AWS_PROFILE", "personal")
os.environ.setdefault("AWS_REGION_NAME", "us-east-1")

import boto3
boto3.setup_default_session(profile_name="personal", region_name="us-east-1")

from test_tailor_local import USER_RESUME, JD_ANALYSIS


def main():
    from services.resume_tailor import ResumeTailor
    from services.content_augmenter import ContentAugmenter
    from services.project_generator import ProjectGenerator
    from services.resume_renderer import ResumeRenderer
    from services.resume_scorer import ResumeScorer

    # Synthetic 2-project input — Infratrix plus a second deep project so
    # Phase 1 stays skipped and both originals survive.
    two_proj = json.loads(json.dumps(USER_RESUME))
    two_proj["projects"].append({
        "name": "CloudMind — Multi-Provider AI Routing Layer",
        "dates": "",
        "bullets": [
            "Designed a model-routing gateway that abstracts OpenAI, Anthropic, and Bedrock behind a single typed Python SDK with retry, fallback, and per-tenant budget enforcement.",
            "Built deterministic prompt-cache hashing keyed on system+messages+tools so identical sub-conversations land on the same provider for 30% cost reduction in agentic workflows.",
            "Modeled multi-tenant quota and rate limits in PostgreSQL with row-level isolation; tokens-per-day enforcement runs in O(1) via Redis sliding-window counters fronting Postgres.",
            "Instrumented OpenTelemetry traces across provider hops; surfaces P50/P95 latency per model in a Grafana dashboard the on-call engineer reviews each morning.",
            "Shipped behind a Lambda+FastAPI deployment with GitHub Actions IaC pipelines; bursts to 600 RPS through API Gateway with under 80ms P50 routing overhead.",
        ],
        "tech": "Python, FastAPI, PostgreSQL, Redis, OpenTelemetry, Anthropic SDK, Bedrock, Lambda",
    })

    print("=" * 78)
    print("TWO-PROJECT LOCAL TEST — verifies adaptive bullets-per-project")
    print("=" * 78)
    print(f"\nInput projects: {len(two_proj['projects'])}")
    for p in two_proj["projects"]:
        print(f"  - {p['name'][:55]:<55} ({len(p['bullets'])} bullets)")

    tailor = ResumeTailor()
    print("\n[1/4] Tailoring...")
    tailored = tailor.tailor(two_proj, JD_ANALYSIS)
    print("\nAfter tailor:")
    for p in tailored.get("projects", []):
        print(f"  - {p.get('name', '?')[:55]:<55} ({len(p.get('bullets', []))} bullets)")

    print("\n[2/4] Augmenting...")
    renderer = ResumeRenderer()
    augmenter = ContentAugmenter(renderer, ProjectGenerator())
    augmented = augmenter.augment(tailored, two_proj, JD_ANALYSIS)
    print("\nAfter augmenter:")
    for p in augmented.get("projects", []):
        print(f"  - {p.get('name', '?')[:55]:<55} ({len(p.get('bullets', []))} bullets)")

    print("\n[3/4] Rendering PDF...")
    pdf_bytes = renderer.generate_pdf(augmented)
    out = ROOT / "tailor_two_projects_output.pdf"
    out.write_bytes(pdf_bytes)
    print(f"  PDF saved: {out} ({len(pdf_bytes)} bytes)")

    print("\n[4/4] Scoring...")
    scores = ResumeScorer().score(augmented, JD_ANALYSIS)
    print(f"  OVERALL:              {scores.get('overall')}")
    print(f"  Keyword Match:        {scores.get('keyword_match')}")
    print(f"  Keyword Frequency:    {scores.get('keyword_frequency')}")
    print(f"  Skills Alignment:     {scores.get('skills_alignment')}")
    print(f"  Bullet Quality:       {scores.get('bullet_quality')}")
    print(f"  Format Score:         {scores.get('format_score')}")


if __name__ == "__main__":
    main()
