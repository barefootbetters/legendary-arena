#!/usr/bin/env bash
# docs/ai/audits/check-reference-drift.sh
#
# Ad-hoc audit — NOT a Work Packet, no lifecycle, no authority.
# Re-runs the WP-001 forbidden-token scan against REFERENCE docs and work
# packets. Exits non-zero if any unexpected hit appears.
#
# Scope: doc-only. This script never edits files. Delete freely if it stops
# being useful.
#
# When a hit appears, it is one of:
#   (a) real drift  -> fix the offending doc
#   (b) legitimate meta/historical reference  -> add the file to META[] below
#       with a short inline comment explaining why it is allowed
#
# Run from anywhere:  bash docs/ai/audits/check-reference-drift.sh

set -u

cd "$(dirname "$0")/../../.."

# Files that legitimately mention forbidden tokens in a meta/historical
# context. Do not extend without noting the reason inline.
META=(
  # defines the forbidden-token contract itself
  'docs/ai/work-packets/WP-001-foundation.md'
  # records the WP-001 convention in the index
  'docs/ai/work-packets/WORK_INDEX.md'
  # Phase-0 post-mortem body references the historical drift
  'docs/ai/REFERENCE/01.4-pre-flight-invocation.md'
)

EXCLUDE=()
for meta_file in "${META[@]}"; do
  EXCLUDE+=("--glob=!$meta_file")
done

SCOPE=(docs/ai/REFERENCE docs/ai/work-packets)
fail=0

check() {
  local label="$1" pattern="$2"
  local hits
  hits=$(rg -n --no-heading "${EXCLUDE[@]}" "$pattern" "${SCOPE[@]}" 2>/dev/null || true)
  if [ -z "$hits" ]; then
    printf "  %-42s OK\n" "$label"
  else
    printf "  %-42s DRIFT\n" "$label"
    echo "$hits" | sed 's/^/      /'
    fail=1
  fi
}

echo "WP-001 coordination invariants — REFERENCE/work-packets scan"
echo

check "strikeCount  (should be 'vp')"          'strikeCount'
check "db/migrations  (should be data/)"       'db/migrations'
check "setup_rules  (phantom table name)"      'setup_rules'
check "require(  (ESM-only project)"           '\brequire\('
check "underscore card URLs  (need hyphens)"   '/cards/[a-z0-9]+_'

echo
if [ "$fail" -ne 0 ]; then
  echo "Drift detected. See hits above."
  exit 1
fi

echo "All invariants hold."
