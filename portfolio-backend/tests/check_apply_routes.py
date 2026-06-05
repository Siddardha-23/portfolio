"""Wiring check for the Job Application Autofill backend (/api/apply/*).

Boots the local combined Flask app exactly like local.py and asserts the new
apply routes are registered. Does NOT need a live MongoDB or Bedrock — it only
inspects the URL map, so it catches registration / import wiring mistakes fast.

Run from the backend root (needs the backend's Python deps installed):
    python tests/check_apply_routes.py
"""
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir / "shared" / "python"))
for svc in ["visitor", "auth", "chat", "infra", "jobs-resume"]:
    sys.path.insert(0, str(backend_dir / "services" / svc))

import local  # noqa: E402  — reuse the exact combined-app factory

EXPECTED = {
    "/api/apply/profile": {"GET", "PUT"},
    "/api/apply/answer": {"POST"},
    "/api/apply/answers": {"GET"},
}


def main() -> int:
    app = local.create_app()
    rules = {str(r.rule): r.methods for r in app.url_map.iter_rules()}

    ok = True
    for path, methods in EXPECTED.items():
        present = path in rules
        method_ok = present and methods.issubset(rules[path])
        status = "OK" if method_ok else "MISSING"
        print(f"  [{status}] {sorted(methods)} {path}")
        ok = ok and method_ok

    print("apply routes wired correctly." if ok else "apply routes NOT wired — check blueprint registration.")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
