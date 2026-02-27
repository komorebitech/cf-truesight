#!/usr/bin/env bash
set -euo pipefail

INGESTION_URL="${INGESTION_URL:-http://localhost:8080}"
API_KEY="ts_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

PROJECT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
DEVICE_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
ANONYMOUS_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

EVENT_NAMES=("app_open" "screen_view" "button_click" "purchase" "app_close")

EVENTS="[]"

for i in $(seq 0 4); do
    EVENT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
    TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
    EVENT_NAME="${EVENT_NAMES[$i]}"

    EVENT=$(cat <<EVTJSON
{
  "event_id": "$EVENT_ID",
  "event_name": "$EVENT_NAME",
  "event_type": "track",
  "anonymous_id": "$ANONYMOUS_ID",
  "client_timestamp": "$TIMESTAMP",
  "properties": "{}",
  "os_name": "iOS",
  "os_version": "18.3",
  "device_model": "iPhone16,2",
  "device_id": "$DEVICE_ID",
  "locale": "en_US",
  "timezone": "America/New_York",
  "sdk_version": "0.1.0"
}
EVTJSON
)

    if [ "$i" -eq 0 ]; then
        EVENTS="[$EVENT"
    else
        EVENTS="$EVENTS,$EVENT"
    fi
done

EVENTS="$EVENTS]"

PAYLOAD="{\"events\":$EVENTS}"

echo "Sending 5 events to $INGESTION_URL/v1/track"
echo "Project: $PROJECT_ID"
echo "---"

COMPRESSED=$(echo -n "$PAYLOAD" | zstd -c)

RESPONSE=$(echo -n "$PAYLOAD" | zstd -c | curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$INGESTION_URL/v1/track" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "Content-Encoding: zstd" \
    --data-binary @-)

BODY=$(echo "$RESPONSE" | sed '$d')
STATUS=$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_STATUS://')

echo "Response status: $STATUS"
echo "Response body:   $BODY"
