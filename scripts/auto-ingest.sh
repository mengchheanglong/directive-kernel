#!/usr/bin/env bash
# Auto-Ingest wrapper: search GitHub for top repos in a domain and
# run them through the Hermes capability pipeline.
#
# Usage:
#   bash scripts/auto-ingest.sh "<search-query>"       # single domain
#   bash scripts/auto-ingest.sh                         # batch: reads scripts/domains.txt
#
# Examples:
#   bash scripts/auto-ingest.sh "top open source devops tools github 2025"
#   bash scripts/auto-ingest.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOMAINS_FILE="$SCRIPT_DIR/domains.txt"

cd "$PROJECT_DIR"

# ── Single-domain mode (existing behavior preserved) ──
if [ $# -ge 1 ]; then
  QUERY="$1"

  echo "=== Hermes Auto-Ingest (single) ==="
  echo "Project dir: $PROJECT_DIR"
  echo "Query:       $QUERY"
  echo ""

  npx tsx scripts/auto-ingest.ts "$QUERY"
  exit $?
fi

# ── Batch mode: read domains from domains.txt ──
if [ ! -f "$DOMAINS_FILE" ]; then
  echo "Error: domains.txt not found at $DOMAINS_FILE"
  exit 1
fi

# Read domains, skip empty lines and comments
mapfile -t DOMAINS < <(grep -v '^#' "$DOMAINS_FILE" | grep -v '^[[:space:]]*$')
TOTAL_DOMAINS=${#DOMAINS[@]}

if [ "$TOTAL_DOMAINS" -eq 0 ]; then
  echo "Error: No domains found in $DOMAINS_FILE"
  exit 1
fi

echo "=== Hermes Auto-Ingest (batch) ==="
echo "Project dir:     $PROJECT_DIR"
echo "Domains file:    $DOMAINS_FILE"
echo "Total domains:   $TOTAL_DOMAINS"
echo ""

FAILED=0
PROCESSED=0
TOTAL_REPOS=0

for i in "${!DOMAINS[@]}"; do
  DOMAIN="${DOMAINS[$i]}"
  DOMAIN_NUM=$((i + 1))

  echo ""
  echo "============================================================"
  echo "  Domain $DOMAIN_NUM/$TOTAL_DOMAINS: $DOMAIN"
  echo "  Progress: $PROCESSED completed, $FAILED failed, ~$TOTAL_REPOS repos registered so far"
  echo "============================================================"
  echo ""

  if npx tsx scripts/auto-ingest.ts "$DOMAIN"; then
    PROCESSED=$((PROCESSED + 1))
    echo ""
    echo "  [OK] Domain '$DOMAIN' completed successfully."
  else
    FAILED=$((FAILED + 1))
    echo ""
    echo "  [FAIL] Domain '$DOMAIN' encountered an error (continuing)."
  fi

  # 60-second delay between domains to respect GitHub API rate limits
  if [ "$DOMAIN_NUM" -lt "$TOTAL_DOMAINS" ]; then
    echo ""
    echo "  Waiting 60s for API rate limit..."
    sleep 60
    echo "  Resuming..."
  fi
done

echo ""
echo "============================================================"
echo "  BATCH COMPLETE"
echo "============================================================"
echo "  Total domains:   $TOTAL_DOMAINS"
echo "  Successful:      $PROCESSED"
echo "  Failed:          $FAILED"
echo "  Exit code:       $FAILED"
echo "============================================================"

exit "$FAILED"
