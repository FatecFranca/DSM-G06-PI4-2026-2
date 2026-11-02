#!/usr/bin/env bash
set -euo pipefail
REPO=/home/ubuntu/HortaComunitaria_main_v5
QA=/home/ubuntu/coditec_qa/v5
BROKER_PORT=18883
API_PORT=31327
mosquitto -c "$QA/mosquitto-local.conf" -v >"$QA/mosquitto.log" 2>&1 &
BROKER_PID=$!
BACKEND_PID=''
cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  kill "$BROKER_PID" 2>/dev/null || true
  wait "$BROKER_PID" 2>/dev/null || true
}
trap cleanup EXIT
for i in $(seq 1 50); do
  if python3 - "$BROKER_PORT" <<'PY' >/dev/null 2>&1
import socket,sys
s=socket.create_connection(('127.0.0.1',int(sys.argv[1])),timeout=.2);s.close()
PY
  then break; fi
  sleep .1
done
cd "$REPO/backend"
PORT="$API_PORT" MONGO_URI='' MQTT_BROKER="mqtt://127.0.0.1:$BROKER_PORT" MQTT_TELEMETRY_TOPIC='coditec/v5/telemetry' MQTT_IRRIGATION_TOPIC='coditec/v5/irrigation' node src/index.js >"$QA/backend.log" 2>&1 &
BACKEND_PID=$!
ready=0
for i in $(seq 1 100); do
  if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null; then ready=1; break; fi
  sleep .1
done
if [[ "$ready" != 1 ]]; then cat "$QA/backend.log"; exit 1; fi
API_URL="http://127.0.0.1:$API_PORT" MQTT_BROKER="mqtt://127.0.0.1:$BROKER_PORT" MQTT_TELEMETRY_TOPIC='coditec/v5/telemetry' MQTT_IRRIGATION_TOPIC='coditec/v5/irrigation' node "$QA/validate_local_integration.mjs"
