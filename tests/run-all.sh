#!/usr/bin/env bash
# Runs every test of the app on both runtimes and prints a summary.
#
#   bash tests/run-all.sh            (or: npm test)
#
# 1. starts the Econt mock (tests/mock-econt.js)
# 2. the parser golden test and the old-Safari (lookbehind-free) test (Node)
# 3. the Node server (server.js) pointed at the mock: api, moved, ui, regress
# 4. wrangler dev (Cloudflare's workerd running worker.js, local only, no
#    Cloudflare login) pointed at the mock: api, moved, ui, regress, CPU per route
#
# Needs: node 18+, `npm install` (for wrangler), and Playwright with Chromium
# installed globally (NODE_PATH=$(npm root -g)).
# Options (env): ONLY=node|workerd   SUITES="api moved ui regress"   KEEP_LOGS=1
#                COLD_RUNS=<n> fresh Workers per route for the CPU check (default 3, 0 = skip)
#                SHOT_DIR=<dir> (screenshots)   E2E_VERBOSE=1
# Only the processes this script starts are stopped at the end.

set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LOGS=$(mktemp -d "${TMPDIR:-/tmp}/econt-tests.XXXXXX")
SUITES=${SUITES:-"api moved ui regress"}
ONLY=${ONLY:-}
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
export WRANGLER_SEND_METRICS=false CLOUDFLARE_CF_FETCH_ENABLED=false
WRANGLER="$ROOT/node_modules/.bin/wrangler"

