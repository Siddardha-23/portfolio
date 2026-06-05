#!/usr/bin/env bash
# End-to-end smoke test for the Job Application Autofill backend (/api/apply/*).
# Logs in, fetches the application profile, and generates an answer — the exact
# calls the Chrome extension makes.
#
# Usage:
#   API=http://localhost:5000 EMAIL=you@example.com PASSWORD=secret ./tests/smoke_apply.sh
#
# Requires: curl, jq.
set -euo pipefail

API="${API:-http://localhost:5000}"
EMAIL="${EMAIL:?set EMAIL}"
PASSWORD="${PASSWORD:?set PASSWORD}"

echo "1) Logging in as $EMAIL …"
TOKEN=$(curl -s -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "   ✗ login failed"; exit 1
fi
echo "   ✓ got token"

echo "2) GET /api/apply/profile …"
curl -s "$API/api/apply/profile" -H "Authorization: Bearer $TOKEN" \
  | jq '{name: .profile.personal.name, email: .profile.personal.email,
         skills: (.profile.skills.flat | length),
         projects: (.profile.projects | length),
         work_auth: .profile.work_authorization.summary,
         has_resume: .profile.has_resume}'

echo "3) POST /api/apply/answer …"
curl -s -X POST "$API/api/apply/answer" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
        "question": "Why did you apply for this role, and what about it excites you?",
        "role": "Cloud / DevOps Engineer",
        "company": "Acme Cloud",
        "job_description": "We run large EKS clusters and want engineers who can tame cost, harden CI/CD, and bring AI into the platform."
      }' \
  | jq '{variants: [.variants[] | {angle, preview: (.answer[0:160] + "…")}], error, message}'

echo "4) GET /api/apply/answers?company=Acme Cloud (history from step 3) …"
curl -s --get "$API/api/apply/answers" --data-urlencode "company=Acme Cloud" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{count: (.answers | length), latest: (.answers[0] | {company, role, question})}'

echo "5) PUT /api/apply/profile (cross-device save round-trip) …"
curl -s -X PUT "$API/api/apply/profile" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"profile":{"personal":{"name":"Smoke Test","city":"Tempe"},"customFields":{"desired salary":"competitive"}}}' \
  | jq '.'

echo "Done."
