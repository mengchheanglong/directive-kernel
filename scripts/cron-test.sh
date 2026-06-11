#!/usr/bin/env bash
# Cron environment test — verify all prerequisites for cron-based auto-ingest
#
# Usage: bash scripts/cron-test.sh
# Exit: 0 on CRON_READY, 1 on CRON_FAIL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Resolve directive root — try Docker-mount path first (for WSL/Docker),
# then Windows path (for Git Bash / native Windows), then derive from project dir.
WIN_ROOT="C:/Users/User/AppData/Local/hermes/directive-root/directive-root"
MNT_ROOT="/mnt/host/c/Users/User/AppData/Local/hermes/directive-root/directive-root"
DERIVED_ROOT="$(dirname "$(dirname "$PROJECT_DIR")")/directive-root/directive-root"

DIRECTIVE_ROOT=""
for candidate in "$MNT_ROOT" "$WIN_ROOT" "$DERIVED_ROOT"; do
  if [ -d "$candidate" ]; then
    DIRECTIVE_ROOT="$candidate"
    break
  fi
done

if [ -z "$DIRECTIVE_ROOT" ]; then
  echo "[FATAL] Cannot find directive root. Tried: $MNT_ROOT, $WIN_ROOT, $DERIVED_ROOT"
  exit 1
fi

FAILED=0

check() {
  local label="$1"
  local path="$2"
  if [ -e "$path" ]; then
    echo "  [PASS] $label: $path"
  else
    echo "  [FAIL] $label: $path (not found)"
    FAILED=1
  fi
}

check_exe() {
  local label="$1"
  local path="$2"
  if [ -f "$path" ] && [ -x "$path" ]; then
    echo "  [PASS] $label: $path (executable)"
  elif [ -f "$path" ]; then
    echo "  [PASS] $label: $path (exists, chmod +x to make executable)"
  else
    echo "  [FAIL] $label: $path (not found)"
    FAILED=1
  fi
}

check_dir() {
  local label="$1"
  local path="$2"
  if [ -d "$path" ]; then
    echo "  [PASS] $label: $path"
  else
    echo "  [FAIL] $label: $path (not found or not a directory)"
    FAILED=1
  fi
}

echo "=== Cron Environment Test ==="
echo "Project dir:    $PROJECT_DIR"
echo "Directive root: $DIRECTIVE_ROOT"
echo ""

echo "1. Auto-ingest scripts:"
check_exe "auto-ingest.sh" "$PROJECT_DIR/scripts/auto-ingest.sh"
check     "auto-ingest.ts" "$PROJECT_DIR/scripts/auto-ingest.ts"

echo ""
echo "2. Pipeline script:"
check "pipeline.ts" "$PROJECT_DIR/scripts/pipeline.ts"

echo ""
echo "3. Directive root:"
check_dir "directive root"       "$DIRECTIVE_ROOT"
check     "DIRECTIVE_GOAL.md"    "$DIRECTIVE_ROOT/DIRECTIVE_GOAL.md"
check     "intake-queue.json"    "$DIRECTIVE_ROOT/discovery/intake-queue.json"

echo ""
echo "4. Runtime directories:"
check_dir "engine-runs"         "$DIRECTIVE_ROOT/runtime/host-artifacts/engine-runs"
check_dir "registry"            "$DIRECTIVE_ROOT/runtime/08-registry"
check_dir "follow-up"           "$DIRECTIVE_ROOT/runtime/00-follow-up"
check_dir "routing-log"         "$DIRECTIVE_ROOT/discovery/03-routing-log"

echo ""
echo "5. Tools:"
if command -v npx &>/dev/null; then
  echo "  [PASS] npx: $(command -v npx)"
else
  echo "  [FAIL] npx: not found in PATH"
  FAILED=1
fi

if command -v tsx &>/dev/null; then
  echo "  [PASS] tsx: $(command -v tsx)"
else
  echo "  [INFO] tsx: not found in PATH (npx tsx will resolve it)"
fi

if command -v python &>/dev/null; then
  echo "  [PASS] python: $(command -v python)"
elif command -v python3 &>/dev/null; then
  echo "  [PASS] python3: $(command -v python3)"
else
  echo "  [WARN] python: not found (health check cron job needs it; auto-ingest works without it)"
fi

echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "═══════════════════════════════════════════"
  echo "  CRON_READY"
  echo "═══════════════════════════════════════════"
  echo "All checks passed. The environment is ready for cron setup."
  echo "Run the commands in scripts/cron-setup.md to create the cron jobs."
  exit 0
else
  echo "═══════════════════════════════════════════"
  echo "  CRON_FAIL"
  echo "═══════════════════════════════════════════"
  echo "Some checks failed. Fix the [FAIL] items above before setting up cron."
  exit 1
fi
