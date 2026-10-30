# Roadmap

Target grade: **VG**. Design details: [ARCHITECTURE.md](ARCHITECTURE.md).
**Scope:** only what the G and VG requirements need. No features beyond that.

**Deadlines** (said by the teacher in class 28/10, written confirmation requested):
- **Wed 4/11, presentation:** only the **core flow** has to work: book a slot in the deployed app. VG
  doesn't have to be demonstrated live.
- **Sun 8/11, code submission:** everything else, VG included, is **graded from the code alone**.

**How to use this table**
- Follow the structure. **All G tasks come before VG tasks.** Within each group, tasks are in the order
  they need to happen.
- Don't start a task until everything in "Depends on" is ✅.
- One task = one PR. Mark it ✅ in the same PR that finishes it.
- Status: ⬜ todo · 🔄 in progress · ✅ done

## G tasks

| # | Date | Task | Depends on | Done when | Status |
|---|---|---|---|---|---|
| G1 | 28/10 | **Agree on the docs.** Both read and approve ROADMAP + ARCHITECTURE, then merge | – | PR merged with both approvals | ⬜ |
| G2 | 28/10 | **Decisions.** Confirm the booking rules (ARCH §1) and email the teacher the questions (below) | – | Rules confirmed in ARCH §1, email sent | ⬜ |
| G3 | 28/10 | **Buy infrastructure.** Domain, VPS (≥4 vCPU, ≥8 GB RAM, Ubuntu 24.04), S3 bucket (EU region, private, 14-day lifecycle rule). DNS A records for `<domain>`, `api.`, `cdn.`, `grafana.` → VPS IP | – | `dig api.<domain>` returns the VPS IP, and the bucket exists | ⬜ |
| G4 | 29/10 | **Merge the backend.** Fold the `unique (date, start_time)` constraint and the name check into the first migration (ARCH §5), then merge `feature/booking-database` | G1 | On `main`, `dbmate up` creates the table, and inserting the same slot twice fails | ✅ |
| G5 | 29/10 | **Backend base.** Split `app.ts`/`index.ts`, listen on `0.0.0.0`, `config.ts` + `backend/.env.example`, shared error format, `GET /health/ready`, `GET /version`, `bun test` set up. 15-min check that the metrics library works on Bun | G4 | One unit and one integration test (`app.inject`) pass locally; `/metrics` responds locally | ⬜ |
| G6 | 29/10 | **VPS + k3s.** SSH keys only, firewall (22/80/443), k3s, cert-manager (staging issuer → production), namespace `bookingapp` | G3 | A test Ingress on `api.<domain>` serves a valid Let's Encrypt certificate | ⬜ |
| G7 | 29/10 | **Docker images.** Backend Dockerfile (non-root, `APP_VERSION`). Frontend Dockerfile + `nginx.conf`: serves the app on `cdn.`, `index.html` `no-cache`, `/assets/` `immutable`, `<domain>` → 301 to `cdn.` | G5 | `docker compose up` runs the full stack locally, and an asset returns `immutable` | ⬜ |
| G8 | 30/10 | **k8s manifests.** Postgres StatefulSet + Secrets, `ghcr-pull` pull secret (PAT `read:packages` only, expires after grading), api + web Deployments/Services, **readiness probe** on `/health/ready`, Ingresses for `cdn.`/`<domain>` and `api.`, migration Job | G6, G7 | `kubectl apply` by hand → the app works at `https://cdn.<domain>` and `https://<domain>` redirects there; `SHOW max_connections` checked | ⬜ |
| G9 | 30/10 | **Pipeline.** One workflow, `pipeline.yml`. PR: lint, typecheck, unit, integration. `main`: the same tests, then push images to GHCR (SHA tag) → migration Job (failure stops the deploy) → apply → `rollout status` → smoke test (`/version` SHA + frontend HTML). Branch protection on `main` | G8 | A merge changes the SHA at `https://api.<domain>/version` with no manual steps, and a failing PR can't be merged ✨ *walking skeleton* | ⬜ |
| G10 | 30–31/10 | **API: slots + create booking.** Slot rules module, `GET /available-slots?date=`, `POST /bookings` with schema validation and `409` on a taken slot | G5 | Unit tests for weekend, hours, on-the-hour, past and 30-day window pass. Integration test: 10 concurrent POSTs for one slot → exactly one `201` | ⬜ |
| G11 | 31/10 | **API: list + CORS.** `GET /bookings` without names, CORS allows only `https://cdn.<domain>` | G10 | Integration test: the response has no `name` field, and the CORS header is present only for the allowed origin | ⬜ |
| G12 | 31/10 | **Frontend.** API client, pick a date → see free slots, book with a name, loading and error states (clear message on `409`) | G11 | The whole flow works in a browser against the local stack | ⬜ |
| G13 | 1/11 | **E2E test.** Playwright against the compose stack: pick a date, book a slot, and the slot shows as taken. Runs in the pipeline on PRs and `main` | G9, G12 | E2E runs green in a PR and in a deploy | ⬜ |
| G14 | 1/11 | **Monitoring + dashboard.** kube-prometheus-stack (trimmed) + Loki + Alloy via Helm (values in `cluster/`), Grafana at `https://grafana.<domain>` behind a login, `/metrics` in the API, dashboard JSON in `cluster/grafana/` with 5 panels: request rate, errors, p95, replica count, logs | G9 | The dashboard shows live traffic from the production API, and API logs are searchable | ⬜ |
| G15 | 1/11 | **Backups + operations docs.** Daily CronJob: `pg_dump` → S3 with `set -euo pipefail`. **One restore test** into a scratch DB. `docs/RUNBOOK.md` (bad deploy, crash loop, DB down, restore). README with app/api/cdn/dashboard URLs | G9, G14 | A dump is in the bucket, the restored row count matches, and every README URL works | ⬜ |

