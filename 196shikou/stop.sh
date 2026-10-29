#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DIR/lychrel.pid"

PID=""
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
fi
if [ -z "$PID" ] || ! ps -p "$PID" > /dev/null 2>&1; then
    PID=$(pgrep -x lychrel_196 || true)
fi

if [ -z "$PID" ]; then
    echo "[INFO] lychrel_196 does not seem to be running."
    rm -f "$PID_FILE"
    exit 0
fi
if ps -p "$PID" > /dev/null 2>&1; then
    echo "Sending SIGTERM to process $PID to save checkpoint and exit..."
    kill -TERM "$PID"
    
    # Wait for process to exit safely
    COUNT=0
    while ps -p "$PID" > /dev/null 2>&1; do
        sleep 0.5
        COUNT=$((COUNT + 1))
        if [ $COUNT -ge 20 ]; then
            echo "Waiting took longer than 10s, process is still finishing checkpoint..."
        fi
    done
    rm -f "$PID_FILE"
    echo "[SUCCESS] Process $PID stopped safely."
else
    echo "[INFO] Process $PID is not running. Removing stale PID file."
    rm -f "$PID_FILE"
fi

# Stop sync_kvdb.py
if pgrep -f sync_kvdb.py > /dev/null 2>&1; then
    pkill -f sync_kvdb.py || true
    echo "[SUCCESS] Stopped sync_kvdb.py."
fi
rm -f "$DIR/sync.pid"
