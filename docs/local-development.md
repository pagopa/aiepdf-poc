# Local development

The pilot can be run locally as a full containerized stack with **Docker Compose**
(orchestrated by **mise** tasks). The stack exercises the real adapters:
PostgreSQL for Practices/Documents, Azurite for agreement blobs, and the real
CAdES verifier.

## Prerequisites

- Docker (or Rancher Desktop / Docker Desktop)
- `mise` (optional but recommended) and Node 22 (`mise` / `nodenv`)
- `pnpm`

## Quick start

```bash
mise run local:up      # builds the API + UI artifacts, then starts the stack
mise run local:smoke   # health, readiness and typed-404 smoke tests
mise run local:down    # stop and remove volumes
```

`local:up` runs `nx run adhesion-api:prune`, builds the Next.js static export
with `NEXT_PUBLIC_API_BASE_URL`, then `docker compose up --build -d`.

## Services and ports

| Service | URL | Notes |
| --- | --- | --- |
| Adhesion API | http://localhost:3000 | `/health`, `/ready`, `/config` |
| Upload UI | http://localhost:8080 | nginx serving the static export |
| PostgreSQL | `localhost:15432` | host port overridable |
| Azurite (blob) | `localhost:11000` | host port overridable |

Host ports are overridable to avoid clashes with existing local services:

```bash
POSTGRES_HOST_PORT=25432 AZURITE_HOST_PORT=21000 mise run local:up
```

## Host-based development (API outside Docker)

Run only the dependencies in containers and the app on the host:

```bash
mise run local:infra   # postgres + azurite
mise run local:api     # API on the host, migrations run at startup
mise run local:web     # Next.js dev server
```

## What happens on startup

- The API runs `contracts.item-002` migrations (idempotent, advisory-locked)
  before it starts listening.
- `AZURE_STORAGE_CREATE_CONTAINER=true` makes the local API create the
  `agreements` container in Azurite; in Azure the container is created by
  Terraform.
- `CORS_ALLOWED_ORIGINS=http://localhost:8080` lets the browser UI (served by
  nginx on a different origin) call the API. In Azure, Terraform sets it to the
  Static Web App origin.
- Readiness (`/ready`) verifies both the practice registry and the agreement
  storage, so the container only becomes healthy when the whole stack is usable.

## Manual verification

```bash
# valid CAdES upload
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 1 -nodes -subj "/CN=Adhesion Test"
openssl smime -sign -in content.txt -signer cert.pem -inkey key.pem -outform DER -nodetach -out agreement.p7m
docker exec adhesion-pilot-postgres-1 psql -U adhesion -d adhesion \
  -c "insert into practices (onboarding_id, status) values ('practice-demo','REQUEST');"
curl -F "file=@agreement.p7m" http://localhost:3000/practices/practice-demo/agreements
```

## Tests

```bash
# fast unit suite (in-memory adapters, no Docker)
pnpm exec nx run adhesion-api:test

# live integration suite (real PostgreSQL + Azurite via Testcontainers)
pnpm exec nx run adhesion-api:test:integration

# environment smoke test against a running stack
mise run local:smoke
```

The integration suite starts containers automatically; see
`docs/adhesion-api-integration-report.md`. On Docker Desktop / Rancher the suite
resolves `DOCKER_HOST` from the active Docker context and overrides the socket
path for Ryuk.

## Canary rollout

The DX `release-azure-containerapp-v1` workflow performs an incremental rollout
and looks for `canary-monitor.sh` at the repository root (see
`release-azure-containerapp-v1.yaml`). It runs the script at every traffic step
with `<resource-group> <container-app> <current-percentage>` and reads
`{"nextPercentage", "afterMs"}` from stdout; a non-zero exit or invalid JSON
reverts all traffic to the previous revision.

`canary-monitor.sh` probes the new revision directly through its revision FQDN
(`/health`, `/ready` and a typed-404 domain check) before it receives traffic.
Tune it with:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CANARY_STEP_PERCENTAGE` | `25` | Traffic added per step |
| `CANARY_STEP_WAIT_MS` | `30000` | Observation window per step |
| `CANARY_PROBE_TIMEOUT` | `30` | Seconds to wait for a probe to pass |
| `CANARY_CURL_TIMEOUT` | `10` | Per-request timeout |
