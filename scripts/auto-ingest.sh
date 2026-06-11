#!/usr/bin/env bash
# Auto-Ingest wrapper: search GitHub for top repos in a domain and
# run them through the Hermes capability pipeline.
#
# Usage: bash scripts/auto-ingest.sh "<search-query>"
# Example: bash scripts/auto-ingest.sh "top open source devops tools github 2025"

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: bash scripts/auto-ingest.sh \"<search-query>\""
  echo "Example: bash scripts/auto-ingest.sh \"top open source devops tools github 2025\""
  exit 1
fi

QUERY="$1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== Hermes Auto-Ingest (wrapper) ==="
echo "Project dir: $PROJECT_DIR"
echo "Query:       $QUERY"
echo ""

npx tsx scripts/auto-ingest.ts "$QUERY"
