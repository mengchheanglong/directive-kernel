#!/bin/bash
# One-shot pipeline — run from directive-kernel repo root
set -e

ROOT="/c/Users/User/AppData/Local/hermes/directive-root-clean/directive-root"
KERNEL="/c/Users/User/AppData/Local/hermes/systems/directive-kernel"
CLI="$KERNEL/dist/hosts/standalone-host/cli.js"
DATE="2026-06-10"
CID="hermes-oneshot"
TMP="/c/Users/User/AppData/Local/hermes/directive-root-clean"

# Clean
rm -f "$ROOT/engine/.lock"
rm -f "$ROOT/discovery/03-routing-log/"*.md
rm -f "$ROOT/runtime/00-follow-up/"*.md
rm -f "$ROOT/runtime/02-records/"*.md
rm -f "$ROOT/runtime/03-proof/"*.md
rm -f "$ROOT/runtime/04-capability-boundaries/"*.md
rm -f "$ROOT/runtime/05-promotion-readiness/"*.md
rm -f "$ROOT/runtime/06-promotion-specifications/"*.md
rm -f "$ROOT/runtime/07-promotion-records/"*.md
rm -f "$ROOT/runtime/08-registry/"*.md

echo "=== Step 1: Submit via CLI ==="
cat > "$TMP/sub.json" << JSON
{"candidate_id":"$CID","candidate_name":"shadcn/ui","source_type":"github-repo","source_reference":"https://github.com/shadcn-ui/ui","mission_alignment":"Professional React component library (116K stars).","notes":["One-shot test"],"record_shape":"engine_full"}
JSON

cd "$KERNEL"
node "$CLI" discovery-submit --directive-root "$ROOT" --input-json-path "$TMP/sub.json" --process-with-engine 2>/dev/null | python -c "import sys,json;d=json.load(sys.stdin);print('RunId:',d['engine']['record']['runId'])" || exit 1

echo "=== Done — ready for final advancement ==="
echo "Next: run npx tsx scripts/finish-advance.ts"
