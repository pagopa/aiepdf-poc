#!/usr/bin/env bash
#
# Canary monitor for the adhesion-api Container App rollout.
#
# The DX `incremental-rollout` action checks out this file from the repository
# root and runs it at every traffic step:
#
#   bash ./canary-monitor.sh <resource-group> <container-app> <current-percentage>
#
# Contract:
#   - stdout MUST be exactly one JSON object: {"nextPercentage": n, "afterMs": ms}
#   - any non-zero exit code, or invalid/missing JSON, makes the action revert
#     all traffic to the previous revision.
#   - all human-readable output must go to stderr, never stdout.
#
# The script probes the NEW revision directly (before it receives traffic) using
# the revision-specific FQDN, so failures are caught at 0% traffic.

set -euo pipefail

resource_group_name="${1:?resource group name is required}"
resource_name="${2:?container app name is required}"
current_percentage="${3:-0}"

# Tunables (overridable from the workflow environment).
STEP_PERCENTAGE="${CANARY_STEP_PERCENTAGE:-25}"
STEP_WAIT_MS="${CANARY_STEP_WAIT_MS:-30000}"
CURL_TIMEOUT_SECONDS="${CANARY_CURL_TIMEOUT:-10}"
PROBE_TIMEOUT_SECONDS="${CANARY_PROBE_TIMEOUT:-30}"
PROBE_INTERVAL_SECONDS="${CANARY_PROBE_INTERVAL:-3}"

log() { echo "::notice::$*" >&2; }
debug() { echo "::debug::$*" >&2; }
fail() {
  echo "::error::$*" >&2
  exit 1
}

# Wait until a URL answers with the expected status code, or fail.
wait_for_status() {
  local url="$1"
  local expected="$2"
  local label="$3"
  local deadline=$((SECONDS + PROBE_TIMEOUT_SECONDS))
  local status=""

  while [ "$SECONDS" -lt "$deadline" ]; do
    status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$CURL_TIMEOUT_SECONDS" "$url" || true)"
    if [ "$status" = "$expected" ]; then
      debug "$label: $url -> $status"
      return 0
    fi
    sleep "$PROBE_INTERVAL_SECONDS"
  done

  fail "$label failed: $url returned '$status' (expected $expected)"
}

# Resolve the newest active revision and its revision-specific FQDN.
new_revision="$(az containerapp revision list \
  --name "$resource_name" \
  --resource-group "$resource_group_name" \
  --query 'sort_by([?properties.active], &properties.createdTime)[-1].name' \
  --output tsv)"

if [ -z "$new_revision" ] || [ "$new_revision" = "None" ]; then
  fail "could not resolve the newest active revision of $resource_name"
fi
debug "Newest active revision: $new_revision"

revision_fqdn="$(az containerapp revision show \
  --name "$resource_name" \
  --resource-group "$resource_group_name" \
  --revision "$new_revision" \
  --query 'properties.fqdn' \
  --output tsv)"

if [ -z "$revision_fqdn" ] || [ "$revision_fqdn" = "None" ]; then
  log "Revision FQDN unavailable; falling back to the application FQDN"
  revision_fqdn="$(az containerapp show \
    --name "$resource_name" \
    --resource-group "$resource_group_name" \
    --query 'properties.configuration.ingress.fqdn' \
    --output tsv)"
fi

[ -n "$revision_fqdn" ] || fail "could not resolve a FQDN for $resource_name"
base_url="https://$revision_fqdn"
log "Probing $new_revision at $base_url (current traffic: ${current_percentage}%)"

# 1. Liveness: the process is up.
wait_for_status "$base_url/health" 200 "liveness"

# 2. Readiness: dependencies (practice registry, agreement storage) are reachable.
wait_for_status "$base_url/ready" 200 "readiness"

# 3. Readiness must actually report ok, not only return 200.
ready_body="$(curl -fsS --max-time "$CURL_TIMEOUT_SECONDS" "$base_url/ready")"
if ! printf '%s' "$ready_body" | jq -e '.ok == true' >/dev/null 2>&1; then
  fail "readiness payload is not ok: $ready_body"
fi

# 4. Domain smoke test: an unknown practice must return the typed 404 problem,
#    proving routing, the practice registry and the problem+json projection work.
probe_practice="canary-${new_revision}-${RANDOM}"
probe_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  --max-time "$CURL_TIMEOUT_SECONDS" \
  "$base_url/practices/$probe_practice" || true)"
if [ "$probe_status" != "404" ]; then
  fail "domain smoke test failed: GET /practices/$probe_practice returned '$probe_status' (expected 404)"
fi

log "Smoke tests passed for $new_revision"

# Drive the rollout: advance by one step, stop at 100.
if [ "$current_percentage" -ge 100 ]; then
  next_percentage=100
  after_ms=0
else
  next_percentage=$((current_percentage + STEP_PERCENTAGE))
  if [ "$next_percentage" -gt 100 ]; then
    next_percentage=100
  fi
  after_ms="$STEP_WAIT_MS"
fi

jq -n \
  --argjson nextPercentage "$next_percentage" \
  --argjson afterMs "$after_ms" \
  '{nextPercentage: $nextPercentage, afterMs: $afterMs}'
