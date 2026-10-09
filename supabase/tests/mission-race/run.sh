#!/bin/bash
# Runs inside the database container. Twenty PostgreSQL connections meet at one advisory-lock barrier.
set -euo pipefail
dir=$1
N=20
P=(psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${P[@]}" -f "$dir/setup.sql"
"${P[@]}" -f "$dir/controller.sql" &
controller=$!
held=0
for _ in $(seq 1 200); do
  if [ "$("${P[@]}" -tAc "select count(*) from pg_locks where locktype = 'advisory' and objid = 7302 and mode = 'ExclusiveLock' and granted")" = 1 ]; then held=1; break; fi
  sleep 0.05
done
[ "$held" = 1 ] || { echo 'FAIL: mission race controller never took the barrier'; exit 1; }
pids=()
failed=0
for i in $(seq 1 "$N"); do "${P[@]}" -f "$dir/worker.sql" & pids+=($!); done
for pid in "${pids[@]}"; do wait "$pid" || failed=1; done
wait "$controller" || failed=1
[ "$failed" = 0 ] || { echo 'FAIL: a mission race connection exited non-zero'; exit 1; }
"${P[@]}" -f "$dir/assert.sql"
