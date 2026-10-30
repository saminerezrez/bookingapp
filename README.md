# Bookingapp

A fullstack booking app built and operated for the *Backend & DevOps* examination. Visitors pick a day,
see the free time slots and book one. The app runs on our own VPS on k3s, and every merge to `main` is
tested, built and deployed automatically.

| | Address |
|---|---|
| **App** | https://cdn.&lt;domain&gt; (https://&lt;domain&gt; redirects here) |
| **API** | https://api.&lt;domain&gt; |
| **CDN** (static files) | https://cdn.&lt;domain&gt; |
| **Dashboard** (Grafana) | https://grafana.&lt;domain&gt; |

> **Status: v1, work in progress.** This README describes the target system. Commands marked with a task
> ID (e.g. *G5*) become available when that task in [ROADMAP.md](ROADMAP.md) is done. `<domain>` is
> replaced once the domain is bought (G3).

**Documents:** [ROADMAP.md](ROADMAP.md) (tasks and status) · [ARCHITECTURE.md](ARCHITECTURE.md)
(design and decisions) · [docs/RUNBOOK.md](docs/RUNBOOK.md) (what to do when something breaks)

---

## Contents

1. [What the app does](#what-the-app-does)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Tech stack](#tech-stack)
4. [Repository layout](#repository-layout)
5. [Running locally](#running-locally)
6. [Configuration](#configuration)
7. [API](#api)
8. [Tests](#tests)
9. [CI/CD](#cicd)
10. [Deployment and infrastructure](#deployment-and-infrastructure)
11. [Monitoring and logs](#monitoring-and-logs)
12. [Backups and restore](#backups-and-restore)
13. [When something goes wrong](#when-something-goes-wrong)
14. [Exam requirements](#exam-requirements)
15. [Team](#team)

---

## What the app does

A booking system for a single resource, such as one room or one service provider.

1. Pick a date and see which time slots are free.
2. Book a slot by entering your name.

Bookings are final. There are no accounts and no cancelling.

| Rule | Value |
|---|---|
| Time zone | `Europe/Stockholm` |
| Bookable days | Monday–Friday |
| Opening hours | 09:00–17:00, 60-minute slots starting on the hour |
| Booking window | Today up to 30 days ahead, never in the past |
| Capacity | One booking per slot. Double bookings are blocked by the database |

## Architecture at a glance

```
Browser ──HTTPS──► Traefik (k3s ingress, Let's Encrypt TLS)
                    ├── cdn.<domain>     ─► web (nginx, built frontend)
                    ├── api.<domain>     ─► api Service ─► api pods (2–6, autoscaled) ─► Postgres
                    └── grafana.<domain> ─► Grafana ◄── Prometheus (metrics) + Loki (logs)

CronJob (daily) ─► pg_dump ─► S3 bucket (EU, off the VPS)
```

- **One VPS, one k3s node.** Traefik terminates TLS and load-balances across ready API pods.
- **Double bookings are impossible:** the API inserts directly, and a `unique (date, start_time)`
  constraint in Postgres picks exactly one winner, even with several pods racing.
- **Zero-downtime deploys:** rolling updates with readiness probes, a `preStop` pause and graceful
  shutdown. Migrations run before the rollout and are always backward compatible.
- **Autoscaling:** a HorizontalPodAutoscaler scales the API between 2 and 6 pods on CPU.

Full design, diagrams and the reasoning behind each choice: [ARCHITECTURE.md](ARCHITECTURE.md).

## Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, served by nginx |
| Backend | Bun, Fastify 5, TypeScript |
| Database | PostgreSQL 16, migrations with dbmate |
| Platform | k3s on one VPS, Traefik ingress, cert-manager + Let's Encrypt |
| CI/CD | GitHub Actions, images in GitHub Container Registry (GHCR), tagged with the git SHA |
| Tests | `bun test` (unit + integration), Playwright (e2e), k6 (load) |
| Observability | kube-prometheus-stack (Prometheus, Grafana), Loki + Alloy for logs |
| Backups | Kubernetes CronJob, `pg_dump` to an S3-compatible bucket |

## Repository layout

```
.
├── README.md                # this file
├── ROADMAP.md               # task list with status
├── ARCHITECTURE.md          # design, API contract, decisions
├── docker-compose.yml       # local Postgres (and full stack for e2e, from G7)
├── backend/                 # Bun + Fastify API, dbmate migrations, unit/integration tests
├── frontend/                # React + Vite app, nginx config, Dockerfile
├── e2e/                     # Playwright end-to-end tests
├── performance/             # k6 scripts for the VG demonstrations
├── deploy/k8s/              # Kubernetes manifests for the app (Kustomize)
├── cluster/                 # Helm values, Grafana dashboard, VPS setup notes
├── docs/RUNBOOK.md          # incident procedures
└── .github/workflows/       # CI/CD pipeline
```

Each folder without its own code yet has a README describing what goes there and which task adds it.

## Running locally

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.3 (backend)
- [Node.js](https://nodejs.org) ≥ 22 and npm (frontend, e2e)
- [Docker](https://docs.docker.com/get-docker/) with Compose (Postgres, full stack)

### 1. Start Postgres

```bash
docker compose up -d postgres
```

Postgres listens on `localhost:5432` (user `postgres`, password `postgres`, database `bookingapp`).
These credentials are for local development only.

### 2. Backend

```bash
cd backend
cp .env.example .env          # G5
bun install                   # also installs dbmate (npm package), so no separate install
bun run migrate               # applies db/migrations with dbmate (G5)
bun run dev                   # http://localhost:3000, restarts on change (G5)
```

Check it's up: `curl http://localhost:3000/health/ready` should return `{"status":"ok",...}`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env          # set VITE_API_URL=http://localhost:3000
npm ci
npm run dev                   # http://localhost:5173
```

### Full stack in containers (G7)

Runs Postgres, the API and the frontend behind nginx, built from the same Dockerfiles as production:

```bash
docker compose up -d --build
```

The app is then at http://localhost:8080 and the API at http://localhost:3000. Compose sets
`CORS_ORIGIN=http://localhost:8080` for the API.

The `web` image here is **not** byte-identical to production: `VITE_API_URL` is baked in at build time,
so compose builds it with `http://localhost:3000` and the pipeline with `https://api.<domain>`.

## Configuration

All variables are listed with dummy values in each package's `.env.example`. Real values are never
committed. In production they come from Kubernetes Secrets ([deploy/k8s/README.md](deploy/k8s/README.md)).

**Backend** (runtime)

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `HOST` | `0.0.0.0` | Interface to bind. Must be `0.0.0.0` in containers |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/bookingapp?sslmode=disable` | Postgres connection, used by the API and dbmate |
| `CORS_ORIGIN` | `http://localhost:5173` | The one origin allowed to call the API. One value per environment: `http://localhost:5173` (Vite dev), `http://localhost:8080` (compose, e2e), `https://cdn.<domain>` (production) |
| `LOG_LEVEL` | `info` | pino log level |
| `APP_VERSION` | `dev` | Git SHA, baked into the image at build time and returned by `/version` |

**Frontend** (build time)

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the API (`https://api.<domain>` in production) |

## API

Base URL `https://api.<domain>`. JSON in and out. Errors always look like
`{ "error": { "code": "SLOT_TAKEN", "message": "..." } }`.

| Method & path | Description | Responses |
|---|---|---|
| `GET /available-slots?date=YYYY-MM-DD` | The day's slots and whether each is free | `200`, `400` |
| `POST /bookings` | Book a slot. Body: `{ "name", "date", "startTime" }` | `201`, `400`, `409 SLOT_TAKEN` |
| `GET /bookings` | Booked slots (without names) | `200` |
| `GET /health/ready` | Ready to serve traffic (database reachable) | `200`, `503` |
| `GET /version` | Git SHA of the running build | `200` |
| `GET /metrics` | Prometheus metrics | `200` |

Example:

```bash
curl -X POST https://api.<domain>/bookings \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","date":"2026-11-02","startTime":"10:00"}'
```

The full contract with response bodies is in [ARCHITECTURE.md §4](ARCHITECTURE.md#4-api-contract).

## Tests

| Level | What it covers | Command | Runs in CI |
|---|---|---|---|
| Unit | Slot rules, validation, error mapping | `cd backend && bun run test:unit` (G5) | PR + `main` |
| Integration | Every endpoint against a real Postgres, including **10 concurrent bookings of one slot → exactly one succeeds** | `cd backend && bun run test:integration` (G5) | PR + `main` |
| E2E | Pick a date, book a slot, and the slot shows as taken, in a real browser against the full stack | `cd e2e && npm test` (G13) | PR + `main` |
| Smoke | `/version` returns the deployed SHA, and the frontend returns HTML | runs in the pipeline after each deploy | `main` |
| Load | Zero-downtime deploy and autoscaling demonstrations | see [performance/README.md](performance/README.md) | manual |

Integration tests need Postgres running (step 1 above) and use their own database, `bookingapp_test`.
Compose creates only `bookingapp`, so the test setup (G5) runs `dbmate up` against the test URL first.
`dbmate up` creates the database if it's missing and applies the migrations. The tests truncate tables
between runs and never touch production.

E2E needs the full stack running (G13):

```bash
docker compose up -d --build              # from the repo root
cd e2e
npm ci
npx playwright install --with-deps chromium
npm test                                  # BASE_URL defaults to http://localhost:8080
npx playwright show-report                # open the last report
```

## CI/CD

One workflow: [`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml) (G9).

- **Every pull request:** lint, typecheck, unit, integration and e2e tests. `main` is protected: a PR
  needs green checks and one approval before it can be merged.
- **Every merge to `main`:** the same tests, then:
  1. build the `api`, `web` and `migrate` images and push them to GHCR, tagged with the commit SHA
  2. run the database migration as a Kubernetes Job. **If it fails, the deploy stops** and the running
     version keeps serving.
  3. roll out the new images and wait until all pods are ready
  4. smoke test the public addresses

The pipeline reaches the cluster over SSH, so the Kubernetes API is never exposed to the internet.
Only one deploy runs at a time.

**Rollback:** revert the commit and merge (normal path), or in an emergency
`kubectl -n bookingapp rollout undo deployment/api`.

## Deployment and infrastructure

Everything runs on one VPS (≥ 4 vCPU, ≥ 8 GB RAM, Ubuntu 24.04) with k3s.

| What | Where | Details |
|---|---|---|
| VPS setup, k3s, cert-manager, monitoring stack | Installed once by hand, reproducible from the repo | [cluster/README.md](cluster/README.md) |
| App manifests (api, web, Postgres, migration Job, backup CronJob, Ingresses, HPA) | Applied by the pipeline | [deploy/k8s/README.md](deploy/k8s/README.md) |
| Secrets (database, S3, GHCR pull secret, Grafana) | Created by hand on the cluster, never committed | [deploy/k8s/README.md](deploy/k8s/README.md#secrets) |

**DNS:** A records for `<domain>`, `api.<domain>`, `cdn.<domain>` and `grafana.<domain>` all point to
the VPS. Certificates are issued and renewed automatically by cert-manager.

**Caching on the CDN host:** `index.html` is served with `no-cache`, so a deploy is picked up on the
next page load. Files under `/assets/` have content hashes in their names and are cached for a year
(`immutable`).

**Zero downtime and autoscaling (VG):**
- The API runs at least 2 replicas. Rollouts never take a pod away before its replacement is ready.
- On shutdown a pod stops receiving traffic, finishes in-flight requests, then exits.
- The HPA keeps CPU around 60% of each pod's request, scaling between 2 and 6 pods.
- Both are demonstrated with k6 under load ([performance/README.md](performance/README.md)).

## Monitoring and logs

**Dashboard:** https://grafana.&lt;domain&gt; (login required). The committed dashboard
[`cluster/grafana/`](cluster/grafana/) shows:

- request rate
- error rate (5xx)
- p95 latency
- number of API pods
- live logs

kube-prometheus-stack's built-in dashboards cover CPU, memory and disk per pod and node.

- **Metrics:** each API pod exposes `/metrics`, and Prometheus scrapes them.
- **Logs:** every pod logs JSON to stdout. Alloy ships the logs to Loki, where you can search them in
  Grafana by pod, level or request id. Booker names are never logged.

## Backups and restore

- **What:** a full `pg_dump` of the database every day at 03:00 (Europe/Stockholm).
- **Where:** a private S3-compatible bucket in an EU region, outside the VPS. Dumps are kept 14 days.
- **Failure handling:** the backup script stops on the first error, so a failed dump or upload shows up
  as a failed Job (`kubectl -n bookingapp get jobs`) instead of looking like a success.
- **Restore:** step by step in [docs/RUNBOOK.md](docs/RUNBOOK.md#4-restore-from-backup). The restore is
  tested into a scratch database in G15.

## When something goes wrong

[docs/RUNBOOK.md](docs/RUNBOOK.md) has a procedure for each of these:

1. a deploy made things worse → roll back
2. a pod is crash-looping
3. the database is down
4. restoring from backup

## Exam requirements

| Requirement | How it's met | Task |
|---|---|---|
| API at `api.<domain>` over HTTPS | Traefik + cert-manager | G6, G8 |
| Static files over `cdn.<domain>` | The frontend is served by nginx on `cdn.` | G7, G8 |
| Every merge to `main` tested, built and deployed | `pipeline.yml` | G9 |
| Unit, integration and e2e tests in the pipeline | `bun test`, Playwright | G5, G10, G11, G13 |
| Daily database backups | CronJob → S3, restore tested | G15 |
| Metrics and logging | Prometheus, Loki, Grafana | G14 |
| VG: ≥ 2 instances behind a load balancer | 2+ API pods behind Traefik | VG1 |
| VG: deploy without downtime | Rolling update, readiness, graceful shutdown | VG1, VG3 |
| VG: autoscaling, demonstrated | HPA on CPU, k6 ramp | VG2, VG3 |

## Team

- Kiril Bogza
- Sofie

Both of us can explain every part of the system. See [ROADMAP.md](ROADMAP.md#rules).
