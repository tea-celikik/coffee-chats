#!/usr/bin/env bash
# End-to-end API test for the coffee-chat backend.
# Usage: ./scripts/test-api.sh        (the backend must be running)
# Optional: BASE_URL=http://localhost:3000 HOST_KEY=... ./scripts/test-api.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="${BASE_URL:-http://localhost:3000}"
# Read HOST_KEY from backend/.env so the secret is never hardcoded here
KEY="${HOST_KEY:-$(grep -E '^HOST_KEY=' "$SCRIPT_DIR/../backend/.env" 2>/dev/null | cut -d= -f2-)}"
KEY="${KEY:-change-me}"

PASS=0; FAIL=0
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT # response bodies go here, deleted on exit

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
title() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }

# check <description> <expected> <actual>
check() {
  if [[ "$2" == "$3" ]]; then green "PASS  $1 (got $3)"; PASS=$((PASS + 1))
  else red "FAIL  $1 (expected $2, got $3)"; FAIL=$((FAIL + 1)); fi
}

# call <METHOD> <PATH> [JSON body] [host key] -> prints HTTP status, body is saved in $TMP
call() {
  local args=(-s -o "$TMP" -w "%{http_code}" -X "$1" "$BASE$2" -H "Content-Type: application/json")
  [[ -n "${4:-}" ]] && args+=(-H "x-host-key: $4")
  [[ -n "${3:-}" ]] && args+=(-d "$3")
  curl "${args[@]}"
}

# Random future time, so re-running the script doesn't hit "overlap" errors
future() { date -u -d "+$((3 + RANDOM % 300)) day" "+%Y-%m-%dT$(printf %02d $((RANDOM % 24))):00:00Z"; }

# create_slot -> sets SLOT_ID and SLOT_TIME (retries if the random time overlaps)
create_slot() {
  for _ in 1 2 3 4 5; do
    SLOT_TIME=$(future)
    if [[ $(call POST /host/slots "{\"startsAt\":\"$SLOT_TIME\",\"durationMinutes\":30}" "$KEY") == 201 ]]; then
      SLOT_ID=$(grep -o '"id":"[^"]*"' "$TMP" | head -1 | cut -d'"' -f4)
      return 0
    fi
  done
  red "Could not create a slot: $(cat "$TMP")"; exit 1
}

# Pre-check
if ! curl -s -o /dev/null "$BASE/slots"; then
  red "Backend is not reachable at $BASE. Start it with: cd backend && npm run start:dev"
  exit 1
fi

# Slots (host)
title "Slots"
check "create without key -> 401"   401 "$(call POST /host/slots '{}')"
check "create with wrong key -> 401" 401 "$(call POST /host/slots '{}' wrong-key)"
check "slot in the past -> 400"      400 "$(call POST /host/slots '{"startsAt":"2020-01-01T10:00:00Z","durationMinutes":30}' "$KEY")"
check "invalid duration -> 400"      400 "$(call POST /host/slots "{\"startsAt\":\"$(future)\",\"durationMinutes\":7}" "$KEY")"

create_slot; SLOT1=$SLOT_ID
green "PASS  create slot -> 201 ($SLOT1)"; PASS=$((PASS + 1))
check "overlapping slot -> 409" 409 "$(call POST /host/slots "{\"startsAt\":\"$SLOT_TIME\",\"durationMinutes\":30}" "$KEY")"

# Bookings (guest)
title "Bookings"
check "invalid email -> 400"         400 "$(call POST /slots/$SLOT1/bookings '{"name":"Ana","email":"not-an-email"}')"
check "empty name -> 400"            400 "$(call POST /slots/$SLOT1/bookings '{"name":"   ","email":"ana@mail.com"}')"
check "unknown field -> 400"         400 "$(call POST /slots/$SLOT1/bookings '{"name":"Ana","email":"ana@mail.com","isAdmin":true}')"
check "slot id not a UUID -> 400"    400 "$(call POST /slots/123/bookings '{"name":"Ana","email":"ana@mail.com"}')"
check "slot does not exist -> 404"   404 "$(call POST /slots/00000000-0000-4000-8000-000000000000/bookings '{"name":"Ana","email":"ana@mail.com"}')"
check "valid booking -> 201"         201 "$(call POST /slots/$SLOT1/bookings '{"name":"Ana","email":"ana@mail.com","note":"careers in security"}')"
check "same slot again -> 409"       409 "$(call POST /slots/$SLOT1/bookings '{"name":"Bob","email":"bob@mail.com"}')"

# Race condition
title "Concurrency: 20 guests book the same slot at once"
create_slot; SLOT2=$SLOT_ID
codes=$(
  for i in $(seq 1 20); do
    curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/slots/$SLOT2/bookings" \
      -H "Content-Type: application/json" -d "{\"name\":\"Guest $i\",\"email\":\"g$i@mail.com\"}" & # & = run in parallel
  done
  wait # wait for all 20 requests to finish
)
check "exactly one 201" 1  "$(grep -c '^201$' <<<"$codes")"
check "nineteen 409s"   19 "$(grep -c '^409$' <<<"$codes")"

# Privacy
title "Privacy"
call GET /slots >/dev/null
check "public list marks slot as booked" yes "$(grep -q "\"id\":\"$SLOT1\"[^}]*\"isBooked\":true" "$TMP" && echo yes || echo no)"
check "public list leaks no emails"      no  "$(grep -q '@' "$TMP" && echo yes || echo no)"
check "host list without key -> 401"     401 "$(call GET /host/slots)"
call GET /host/slots "" "$KEY" >/dev/null
check "host list shows guest email"      yes "$(grep -q 'ana@mail.com' "$TMP" && echo yes || echo no)"

# Cleanup (also tests delete)
title "Cleanup"
check "delete slot 1 -> 204"        204 "$(call DELETE /host/slots/$SLOT1 "" "$KEY")"
check "delete slot 2 -> 204"        204 "$(call DELETE /host/slots/$SLOT2 "" "$KEY")"
check "delete again -> 404"         404 "$(call DELETE /host/slots/$SLOT1 "" "$KEY")"

# Summary
printf "\n\033[1mResult: %d passed, %d failed\033[0m\n" "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]] # exit code 0 only if everything passed (useful for CI)