**✅ All G requirements met: Sun 1/11.**

## VG tasks

| # | Date | Task | Depends on | Done when | Status |
|---|---|---|---|---|---|
| VG1 | 2/11 | **Two instances, zero downtime.** `replicas: 2`, rolling update `maxUnavailable: 0`, `preStop` sleep action, graceful SIGTERM shutdown (readiness → `503`, finish in-flight requests, close the DB pool) | G9 | `kubectl get pods` shows 2 api pods, and logs show requests served by both | ⬜ |
| VG2 | 2/11 | **Autoscaling.** CPU/memory requests + limits (`100m` CPU request), HPA min 2 / max 6 / 60% CPU | VG1 | `kubectl get hpa` shows a current CPU %, not `<unknown>` | ⬜ |
| VG3 | 2/11 | **Load tests (together).** k6 `performance/steady.js` (threshold `http_req_failed == 0`) and `performance/ramp.js` (mostly `GET /available-slots`), run from a laptop. Steady load during a real merge-to-deploy, then the ramp. If the HPA doesn't scale, lower the target and run again. Write the results into `performance/README.md`, since VG is graded from the repo. Optional: link a short screen recording of each run from there | VG2 | 0 failed requests during the deploy, replicas go 2 → N → 2, no pods `Pending`, results committed | ⬜ |

**✅ All VG requirements met: Mon 2/11.** If it slips, VG can still land before the code submission (5–7/11).

## Defense and submission

| # | Date | Task | Depends on | Done when | Status |
|---|---|---|---|---|---|
| D1 | 3/11 | **Full rehearsal.** Demo the core flow on the deployed app. Each of us explains the *other's* parts: request → DB, merge → deploy, tests, technical choices, backups/restore, what we do when things break, and how VG works. **Freeze at 18:00** | G9, G12 | Booking works on the deployed app, and both of us can answer every point in the exam checklist below | ⬜ |
| D2 | 4/11 | **Presentation** | D1 | – | ⬜ |
| D3 | 5–8/11 | **Final fixes + submission.** Fix what came up at the presentation, finish anything left (VG included), check the README URLs, submit the repo link | D2 | Submitted by Sun 8/11 | ⬜ |

