# adhesion-api

HTTP API for the CED Adhesion pilot (`UC-01`, `EPIC-01`).

It implements the signed-agreement upload and the practice status read defined
by `contracts.item-001`, following the Ports & Adapters layering:

| Layer | Location | Responsibility |
| --- | --- | --- |
| Use case | `@aiepdf/adhesion-domain` | Business rules, ordering, invariants, typed errors |
| Ports | `@aiepdf/adhesion-domain` | Repository, blob storage, signature verifier contracts |
| Adapters | `src/adapters/**` | PostgreSQL, Azure Blob, in-memory |
| Verification | `@aiepdf/adhesion-verification` | In-process CAdES (`.p7m`) verification |
| HTTP | `src/http/**` | Routes and the RFC 9457 problem projection |
| Config | `src/config/**` | Environment + Azure App Configuration settings and feature flags |

## Endpoints

- `POST /practices/{onboardingId}/agreements` — upload a CAdES `.p7m` (max 10 MB).
- `GET /practices/{onboardingId}` — read the practice status.
- `GET /config` — pilot runtime configuration (`uploadEnabled`, `maxUploadMb`).
- `GET /health` — liveness probe (process up).
- `GET /ready` — readiness probe (practice registry and agreement storage).

## Configuration

All values come from the environment and are validated with zod. When
`APP_CONFIG_ENDPOINT` is set, non-secret settings and feature flags are overlaid
from Azure App Configuration (`apps/adhesion-api/appsettings.json`):

| Setting / flag | Default | Purpose |
| --- | --- | --- |
| `adhesion:upload:maxSizeMb` | `10` | Pilot upload limit |
| `adhesion:storage:container` | `agreements` | Blob container |
| `adhesion:agreement:templateVersion` | empty | Placeholder, not enforced |
| `adhesion.upload.enabled` | `true` | Upload kill switch |
| `adhesion.verification.strict` | `true` | Reserved for demo mode |

Adapters are selected through `PERSISTENCE` (`memory` \| `postgres`) and
`STORAGE` (`memory` \| `azure`). Local runs use the in-memory adapters; Azure
deployments use PostgreSQL and Blob Storage through the Managed Identity.
`POSTGRES_SSL` defaults to `true` (required by Azure) and is disabled for the
local container; `AZURE_STORAGE_CONNECTION_STRING` and
`AZURE_STORAGE_CREATE_CONTAINER=true` are used only by the local stack. See
`docs/local-development.md` at the repository root.

## Commands

```bash
pnpm exec nx run adhesion-api:test
pnpm exec nx run adhesion-api:typecheck
pnpm exec nx run adhesion-api:lint
pnpm exec nx run adhesion-api:build
pnpm exec nx run adhesion-api:serve   # local run with in-memory adapters
```
