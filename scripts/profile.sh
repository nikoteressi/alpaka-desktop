#!/usr/bin/env bash
# Runtime resource profiling for Alpaka Desktop
# Measures against budgets documented in docs/ARCHITECTURE.md §13
#
# Usage:
#   ./scripts/profile.sh [--no-launch]  # --no-launch: attach to running process

set -euo pipefail

BINARY="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/target/release/alpaka-desktop"
DIST_DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
BUDGET_MEMORY_MB=280   # PSS budget; see docs/ARCHITECTURE.md §13
BUDGET_BINARY_MB=15
SAMPLE_DURATION=10   # seconds to sample CPU/memory after launch

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC}  $1"; }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; }

# float comparison: lt_float A B → exit 0 if A < B
lt_float() { awk "BEGIN { exit !($1 < $2) }"; }

# ─── 1. Static analysis ─────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo "  Alpaka Desktop — Resource Profile"
echo "══════════════════════════════════════════"
echo ""

echo "── 1. Binary & bundle sizes ──────────────"

if [[ ! -f "$BINARY" ]]; then
  echo "  ERROR: release binary not found. Run: cargo build --release"
  exit 1
fi

BINARY_BYTES=$(stat -c%s "$BINARY")
BINARY_MB=$(awk "BEGIN { printf \"%.2f\", $BINARY_BYTES / 1048576 }")
echo "  Release binary:  ${BINARY_MB} MB  (budget: <${BUDGET_BINARY_MB} MB)"
if lt_float "$BINARY_MB" "$BUDGET_BINARY_MB"; then
  pass "Binary size ${BINARY_MB} MB < ${BUDGET_BINARY_MB} MB"
else
  fail "Binary size ${BINARY_MB} MB exceeds ${BUDGET_BINARY_MB} MB budget"
fi

if [[ -d "$DIST_DIR" ]]; then
  DIST_KB=$(du -sk "$DIST_DIR" | cut -f1)
  DIST_MB=$(awk "BEGIN { printf \"%.1f\", $DIST_KB / 1024 }")
  MAIN_KB=$(find "$DIST_DIR/assets" -name "index-*.js" 2>/dev/null | xargs du -sk 2>/dev/null | awk '{s+=$1} END {print s}')
  MAIN_MB=$(awk "BEGIN { printf \"%.1f\", ${MAIN_KB:-0} / 1024 }")
  LANG_COUNT=$(find "$DIST_DIR/assets" -name "*.js" ! -name "index-*" 2>/dev/null | wc -l)
  echo "  Frontend bundle: ${DIST_MB} MB total"
  echo "  Main app chunk:  ${MAIN_MB} MB"
  echo "  Shiki lang chunks: ${LANG_COUNT} (lazy-loaded on demand)"
  if lt_float "$DIST_MB" "16"; then
    pass "Frontend bundle ${DIST_MB} MB (Shiki grammars are lazy)"
  else
    warn "Frontend bundle ${DIST_MB} MB is large"
  fi
fi

# ─── 2. Startup time ─────────────────────────────────────────────────────────

echo ""
echo "── 2. Cold start time ────────────────────"

if [[ "${1:-}" == "--no-launch" ]]; then
  echo "  Skipping launch (--no-launch mode)"
  exit 0
fi

START_TS=$(date +%s%3N)
"$BINARY" &
APP_PID=$!
echo "  Launched PID $APP_PID"

# Wait until WebKitGTK child process appears (= window rendered)
WAITED=0
while [[ $WAITED -lt 50 ]]; do
  sleep 0.2
  WAITED=$((WAITED + 1))
  CHILDREN=$(ps --ppid "$APP_PID" -o pid= 2>/dev/null | wc -l)
  if [[ $CHILDREN -ge 1 ]]; then
    break
  fi
done
END_TS=$(date +%s%3N)
STARTUP_MS=$((END_TS - START_TS))
STARTUP_S=$(awk "BEGIN { printf \"%.2f\", $STARTUP_MS / 1000 }")
echo "  Cold start: ${STARTUP_S}s (budget: <2.0s)"
if lt_float "$STARTUP_S" "2.0"; then
  pass "Startup ${STARTUP_S}s < 2.0s"
