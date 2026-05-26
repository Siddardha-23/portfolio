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


def print_ats(label, scores):
    print(f"\n--- ATS SCORES ({label}) ---")
    print(f"  OVERALL:               {scores.get('overall', '?')}")
    print(f"  Keyword Match:         {scores.get('keyword_match', '?')}")
    print(f"  Keyword Frequency:     {scores.get('keyword_frequency', '?')}")
    print(f"  Skills Alignment:      {scores.get('skills_alignment', '?')}")
    print(f"  Experience Relevance:  {scores.get('experience_relevance', '?')}")
    print(f"  Quantifiable Impact:   {scores.get('quantifiable_impact', '?')}")
    print(f"  Bullet Quality:        {scores.get('bullet_quality', '?')}")
    print(f"  Format Score:          {scores.get('format_score', '?')}")
    print(f"  Section Completeness:  {scores.get('section_completeness', '?')}")
    missing = scores.get("missing_keywords", []) or []
    if missing:
        print(f"  Missing keywords ({len(missing)}): {missing[:12]}")
    scanners = scores.get("scanners", {}) or {}
    if scanners:
        print(f"  Scanners: " + ", ".join(f"{k}={v}" for k, v in scanners.items()))
    ai = scores.get("ai_screener", {}) or {}
    if ai:
        print(f"  AI Screener: " + ", ".join(f"{k}={v}" for k, v in ai.items()))


def main():
    from services.resume_tailor import ResumeTailor
    from services.content_augmenter import ContentAugmenter
    from services.project_generator import ProjectGenerator
    from services.resume_renderer import ResumeRenderer
    from services.resume_scorer import ResumeScorer

    print("=" * 78)
    print("FULL PIPELINE LOCAL TEST")
    print("=" * 78)

    count_bullets("ORIGINAL (input)", USER_RESUME)

    print("\n[1/5] Tailoring via Bedrock Claude Sonnet 4.6...")
    tailor = ResumeTailor()
    tailored = tailor.tailor(USER_RESUME, JD_ANALYSIS)
    count_bullets("AFTER TAILOR + IntegrityGuard + JD-skills coverage", tailored)

    print("\n[2/5] Augmenting (project generation + bullet expansion + ATS harden + overflow trim)...")
    renderer = ResumeRenderer()
    proj_gen = ProjectGenerator()
    augmenter = ContentAugmenter(renderer, proj_gen)
    augmented = augmenter.augment(tailored, USER_RESUME, JD_ANALYSIS)
    count_bullets("AFTER AUGMENTER", augmented)

    print("\n[3/5] Rendering PDF...")
    pdf_bytes = renderer.generate_pdf(augmented)
    out_pdf = ROOT / "tailor_local_output.pdf"
    out_pdf.write_bytes(pdf_bytes)
    print(f"  PDF saved: {out_pdf} ({len(pdf_bytes)} bytes)")

    print("\n[4/5] Scoring (deterministic + AI via Claude + PDF parseability)...")
    scorer = ResumeScorer()
    scores = scorer.score(augmented, JD_ANALYSIS, pdf_bytes=pdf_bytes)
    print_ats("FINAL", scores)
    if "pdf_parseable_score" in scores:
        print(f"\n  PDF Parseability: {scores['pdf_parseable_score']}/100")
        c = scores.get("pdf_parseable_checks", {})
        print(f"    Extraction OK:       {c.get('extraction_ok')}")
        print(f"    Page count:          {c.get('page_count')} (single_page={c.get('single_page')})")
        print(f"    Name found:          {c.get('contact_name_found')}")
        print(f"    Email found:         {c.get('contact_email_found')}")
        print(f"    Phone found:         {c.get('contact_phone_found')}")
        print(f"    Contact at top:      {c.get('contact_at_top')}")
        print(f"    Sections found:      {c.get('sections_found')}")
        print(f"    Sections missing:    {c.get('sections_missing')}")
        print(f"    Sections in order:   {c.get('sections_in_order')}")
        print(f"    Skills extracted:    {c.get('skills_keywords_found')}/{c.get('skills_keywords_total')}")
        print(f"    Dates parseable:     {c.get('experience_dates_parseable')}/{c.get('experience_dates_total')}")
        print(f"    No glyph issues:     {c.get('no_glyph_corruption')}")
        print(f"    Word-join issues:    {c.get('word_join_issues')}")
        for w in scores.get("pdf_parseable_warnings", []) or []:
            print(f"    ⚠ {w}")

    print("\n[5/5] Summary:")
    summary = augmented.get("summary", "")
    print(f"  Summary ({len(summary)} chars):")
    print(f"  > {summary[:300]}{'...' if len(summary) > 300 else ''}")

    out_json = ROOT / "tailor_local_output.json"
    out_json.write_text(json.dumps(augmented, indent=2))
    out_scores = ROOT / "tailor_local_scores.json"
    out_scores.write_text(json.dumps(scores, indent=2))
    print(f"\n  Full augmented JSON: {out_json}")
    print(f"  ATS scores JSON: {out_scores}")


if __name__ == "__main__":
    main()
