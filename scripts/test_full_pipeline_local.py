#!/usr/bin/env python3
"""Full pipeline test: tailor + integrity guard + augmenter + renderer.

Loads the user's resume + Rippling JD fixtures from test_tailor_local.py,
runs the same flow the Lambda runs, and writes the rendered PDF locally
so we can inspect bullet counts at each pipeline stage.
"""
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


def count_bullets(label, resume_dict):
    print(f"\n--- {label} ---")
    exp = resume_dict.get("experience", [])
    for i, e in enumerate(exp):
        bn = len(e.get("bullets", []))
        print(f"  EXP[{i}] {e.get('company', '?')[:40]:40} {bn} bullets")
    print(f"  EXP total: {sum(len(e.get('bullets', [])) for e in exp)}")
    proj = resume_dict.get("projects", [])
    for i, p in enumerate(proj):
        bn = len(p.get("bullets", []))
        print(f"  PROJ[{i}] {p.get('name', '?')[:40]:40} {bn} bullets")
    print(f"  PROJ total: {sum(len(p.get('bullets', [])) for p in proj)}")


def main():
    from services.resume_tailor import ResumeTailor
    from services.content_augmenter import ContentAugmenter
    from services.project_generator import ProjectGenerator
    from services.resume_renderer import ResumeRenderer

    print("=" * 78)
    print("FULL PIPELINE LOCAL TEST")
    print("=" * 78)

    count_bullets("ORIGINAL (input)", USER_RESUME)

    print("\n[1/4] Tailoring via Bedrock Claude Sonnet 4.6...")
    tailor = ResumeTailor()
    tailored = tailor.tailor(USER_RESUME, JD_ANALYSIS)
    count_bullets("AFTER TAILOR + IntegrityGuard", tailored)

    print("\n[2/4] Augmenting (project generation + bullet expansion + ATS harden + overflow trim)...")
    renderer = ResumeRenderer()
    proj_gen = ProjectGenerator()
    augmenter = ContentAugmenter(renderer, proj_gen)
    augmented = augmenter.augment(tailored, USER_RESUME, JD_ANALYSIS)
    count_bullets("AFTER AUGMENTER", augmented)

    print("\n[3/4] Rendering PDF...")
    pdf_bytes = renderer.generate_pdf(augmented)
    out_pdf = ROOT / "tailor_local_output.pdf"
    out_pdf.write_bytes(pdf_bytes)
    print(f"  PDF saved: {out_pdf} ({len(pdf_bytes)} bytes)")

    print("\n[4/4] Summary:")
    summary = augmented.get("summary", "")
    print(f"  Summary ({len(summary)} chars):")
    print(f"  > {summary[:300]}{'...' if len(summary) > 300 else ''}")

    out_json = ROOT / "tailor_local_output.json"
    out_json.write_text(json.dumps(augmented, indent=2))
    print(f"\n  Full augmented JSON: {out_json}")


if __name__ == "__main__":
    main()
