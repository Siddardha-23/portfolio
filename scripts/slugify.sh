#!/usr/bin/env bash
# =============================================================================
# slugify.sh - branch ref -> ephemeral env slug
# =============================================================================
# Rules (see plan.md):
#   1. Lowercase; non-[a-z0-9-] -> '-'; collapse repeats; strip leading/trailing '-'.
#   2. Always prefix with 'pr-'.
#   3. If > 30 chars total, truncate the suffix to 20 chars and append -<sha8>
#      where sha8 is the first 8 hex chars of sha256(original ref).
#   4. Reject reserved labels: pr-prod, pr-main, pr-www, pr-api, pr-admin.
#
# Usage:   scripts/slugify.sh "feat/new-login-flow"
# Output:  pr-feat-new-login-flow
# Exit 1 if input is empty or slug is reserved.
# =============================================================================
set -euo pipefail

ref="${1:-}"
if [[ -z "$ref" ]]; then
    echo "slugify: missing branch ref argument" >&2
    exit 1
fi

# Normalize: lowercase, replace non-alphanumeric (except hyphen) with hyphen
core=$(echo -n "$ref" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9-]+/-/g' \
    | sed -E 's/-+/-/g' \
    | sed -E 's/^-+//; s/-+$//')

if [[ -z "$core" ]]; then
    echo "slugify: ref normalizes to empty string" >&2
    exit 1
fi

slug="pr-${core}"
maxlen=30

if (( ${#slug} > maxlen )); then
    sha8=$(echo -n "$ref" | sha256sum | cut -c1-8)
    # 'pr-' (3) + 20 + '-' (1) + 8 = 32 -> trim to 30 by trimming the prefix portion
    head_len=$(( maxlen - 3 - 1 - 8 ))   # 18
    head=$(echo -n "$core" | cut -c1-"$head_len" | sed -E 's/-+$//')
    slug="pr-${head}-${sha8}"
fi

case "$slug" in
    pr-prod|pr-main|pr-www|pr-api|pr-admin)
        echo "slugify: '$slug' is reserved" >&2
        exit 1
        ;;
esac

# Final sanity: must match DNS label rules (start alphanum, len <= 63)
if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*[a-z0-9]$ ]] || (( ${#slug} > 63 )); then
    echo "slugify: produced invalid slug '$slug'" >&2
    exit 1
fi

echo "$slug"
