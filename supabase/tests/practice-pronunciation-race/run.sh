#!/bin/bash
# Two live scorer connections overlap across an expired lease, using a session advisory-lock barrier.
set -euo pipefail
dir=$1
P=(psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
cleanup() {
  "${P[@]}" -c "delete from videos where youtube_video_id = 'practicegate-race'; delete from auth.users where email = 'practicegate-race@example.invalid';"
}
trap cleanup EXIT
"${P[@]}" -f "$dir/setup.sql"
"${P[@]}" -f "$dir/successor.sql" &
successor=$!
held=0
for _ in $(seq 1 200); do
  if [ "$("${P[@]}" -tAc "select count(*) from pg_locks where locktype = 'advisory' and objid = 7147 and mode = 'ExclusiveLock' and granted")" = 1 ]; then held=1; break; fi
  sleep 0.05
done
[ $held = 1 ] || { echo 'FAIL race: successor never took barrier'; wait "$successor" || true; exit 1; }
"${P[@]}" -f "$dir/stale.sql" &
stale=$!
failed=0
wait "$stale" || failed=1
wait "$successor" || failed=1
[ $failed = 0 ] || exit 1
