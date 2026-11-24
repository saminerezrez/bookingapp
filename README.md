# Bookingapp

A fullstack booking app built and operated for the *Backend & DevOps* examination. Visitors pick a day,
see the free time slots and book one. The app runs on our own VPS on k3s, and every merge to `main` is
tested, built and deployed automatically.

| | Address |
|---|---|
| **App** | https://bokatid.xyz |
| **API** | https://api.bokatid.xyz (try https://api.bokatid.xyz/version) |
| **CDN** (static files) | https://cdn.bokatid.xyz, which serves the JS, CSS and images the app loads, e.g. https://cdn.bokatid.xyz/favicon.svg |
| **Dashboard** (Grafana) | https://grafana.bokatid.xyz (login required, dashboard **Bookingapp**) |

> **Scope: G.** Every G requirement is implemented and running. The VG parts (two or more API
> instances, zero-downtime deploys, autoscaling) were planned in [ARCHITECTURE.md](ARCHITECTURE.md)
> but are **not** implemented. The API runs as one pod.

**Documents:** [ROADMAP.md](ROADMAP.md) (tasks and status) · [ARCHITECTURE.md](ARCHITECTURE.md)
(design and decisions) · [docs/RUNBOOK.md](docs/RUNBOOK.md) (what to do when something breaks)

## Start

Run the app (Docker Desktop must be running):

```bash
docker compose up -d --build
```

Open http://localhost:8080 and book a slot.

