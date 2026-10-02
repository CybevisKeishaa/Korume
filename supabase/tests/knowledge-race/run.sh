#!/bin/bash
# Multi-connection race cases of verify:db:knowledge (spec 2026-10-02 part 1b §7). Runs INSIDE the database
# container: each round starts N separate psql connections that block on a shared advisory lock (7101)
# held by a controller connection; the controller releases it only once all N are waiting, so every
# worker calls the function under test at the same moment.
# Usage: bash -s -- <dir with the race SQL files>   (fed through `tr -d '\r'`, so CRLF checkouts work)
set -euo pipefail
dir=$1
N=20
P=(psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

round() { # <worker file> [extra psql -v args...]; worker i also gets -v i=<i>
  local worker=$1; shift
  "${P[@]}" -v n=$N -f "$dir/controller.sql" &
  local controller=$! held=0
  for _ in $(seq 1 200); do
    if [ "$("${P[@]}" -tAc "select count(*) from pg_locks where locktype = 'advisory' and objid = 7101 and mode = 'ExclusiveLock' and granted")" = 1 ]; then held=1; break; fi
    sleep 0.05
  done
  [ $held = 1 ] || { echo "FAIL: controller never took the barrier"; exit 1; }
  local pids=() failed=0
  for i in $(seq 1 $N); do "${P[@]}" -v i="$i" "$@" -f "$dir/$worker" & pids+=($!); done
  for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
  wait "$controller" || failed=1
  [ $failed = 0 ] || { echo "FAIL: a connection of round $worker $* exited non-zero"; exit 1; }
}

"${P[@]}" -f "$dir/setup.sql"
round lease-worker.sql
round plus-worker.sql -v case=b -v email=knowledgegate-race-plus-b@example.invalid -v fuse=5 -v credits=1000000 -v reserve_credits=1
round plus-worker.sql -v case=c -v email=knowledgegate-race-plus-c@example.invalid -v fuse=200 -v credits=10 -v reserve_credits=3
"${P[@]}" -c "insert into knowledge_race_state select 'budget_base', reserved_usd + spent_usd from ai_budget_days where period_day = (now() at time zone 'utc')::date"
round budget-worker.sql
round free-worker.sql -v case=e1 -v email=knowledgegate-race-free-a@example.invalid -v same=1
round free-worker.sql -v case=e2 -v email=knowledgegate-race-free-b@example.invalid -v same=0
"${P[@]}" -f "$dir/assert.sql"
