#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "[DAEMON] Starting lychrel_196..."
./lychrel_196 >> "$DIR/lychrel.log" 2>&1 &
PID1=$!
echo $PID1 > "$DIR/lychrel.pid"

echo "[DAEMON] Starting sync_kvdb.py..."
python3 "$DIR/sync_kvdb.py" >> "$DIR/sync.log" 2>&1 &
PID2=$!
echo $PID2 > "$DIR/sync.pid"

cleanup() {
    echo "[DAEMON] Shutting down..."
    kill -TERM "$PID1" 2>/dev/null || true
    kill -TERM "$PID2" 2>/dev/null || true
    wait "$PID1" 2>/dev/null || true
    wait "$PID2" 2>/dev/null || true
    rm -f "$DIR/lychrel.pid" "$DIR/sync.pid"
}

trap cleanup SIGINT SIGTERM EXIT

wait "$PID1"