---

## Rules

- **G before VG.** If we fall behind, the next G task always wins over any VG task.
- **Only G/VG scope.** Anything that doesn't serve a requirement in the exam checklist doesn't get built.
  The frontend stays plain and functional.
- **Everyone can explain everything.** Grading is individual. Every PR is reviewed by the other person.
  We pair on G6, G9, G15 and VG3, because they're the hardest to learn from reading a diff.
- **`main` is always deployable.** CI must be green to merge.

## Exam checklist

| Requirement | How we meet it | Evidence (presentation or repo) | Tasks |
|---|---|---|---|
| G: API at `api.<domain>` over HTTPS | Traefik + cert-manager | Browser padlock, `curl -v` | G6, G8 |
| G: Static files at `cdn.<domain>` | The whole frontend served by nginx on `cdn.` | DevTools: page and assets from `cdn.`, assets `immutable` | G7, G8 |
| G: Every merge to `main` tested, built, deployed | `pipeline.yml` | Live merge, then watch the Actions run | G9 |
| G: Unit + integration + e2e tests in the pipeline | bun test, Playwright | Actions logs, test files | G5, G10, G11, G13 |
| G: Daily DB backups | CronJob → S3 | Bucket listing, restore test | G15 |
| G: Metrics + logging | Prometheus, Loki, Grafana | Dashboard at `grafana.<domain>` | G14 |
| VG: ≥2 instances behind a load balancer | 2 replicas + Traefik | `kubectl get pods`, logs from both pods | VG1 |
| VG: Zero-downtime deploy | Rolling update + readiness + preStop + graceful shutdown | k6 results in `performance/README.md`: 0 failed requests during a deploy | VG1, VG3 |
| VG: Autoscaling, shown | HPA on CPU | `hpa.yaml` + k6 ramp results in `performance/README.md` | VG2, VG3 |

## Risks

| Risk | Mitigation |
|---|---|
| DNS / Let's Encrypt delays or rate limits | Buy the domain on day 1 (G3). Use the staging issuer until everything works |
| VPS too small for k3s + monitoring | ≥8 GB RAM. Trimmed kube-prometheus-stack (no Alertmanager, short retention) |
| Metrics library doesn't work on Bun | Checked early in G5. Fallback: plain `prom-client` |
| HPA doesn't scale under our load | Low CPU request, ramp on the heaviest endpoint, k6 from a laptop, fallback: a lower target. Buffer until 7/11 |
| Only one of us understands a part | Cross-reviews, pairing, full rehearsal on 3/11 |
| Core flow breaks right before the presentation | Freeze 3/11 18:00, rollback commands ready |

## Open decisions

- [ ] Domain name → replace `<domain>` in the docs (G3)
- [ ] VPS provider. 8 GB, or 4 GB if the teacher allows external Grafana (G3)
- [ ] S3 provider: AWS S3 / Backblaze B2 / Cloudflare R2 (G3)
- [ ] Booking rules: Mon–Fri 09–17, 60 min, 30 days ahead, or changed (G2)
- [ ] Teacher's answers (G2). Draft:
  > "Fyra frågor om VG/driften: (1) Räcker k3s på en enda VPS-nod med 2+ pods bakom load balancern
  > för VG, eller förväntas flera noder? (2) Får metrics/logging ligga hos en extern tjänst som
  > Grafana Cloud, eller ska även det köras på vår VPS? (3) Räcker det att hela frontenden
  > (inklusive index.html) servas från cdn.<domän>, med <domän> som redirect dit? (4) För att vara
  > säkra: på redovisningen 4/11 räcker det att kärnflödet fungerar, och VG (autoscaling och deploy
  > utan downtime) bedöms utifrån koden vid inlämningen 8/11, utan att visas live under load. Stämmer det?"

## Starting point (28/10)

- `main`: frontend scaffold (Vite + React + TS) and a booking form that isn't connected to anything.
- `feature/booking-database` (not merged): Bun + Fastify backend, first migration, `GET /bookings`,
  compose Postgres. Merged in G4.