else
  fail "Startup ${STARTUP_S}s exceeds 2.0s budget"
fi

# ─── 3. Runtime memory ───────────────────────────────────────────────────────

echo ""
echo "── 3. Runtime memory (idle, ${SAMPLE_DURATION}s sample) ───"
echo "  Sampling every 2s using PSS (proportional — shared libs counted once)..."

MAX_PSS_KB=0
READINGS=0
SUM_PSS_KB=0

pss_for_pid() {
  awk '/^Pss:/{sum+=$2} END {print sum+0}' /proc/$1/smaps 2>/dev/null || echo 0
}

for i in $(seq 1 $((SAMPLE_DURATION / 2))); do
  sleep 2
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "  Process exited early"
    break
  fi

  TOTAL_PSS_KB=0
  for pid in "$APP_PID" $(ps --ppid "$APP_PID" -o pid= 2>/dev/null); do
    PSS=$(pss_for_pid "$pid")
    TOTAL_PSS_KB=$((TOTAL_PSS_KB + PSS))
  done
  TOTAL_MB=$(awk "BEGIN { printf \"%.1f\", $TOTAL_PSS_KB / 1024 }")
  echo "  Sample $i: ${TOTAL_MB} MB PSS"
  SUM_PSS_KB=$((SUM_PSS_KB + TOTAL_PSS_KB))
  READINGS=$((READINGS + 1))
  if [[ $TOTAL_PSS_KB -gt $MAX_PSS_KB ]]; then MAX_PSS_KB=$TOTAL_PSS_KB; fi
done

if [[ $READINGS -gt 0 ]]; then
  AVG_KB=$((SUM_PSS_KB / READINGS))
  AVG_MB=$(awk "BEGIN { printf \"%.1f\", $AVG_KB / 1024 }")
  MAX_MB=$(awk "BEGIN { printf \"%.1f\", $MAX_PSS_KB / 1024 }")
  echo "  Average: ${AVG_MB} MB | Peak: ${MAX_MB} MB PSS  (budget: <${BUDGET_MEMORY_MB} MB PSS)"
  if lt_float "$MAX_MB" "$BUDGET_MEMORY_MB"; then
    pass "Peak memory ${MAX_MB} MB PSS < ${BUDGET_MEMORY_MB} MB"
  else
    fail "Peak memory ${MAX_MB} MB PSS exceeds ${BUDGET_MEMORY_MB} MB budget"
  fi
fi

# ─── 4. CPU at idle ──────────────────────────────────────────────────────────

echo ""
echo "── 4. CPU at idle ────────────────────────"
sleep 2
if kill -0 "$APP_PID" 2>/dev/null; then
  CPU=$(ps -p "$APP_PID" -o %cpu= 2>/dev/null | tr -d ' ')
  echo "  Main process CPU: ${CPU:-?}%"
  if lt_float "${CPU:-99}" "5.0"; then
    pass "Idle CPU ${CPU}% < 5%"
  else
    warn "Idle CPU ${CPU}% — check for background polling loops"
  fi

  # ─── 5. File descriptors & threads ───────────────────────────────────────

  echo ""
  echo "── 5. File descriptors & threads ─────────"
  FDS=$(ls /proc/$APP_PID/fd 2>/dev/null | wc -l)
  THREADS=$(awk '/^Threads:/{print $2}' /proc/$APP_PID/status 2>/dev/null || echo "?")
  echo "  Open FDs:  $FDS"
  echo "  Threads:   $THREADS"
  if [[ "$FDS" -lt 100 ]]; then
    pass "File descriptors $FDS < 100"
  else
    warn "File descriptors $FDS — check for leaks"
  fi
fi

echo ""
echo "── Cleaning up ───────────────────────────"
kill "$APP_PID" 2>/dev/null && echo "  Process terminated" || true

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo "  Done. Budgets from docs/ARCHITECTURE.md §13"
echo "══════════════════════════════════════════"
echo ""
