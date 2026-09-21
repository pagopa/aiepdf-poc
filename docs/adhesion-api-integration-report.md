# adhesion-api integration test report

Re-entry snapshot for the live test harness. Workflow path: **integration**
(no record-replay). Protected contract: the `UC-01` upload over the real HTTP
runtime, with the real PostgreSQL and Azure Blob adapters, including the
browser CORS contract.

## Scope

The unit suites in `apps/adhesion-api/src/**/*.spec.ts` use in-memory adapters
and do not exercise the real wiring; they missed two production-breaking bugs: a
CORS gap between the Static Web App origin and the API, and a missing Next.js
`NEXT_PUBLIC_API_BASE_URL` inline. This harness closes the first at the HTTP
boundary and the smoke script closes the second at the UI boundary.

## Suite overview

| Scenario | Suite file | Boundary | Observable outcome | Infrastructure |
| --- | --- | --- | --- | --- |
| `AC-01` valid CAdES upload | `src/__integrations__/upload.integration.spec.ts` | Full Fastify runtime + real adapters | `201`, practice `PENDING`, one `documents` row, blob byte-identical to the upload | PostgreSQL + Azurite (Testcontainers) |
| `AC-02` disallowed extension | same | same | `400 AGREEMENT_EXTENSION_INVALID`, no row, no blob, practice unchanged | same |
| `AC-02` invalid signature | same | same | `400 AGREEMENT_SIGNATURE_INVALID`, no row, no blob | same |
| `AC-03` duplicate step-1 | same | same | `409 PRACTICE_STATE_INVALID`, exactly one row and one blob | same |
| Oversized upload | same | same | `400 AGREEMENT_FILE_TOO_LARGE` (limit 1 MB override) | same |
| CORS preflight | `src/__integrations__/cors.integration.spec.ts` | Full runtime | preflight `< 300` with `access-control-allow-origin` and `POST` allowed | PostgreSQL + Azurite |
| CORS on real response | same | same | `201` upload carries `access-control-allow-origin` | same |
| CORS unknown origin | same | same | no `access-control-allow-origin` | same |
| Liveness / readiness | `src/__integrations__/readiness.integration.spec.ts` | Full runtime | `/health` ok; `/ready` `{ok:true}` with both checks | PostgreSQL + Azurite |
| Migration idempotency | same | Real DB | `schema_migrations` has one row after two runs; tables exist | PostgreSQL |

## Shared harness

| Concern | File |
| --- | --- |
| Container lifecycle + connection metadata (`provide`) | `src/__integrations__/global-setup.ts` |
| Docker socket resolution (Rancher/macOS vs Linux) | `src/__integrations__/support/docker-host.ts` |
| App/database/blob helpers, fixtures, multipart builder | `src/__integrations__/support/harness.ts` |
| CAdES `.p7m` fixture (generated with `openssl`) | `src/__integrations__/support/cades-fixture.ts` |
| `ProvidedContext` types | `src/__integrations__/provided-context.d.ts` |
| Opt-in config (excluded from the unit run) | `vitest.integration.config.mts` |
| Composition root shared with the server | `src/app/create-app-dependencies.ts` |

Dependencies are **real**: PostgreSQL 17 and Azurite via the official
`@testcontainers/postgresql` and `@testcontainers/azurite` modules. The suite
builds the app through `createAppDependencies`, the same composition root as
`main.ts`, so adapter selection, migrations, readiness and CORS wiring cannot
drift from production. Containers start once per run (global setup) and files
run sequentially (`fileParallelism: false`); each test resets rows and blobs
through `resetState()`.

The checked-in `apps/adhesion-api/Dockerfile` runtime is intentionally **not**
reused here: the harness drives the Fastify app in-process (`app.inject`) with
the real dependencies, which is the honest boundary for route/adapter/CORS
behaviour and avoids containerizing the app for every run. The container runtime
itself is exercised separately by the local compose stack and the canary script.

`openssl` must be on `PATH` (present on macOS and `ubuntu-latest`).

## Smoke test

| Script | Purpose |
| --- | --- |
| `scripts/smoke-test.mjs` | Environment-agnostic smoke test (local, dev, prod) |

Checks: `/health`, `/ready`, `/config`, typed `404` problem body, CORS preflight
and response header (when `--origin` is given), and that the built UI bundle
embeds the API base URL (when `--web-url` is given). The last two are the
regression guards for the two reported bugs.

## Rerun commands

```bash
# unit suite (fast, no Docker)
pnpm exec nx run adhesion-api:test

# live integration suite (Docker required)
pnpm exec nx run adhesion-api:test:integration

# smoke test against a running stack
mise run local:smoke
node scripts/smoke-test.mjs --base-url https://<api> --origin https://<ui>
```

## Intentional gaps

- A live `503` readiness case is not in the integration suite: it is asserted at
  unit level by injecting a failing probe, because the shared containers are
  healthy for the whole run.
- No record-replay path: the outbound dependencies are all real local emulators,
  so cassettes would add no fidelity.
- The web app has no browser E2E; the bundle-embedding check in the smoke script
  covers the specific Next.js env-inlining regression.
- The Static Web App deploy build must provide `NEXT_PUBLIC_API_BASE_URL`
  (build-time only). Not yet wired: needs a stable API custom domain or a
  same-origin linked backend. The smoke script fails loudly if a deployed UI was
  built without it.