PIDS=()
# A process this script started, with everything it started in turn (wrangler runs workerd).
tree() { local c; for c in $(cat /proc/"$1"/task/*/children 2>/dev/null); do tree "$c"; done; echo "$1"; }
stop() { local all; all=$(tree "$1"); kill $all 2>/dev/null; sleep 0.3; kill -9 $all 2>/dev/null; }
cleanup() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && stop "$p"; done
  if [ -z "${KEEP_LOGS:-}" ] && [ "${FAILED:-1}" = 0 ]; then rm -rf "$LOGS"; fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

free_port() { node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"; }
wait_http() { # url, seconds
  local url=$1 t=$(( $2 * 4 ))
  for _ in $(seq 1 "$t"); do
    if curl -s -o /dev/null -m 2 -X POST "$url"; then return 0; fi
    sleep 0.25
  done
  return 1
}

RESULTS=()   # "suite runtime pass fail secs"
record() { # logfile, suite, runtime, exit code
  local line
  line=$(grep -E '^RESULT suite=' "$1" | tail -1)
  if [ -z "$line" ]; then
    RESULTS+=("$2 $3 0 1 ?")
    echo "  !! $2 on $3 printed no result (exit $4). Last lines:"; tail -15 "$1" | sed 's/^/     /'
    return
  fi
  local pass fail secs
  pass=$(sed -E 's/.* pass=([0-9]+).*/\1/' <<<"$line"); fail=$(sed -E 's/.* fail=([0-9]+).*/\1/' <<<"$line")
  secs=$(grep -oE 'secs=[0-9]+' <<<"$line" | cut -d= -f2); secs=${secs:-?}
  if [ "$4" != 0 ] && [ "$fail" = 0 ]; then fail=1; fi
  RESULTS+=("$2 $3 $pass $fail $secs")
  if [ "$fail" != 0 ]; then echo "  FAILED checks in $2 ($3):"; grep -E '^(FAIL|CRASH)' "$1" | sed 's/^/     /' | head -30; fi
}
run_suite() { # suite, runtime, app url
  local log="$LOGS/$1-$2.log"
  echo "- $1 on $2"
  RUNTIME=$2 APP_URL=$3 MOCK_URL=$MOCK_URL timeout 900 node "tests/e2e/$1.js" >"$log" 2>&1
  record "$log" "$1" "$2" $?
}

echo "Econt shipper tests  ($(date -u '+%Y-%m-%d %H:%M UTC'), node $(node --version), logs: $LOGS)"
if ! node -e "require('playwright')" 2>/dev/null; then
  echo "!! Playwright not found under NODE_PATH=$NODE_PATH: the browser suites will fail."
fi

# ---------- the Econt mock ----------
MOCK_PORT=$(free_port)
MOCK_URL="http://127.0.0.1:$MOCK_PORT"
node tests/mock-econt.js "$MOCK_PORT" >"$LOGS/mock.log" 2>&1 &
PIDS+=($!)
wait_http "$MOCK_URL/__state" 10 || { echo "!! the mock did not start"; cat "$LOGS/mock.log"; exit 1; }
echo "mock: $MOCK_URL"

# ---------- parser golden + old Safari (Node) ----------
echo "- parser-golden on node"
node tests/parser-golden.js >"$LOGS/golden.log" 2>&1
record "$LOGS/golden.log" parser-golden node $?
echo "- lookbehind-free on node"
node tests/lookbehind-free.js >"$LOGS/lookbehind.log" 2>&1
record "$LOGS/lookbehind.log" lookbehind-free node $?

# ---------- Node server ----------
if [ "$ONLY" != workerd ]; then
  NODE_PORT=$(free_port)
  PORT=$NODE_PORT ECONT_BASE_PRODUCTION="$MOCK_URL/prod" ECONT_BASE_DEMO="$MOCK_URL/demo/ee" node server.js >"$LOGS/node-server.log" 2>&1 &
  NODE_PID=$!; PIDS+=($NODE_PID)
  if wait_http "http://127.0.0.1:$NODE_PORT/api/ping" 15; then
    echo "node server: http://127.0.0.1:$NODE_PORT"
    for s in $SUITES; do run_suite "$s" node "http://127.0.0.1:$NODE_PORT"; done
  else
    echo "!! the Node server did not start"; cat "$LOGS/node-server.log"; RESULTS+=("node-server node 0 1 ?")
  fi
  stop "$NODE_PID"
fi

# ---------- wrangler dev (workerd) ----------
if [ "$ONLY" != node ]; then
  if [ ! -x "$WRANGLER" ]; then
    echo "wrangler not installed: running npm install"
    npm install --no-audit --no-fund >"$LOGS/npm-install.log" 2>&1 || { echo "!! npm install failed"; tail "$LOGS/npm-install.log"; }
  fi
  # What Workers Builds will run on Cloudflare (`npx wrangler deploy`), minus the upload.
  echo "- wrangler deploy --dry-run (bundle + assets + config)"
  if "$WRANGLER" deploy --dry-run --outdir "$LOGS/dist" >"$LOGS/deploy-dry-run.log" 2>&1 && grep -q 'env.ASSETS' "$LOGS/deploy-dry-run.log" && [ -s "$LOGS/dist/worker.js" ]; then
    RESULTS+=("deploy-dry-run workerd 1 0 ?")
  else
    RESULTS+=("deploy-dry-run workerd 0 1 ?"); echo "  FAILED: wrangler deploy --dry-run"; tail -20 "$LOGS/deploy-dry-run.log" | sed 's/^/     /'
  fi
  WR_PORT=$(free_port); WR_INSPECT=$(free_port)
  "$WRANGLER" dev --local --ip 127.0.0.1 --port "$WR_PORT" --inspector-port "$WR_INSPECT" \
    --var "ECONT_BASE_PRODUCTION:$MOCK_URL/prod" --var "ECONT_BASE_DEMO:$MOCK_URL/demo/ee" \
    --show-interactive-dev-session=false >"$LOGS/wrangler.log" 2>&1 &
  WR_PID=$!; PIDS+=($WR_PID)
  if wait_http "http://127.0.0.1:$WR_PORT/api/ping" 60; then
    echo "wrangler dev (workerd): http://127.0.0.1:$WR_PORT"
    for s in $SUITES; do run_suite "$s" workerd "http://127.0.0.1:$WR_PORT"; done
    echo "- cpu per relay route on workerd"
    APP_URL="http://127.0.0.1:$WR_PORT" MOCK_URL=$MOCK_URL WRANGLER_PID=$WR_PID node tests/cpu-profile.js >"$LOGS/cpu.log" 2>&1
    record "$LOGS/cpu.log" cpu workerd $?
  else
    echo "!! wrangler dev did not start"; tail -30 "$LOGS/wrangler.log"; RESULTS+=("wrangler workerd 0 1 ?")
  fi
fi

# ---------- summary ----------
echo
echo "Summary"
printf '  %-15s %-8s %6s %6s %6s\n' suite runtime pass fail secs
TP=0; TF=0
for r in "${RESULTS[@]}"; do
  read -r s rt p f sec <<<"$r"
  printf '  %-15s %-8s %6s %6s %6s\n' "$s" "$rt" "$p" "$f" "$sec"
  TP=$((TP + p)); TF=$((TF + f))
done
if [ -f "$LOGS/cpu.log" ]; then echo; sed -n '/^CPU per request/,/^RESULT/p' "$LOGS/cpu.log" | grep -v '^RESULT' | sed 's/^/  /'; fi
echo
if [ "$TF" = 0 ]; then FAILED=0; echo "ALL PASS: $TP checks"; else FAILED=1; echo "FAILED: $TF of $((TP + TF)) checks (logs kept in $LOGS)"; fi
exit $FAILED
