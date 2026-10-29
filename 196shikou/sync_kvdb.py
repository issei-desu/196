#!/usr/bin/env python3
import json
import time
import os
import urllib.request
import urllib.error

PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "progress.json")
ROOT_PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "..", "progress.json")
KVDB_URL = "https://kvdb.io/C73anz47CwZ5a14fmn1Rba/live_196"

SYNC_INTERVAL = 20  # 20秒ごとに更新頻度を落とす
last_sent_step = -1

print(f"[SYNC] Monitoring {PROGRESS_FILE} and sending to {KVDB_URL} every {SYNC_INTERVAL}s...")

while True:
    try:
        if os.path.exists(PROGRESS_FILE):
            with open(PROGRESS_FILE, "r") as f:
                data = json.load(f)
            
            step = data.get("step", 0)
            # 送信間隔が経過したか、ステップが進んでいるか
            payload = json.dumps(data).encode("utf-8")
            req = urllib.request.Request(
                KVDB_URL,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=8) as response:
                    if response.status in (200, 201):
                        print(f"[SYNC] Updated KVDB: Step {step}, Digits {data.get('digits')}, Speed {data.get('speed')}/s")
                        last_sent_step = step
                        # Also update root progress.json
                        with open(ROOT_PROGRESS_FILE, "w") as rf:
                            json.dump(data, rf, indent=2)
            except urllib.error.HTTPError as he:
                print(f"[SYNC] KVDB HTTP error: {he.code} {he.reason}")
                if he.code == 429:
                    print("[SYNC] Rate limited. Backing off for 60 seconds...")
                    time.sleep(60)
            except Exception as e:
                print(f"[SYNC] KVDB upload error: {e}")
    except Exception as e:
        print(f"[SYNC] Error: {e}")

    time.sleep(SYNC_INTERVAL)
