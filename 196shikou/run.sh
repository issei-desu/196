#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PID_FILE="$DIR/lychrel.pid"
LOG_FILE="$DIR/lychrel.log"
BIN="$DIR/lychrel_196"

if [ ! -f "$BIN" ]; then
    echo "Executable $BIN not found. Building..."
    make
fi

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "[ERROR] lychrel_196 is already running with PID $PID."
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

echo "Starting lychrel_196 in background..."
nohup "$BIN" "$@" </dev/null >> "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "[SUCCESS] Started lychrel_196 with PID $PID. Logs are written to $LOG_FILE"

# Start sync_kvdb.py
SYNC_PID_FILE="$DIR/sync.pid"
if pgrep -f sync_kvdb.py > /dev/null 2>&1; then
    pkill -f sync_kvdb.py || true
fi
nohup python3 "$DIR/sync_kvdb.py" </dev/null >> "$DIR/sync.log" 2>&1 &
SYNC_PID=$!
echo $SYNC_PID > "$SYNC_PID_FILE"
echo "[SUCCESS] Started sync_kvdb.py with PID $SYNC_PID."
