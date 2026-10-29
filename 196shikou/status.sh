#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DIR/lychrel.pid"
CP_FILE="$DIR/checkpoint.txt"
LOG_FILE="$DIR/lychrel.log"
RES_FILE="$DIR/palindrome_found.txt"

echo "=== 196 Lychrel Trial Status ==="

if [ -f "$RES_FILE" ]; then
    echo "🎉 PALINDROME FOUND! Check $RES_FILE"
    head -n 5 "$RES_FILE"
    exit 0
fi

PID=$(pgrep -x lychrel_196 || true)
if [ -n "$PID" ]; then
    echo "Status: RUNNING (PID: $PID)"
    echo $PID > "$PID_FILE"
elif [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "Status: RUNNING (PID: $PID)"
    else
        echo "Status: STOPPED"
        rm -f "$PID_FILE"
    fi
else
    echo "Status: STOPPED"
fi

if [ -f "$CP_FILE" ]; then
    STEP=$(head -n 1 "$CP_FILE")
    DIGITS=$(sed -n '2p' "$CP_FILE")
    echo "Current Checkpoint: Step $STEP | Digits $DIGITS"
else
    echo "Current Checkpoint: None (not started or fresh)"
fi

if [ -f "$LOG_FILE" ]; then
    echo ""
    echo "--- Recent Log Output (Last 5 lines) ---"
    tail -n 5 "$LOG_FILE"
fi