Run the tests while the app is up (needs [Bun](https://bun.com)):

```bash
cd backend
bun install
bun test
```

Stop the app, from the repo root:

```bash
docker compose down
```

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
                    ├── bokatid.xyz         ─► web (nginx): the page, index.html
                    ├── cdn.bokatid.xyz     ─► web (nginx): static files only (JS, CSS, images)
                    ├── api.bokatid.xyz     ─► api Service ─► api pod ─► Postgres
                    └── grafana.bokatid.xyz ─► Grafana ◄── Prometheus (metrics) + Loki (logs)

CronJob (daily 03:00) ─► pg_dump ─► private S3 bucket (off the VPS)
```

- **One VPS, one k3s node.** Traefik terminates TLS and routes each hostname to its Service.
- **Page on the root domain, files on `cdn.`:** the browser loads `index.html` from `bokatid.xyz`, and
  every JS, CSS and image file from `cdn.bokatid.xyz`. Vite builds the app with `base` set to the `cdn.` URL.
- **Double bookings are impossible:** the API inserts directly, and a `unique (date, start_time)`
  constraint in Postgres picks exactly one winner, even if requests race.
- **Safe deploys:** the database migration runs as a Job before the rollout. If it fails, the deploy
  stops and the old version keeps serving. A readiness probe on `/health/ready` keeps traffic away from
  a pod until it can reach the database.

Full design, diagrams and the reasoning behind each choice: [ARCHITECTURE.md](ARCHITECTURE.md).

## Tech stack

| Area | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, served by nginx |
| Backend | Bun, Fastify 5, TypeScript |
| Database | PostgreSQL 16, migrations with dbmate |
| Platform | k3s on one VPS, Traefik ingress, cert-manager + Let's Encrypt |
| CI/CD | GitHub Actions, images in GitHub Container Registry (GHCR), tagged with the git SHA |
| Tests | `bun test` (unit + integration), Playwright (e2e) |
| Observability | kube-prometheus-stack (Prometheus, Grafana), Loki + Alloy for logs, prom-client in the API |
| Backups | Kubernetes CronJob, `pg_dump` to AWS S3 |

## Repository layout

```
.
├── README.md                # this file
├── ROADMAP.md               # task list with status
├── ARCHITECTURE.md          # design, API contract, decisions
├── docker-compose.yml       # local Postgres, or the full stack (also used by e2e)
├── backend/                 # Bun + Fastify API, dbmate migrations, unit/integration tests
├── frontend/                # React + Vite app, nginx config, Dockerfile
├── e2e/                     # Playwright end-to-end test
├── performance/             # plan for the VG load tests (not implemented)
├── deploy/                  # deploy.sh + Kubernetes manifests for the app (Kustomize)
├── cluster/                 # VPS setup, cert-manager, Helm values, Grafana dashboard
├── docs/RUNBOOK.md          # incident procedures
└── .github/workflows/       # CI/CD pipeline
```

Most folders have their own README with details.

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
cp .env.example .env
bun install                        # also installs dbmate (npm package), so no separate install
bunx dbmate --no-dump-schema up    # applies db/migrations, using DATABASE_URL from .env
bun --watch src/index.ts           # http://localhost:3000, restarts on change
```

Check it's up: `curl http://localhost:3000/health/ready` should return `{"status":"ok",...}`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env          # set VITE_API_URL=http://localhost:3000
npm ci
npm run dev                   # http://localhost:5173
```

### Full stack in containers

Runs Postgres, the API and the frontend behind nginx, built from the same Dockerfiles as production:

```bash
docker compose up -d --build
```

The app is then at http://localhost:8080 and the API at http://localhost:3000. Compose sets
`CORS_ORIGIN=http://localhost:8080` for the API.

The `web` image here is **not** byte-identical to production: `VITE_API_URL` and `VITE_BASE_URL` are
baked in at build time, so compose builds it with `http://localhost:3000` and the pipeline with
`https://api.bokatid.xyz` and `https://cdn.bokatid.xyz/`.

## Configuration

All variables are listed with dummy values in each package's `.env.example`. Real values are never
committed. In production they come from Kubernetes Secrets ([deploy/k8s/README.md](deploy/k8s/README.md)).

**Backend** (runtime)

| Variable | Example | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the API listens on |
| `HOST` | `0.0.0.0` | Interface to bind. Must be `0.0.0.0` in containers |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/bookingapp?sslmode=disable` | Postgres connection, used by the API and dbmate |
| `CORS_ORIGIN` | `http://localhost:5173` | The one origin allowed to call the API. One value per environment: `http://localhost:5173` (Vite dev), `http://localhost:8080` (compose, e2e), `https://bokatid.xyz` (production) |
| `LOG_LEVEL` | `info` | pino log level |
| `APP_VERSION` | `dev` | Git SHA, baked into the image at build time and returned by `/version` |

**Frontend** (build time)

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the API (`https://api.bokatid.xyz` in production) |
| `VITE_BASE_URL` | `/` | Where the built files are loaded from (`https://cdn.bokatid.xyz/` in production) |

## API

Base URL `https://api.bokatid.xyz`. JSON in and out. Errors always look like
`{ "error": { "code": "SLOT_TAKEN", "message": "..." } }`.

| Method & path | Description | Responses |
|---|---|---|
| `GET /available-slots?date=YYYY-MM-DD` | The day's slots and whether each is free | `200`, `400` |
| `POST /bookings` | Book a slot. Body: `{ "name", "date", "startTime" }` | `201`, `400`, `409 SLOT_TAKEN` |
| `GET /bookings` | Booked slots (without names) | `200` |
| `GET /health/ready` | Ready to serve traffic (database reachable) | `200`, `503` |
| `GET /version` | Git SHA of the running build | `200` |
| `GET /metrics` | Prometheus metrics | `200` |

Example (use a weekday within the next 30 days):

```bash
curl -X POST https://api.bokatid.xyz/bookings \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","date":"YYYY-MM-DD","startTime":"10:00"}'
```

The full contract with response bodies is in [ARCHITECTURE.md §4](ARCHITECTURE.md#4-api-contract).

## Tests

| Level | What it covers | Command | Runs in CI |
|---|---|---|---|
| Unit | Slot rules (`backend/src/domain/slots.test.ts`) | `cd backend && bun test` | PR + `main` |
| Integration | Every endpoint against a real Postgres, including **10 concurrent bookings of one slot → exactly one succeeds** (`backend/src/app.test.ts`, `backend/src/bookings.test.ts`) | `cd backend && bun test` | PR + `main` |
| E2E | Pick a date, book a slot, and the slot shows as taken, in a real browser against the full stack (`e2e/tests/booking.spec.js`) | `cd e2e && npm test` | PR + `main` |
| Smoke | `/version` returns the deployed SHA, and the frontend returns HTML | runs in the pipeline after each deploy | `main` |

Integration tests need Postgres running (step 1 above) and use their own database, `bookingapp_test`.
The tests run `dbmate up` against it first, which creates the database if it's missing and applies the
migrations. They truncate tables between runs and never touch production.

E2E needs the full stack running:

```bash
docker compose up -d --build              # from the repo root
cd e2e
npm ci
npx playwright install --with-deps chromium
npm test                                  # BASE_URL defaults to http://localhost:8080
npx playwright show-report                # open the last report
```

## CI/CD

One workflow, [`.github/workflows/pipeline.yml`](.github/workflows/pipeline.yml), with three jobs:

- **Every pull request:** `test` (lint, typecheck, unit and integration tests) and `e2e` (the full stack
  in Docker, then Playwright). Every PR is reviewed by the other team member before it's merged.
- **Every merge to `main`:** the same two jobs, then `deploy`, which only starts if both are green:
  1. build the `api`, `web` and `migrate` images and push them to GHCR, tagged with the commit SHA
  2. copy the manifests to the VPS over SSH and run [`deploy/deploy.sh`](deploy/deploy.sh)
  3. run the database migration as a Kubernetes Job. **If it fails, the deploy stops** and the running
     version keeps serving
  4. roll out the new images and wait until all pods are ready
  5. smoke test the public addresses

The pipeline reaches the cluster over SSH, so the Kubernetes API is never exposed to the internet.
Only one deploy runs at a time.

**Rollback:** revert the commit and merge (normal path), or in an emergency
`kubectl -n bookingapp rollout undo deployment/api`.

## Deployment and infrastructure

Everything runs on one Hetzner VPS (4 vCPU, 8 GB RAM, Ubuntu 24.04) with k3s.

| What | Where | Details |
|---|---|---|
| VPS setup, k3s, cert-manager, monitoring stack | Installed once by hand, reproducible from the repo | [cluster/README.md](cluster/README.md) |
| App manifests (api, web, Postgres, migration Job, backup CronJob, Ingresses, ServiceMonitor) | Applied by the pipeline | [deploy/k8s/README.md](deploy/k8s/README.md) |
| Secrets (database, S3, Grafana) | Created by hand on the cluster, never committed | [deploy/k8s/README.md](deploy/k8s/README.md#secrets) |

**Server access:** SSH with keys only, root login off, and the firewall only opens ports 22, 80 and 443.

**DNS:** A records for `bokatid.xyz`, `api.`, `cdn.` and `grafana.` all point to the VPS.

**HTTPS:** cert-manager gets a Let's Encrypt certificate for every Ingress (HTTP-01 check through
Traefik) and renews it automatically 30 days before it expires. HTTP redirects to HTTPS.

**Caching:** `index.html` is served with `no-cache`, so a deploy is picked up on the next page load.
Files under `/assets/` have content hashes in their names and are cached for a year (`immutable`).
`cdn.` serves only files (`index.html` returns 404 there) and sends a CORS header for `bokatid.xyz`.

## Monitoring and logs

**Dashboard:** https://grafana.bokatid.xyz (login required). The committed dashboard
[`cluster/grafana/bookingapp.json`](cluster/grafana/bookingapp.json) shows:

- request rate per route
- error rate (5xx)
- p95 latency
- number of ready API pods
- live API logs

kube-prometheus-stack's built-in dashboards cover CPU, memory and disk per pod and node.

- **Metrics:** the API exposes `/metrics` (prom-client histogram `http_request_duration_seconds`), and
  Prometheus scrapes it every 15 seconds through a ServiceMonitor.
- **Logs:** every pod logs JSON to stdout. Alloy ships the logs from namespace `bookingapp` to Loki,
  where you can search them in Grafana under Explore → Loki, for example
  `{namespace="bookingapp", app="api"} |= "bookings"`. Booker names are never logged.

Install steps and values: [cluster/README.md §4](cluster/README.md#4-monitoring-g14).

## Backups and restore

- **What:** CronJob `postgres-daily-backup` ([deploy/k8s/backup-cronjob.yaml](deploy/k8s/backup-cronjob.yaml))
  makes a full `pg_dump -Fc` every day at 03:00 (Europe/Stockholm) and checks the file with `pg_restore -l`.
- **Where:** uploaded to a private AWS S3 bucket in eu-north-1 (Stockholm), outside the VPS, as
  `postgres/bookingapp-<UTC timestamp>.dump`.
- **Failure handling:** both steps run with `sh -e` and stop on the first error, so a failed dump or
  upload shows up as a failed Job (`kubectl -n bookingapp get jobs`) instead of looking like a success.
- **Run one now:** `kubectl -n bookingapp create job --from=cronjob/postgres-daily-backup backup-manual`
- **Restore:** step by step in [docs/RUNBOOK.md](docs/RUNBOOK.md#4-restore-from-backup). A restore into a
  scratch database has been tested.

## When something goes wrong

[docs/RUNBOOK.md](docs/RUNBOOK.md) has a procedure for each of these:

1. a deploy made things worse → roll back
2. a pod is crash-looping
3. the database is down
4. restoring from backup

## Exam requirements

| Requirement | How it's met | Task |
|---|---|---|
| API at `api.bokatid.xyz` over HTTPS | Traefik + cert-manager | G6, G8 |
| Static files over `cdn.bokatid.xyz` | nginx serves the built JS, CSS and images on `cdn.` | G7, G8 |
| Every merge to `main` tested, built and deployed | `pipeline.yml` | G9 |
| Unit, integration and e2e tests in the pipeline | `bun test`, Playwright | G5, G10, G11, G13 |
| Daily database backups | CronJob → S3, restore tested | G15 |
| Metrics and logging | Prometheus, Loki, Grafana | G14 |
| VG requirements | Not implemented (scope is G) | – |

## Team

- Kiril Bogza
- Sofie

Both of us can explain every part of the system. See [ROADMAP.md](ROADMAP.md#rules).
