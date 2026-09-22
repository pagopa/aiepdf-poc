# CED Adhesion pilot — runbook and support readiness

> `TASK-11`. Scope: operating the **pilot** only (signed-agreement upload, `UC-01`).
> Back-office review, notifications, production launch readiness, DPIA, and SLOs
> are out of scope and remain open (`open.item-007`, `open.item-008`,
> `open.item-009`, NFR-02).

## 1. What runs

| Component | Azure resource | Purpose |
| --- | --- | --- |
| Adhesion API | Container App `dx-d-itn-aiepdf-adhesion-ca-01` (RG `dx-d-itn-aiepdf-rg-01`) | Upload and status endpoints |
| Upload UI | Static Web App `dx-d-itn-aiepdf-adhesion-web-stapp-01` | Next.js form and confirmation |
| Practice registry | PostgreSQL Flexible Server | Practices and Documents |
| Agreement storage | Storage Account, private `agreements` container | Confidential CAdES blobs |
| Settings and flags | App Configuration `dx-d-itn-aiepdf-adhesion-appcs-01` | Pilot settings + feature flags |
| Telemetry | Application Insights (core) | Logs, metrics, traces |

Resource names are produced by Terraform; confirm them with
`terraform output` in `infra/resources/dev` before any manual action.

## 2. Endpoints

| Method | Path | Meaning |
| --- | --- | --- |
| `POST` | `/practices/{onboardingId}/agreements` | Upload a CAdES `.p7m` (max 10 MB) |
| `GET` | `/practices/{onboardingId}` | Read practice status |
| `GET` | `/config` | `{ uploadEnabled, maxUploadMb }` |
| `GET` | `/health` | Liveness probe (process up) |
| `GET` | `/ready` | Readiness probe (practice registry + agreement storage reachable) |

`POST` returns `201 { documentId, status: "PENDING", signingStep: 1 }` on success.

## 3. Normal operations

**Disable uploads (kill switch).** Set the `adhesion.upload.enabled` feature flag
to `false` in App Configuration. The API returns `503 UPLOAD_DISABLED` and the UI
hides the form via `/config`. No redeploy; the setting hot-reloads.

**Change the size limit.** Set `adhesion:upload:maxSizeMb` in App Configuration.
The API and the UI pick it up on refresh (sentinel-driven).

**Change settings safely.** Bump the `Sentinel` value whenever other keys change
to trigger a refresh; keep settings backward-compatible with the running version.

**CORS.** The UI is served from the Static Web App and calls the API from the
browser, so the API allows that origin via `CORS_ALLOWED_ORIGINS` (set by
Terraform from the Static Web App default hostname). If the UI shows an
unexpected error while the API is healthy, check the browser console for a CORS
failure before looking at the API logs.

**Smoke test.** After a deploy, run the environment smoke test against the API:

```bash
node scripts/smoke-test.mjs \
  --base-url https://<api-host> \
  --origin https://<ui-host> \
  --web-url https://<ui-host>
```

It checks `/health`, `/ready`, `/config`, the typed `404`, the CORS headers and
that the UI bundle embeds the API URL. In CI it runs from `_smoke-dev.yaml`
(needs the `SMOKE_API_BASE_URL`, `SMOKE_UI_ORIGIN` and `SMOKE_WEB_URL` variables).

**Deploy.** Merge to `main`. Infrastructure: `_release-terraform-apply-dev-resources.yaml`.
API: `_release-container-app-api-dev.yaml`. UI: `_release-static-web-app-dev.yaml`.
Settings: `_release-appconfig-dev.yaml`.

**Canary rollout.** The API Container App runs in Multiple revision mode, so the
release workflow shifts traffic gradually and calls `canary-monitor.sh` (repo
root) at each step. The script smoke-tests the new revision through its revision
FQDN (`/health`, `/ready`, typed 404) before it takes traffic; a failed probe
reverts all traffic to the previous revision and the workflow fails. Tunables:
`CANARY_STEP_PERCENTAGE`, `CANARY_STEP_WAIT_MS`, `CANARY_PROBE_TIMEOUT`.

**Observe a rollout.** The workflow writes a canary chart to the GitHub Actions
step summary. The new revision is only marked healthy once `/ready` returns
`200`, which requires PostgreSQL and Blob Storage to be reachable.

**Migrations** run automatically at API startup (idempotent, advisory-locked), so
a new replica cannot double-apply them.

## 4. Failure modes

All business failures are RFC 9457 `application/problem+json` with a stable
`errorCode`. `detail` never contains PII.

| `errorCode` | HTTP | Meaning | First response |
| --- | --- | --- | --- |
| `AGREEMENT_EXTENSION_INVALID` | 400 | File is not `.p7m` | Ask the entity to re-export the signature as CAdES |
| `AGREEMENT_SIGNATURE_INVALID` | 400 | Not valid CAdES / malformed | Ask the entity to re-sign; if systemic, check the verifier adapter |
| `AGREEMENT_FILE_TOO_LARGE` | 400 | Over the configured limit | Confirm `adhesion:upload:maxSizeMb`; ask for a smaller file |
| `PRACTICE_STATE_INVALID` | 409 | Not in `REQUEST`, or step 1 exists | Expected for duplicates; otherwise check the practice state |
| `PRACTICE_NOT_FOUND` | 404 | No such practice | The practice precondition is out of pilot scope; verify the `onboardingId` |
| `UPLOAD_DISABLED` | 503 | Kill switch on | Re-enable `adhesion.upload.enabled` if intended |

Unexpected `5xx`:

1. Check the Container App revision logs in Application Insights.
2. Common causes: database unreachable (private endpoint/DNS), missing Key Vault
   secret access, migration failure at startup, blob storage RBAC.
3. Roll back by redeploying the previous revision (Container Apps keeps revisions).

## 5. Observability

- Traces, logs and metrics flow to Application Insights via
  `@pagopa/azure-tracing` (NFR-07).
- Watch the **5xx rate on the upload route**; an alert on the 5xx upload rate is
  required by NFR-07 and is **not yet configured** — treat as a launch blocker.
- Logs must never contain document content, names, or other PII (NFR-04). Report
  any suspected PII in logs as a security incident.

## 6. Data handling

- Agreement blobs are confidential; stored in a private container, encrypted in
  transit and at rest, accessed with the Container App Managed Identity.
- Classification and retention are **not frozen** (`open.item-007`): do not
  implement deletion; no document may be purged without a recorded decision.
- Deleting a pilot upload is a manual, audited operation performed by the team
  that owns the storage account.

## 7. Known gaps (block production, not the pilot)

- No SLO, RPO/RTO, or load-test evidence (NFR-01/02/03/06).
- No privacy review, DPIA, or retention decision (`open.item-007`).
- No accessibility audit and no Figma/Service Blueprint (`open.item-012`, NFR-08).
- No tracking/analytics taxonomy (`open.item-008`).
- No on-call rota; owners are `Product IO` and `Engineering IO App` (TBD).
- `PRACTICE_NOT_FOUND` and `UPLOAD_DISABLED` are pilot transport extensions to
  be confirmed with Product.
