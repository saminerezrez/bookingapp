# deploy/k8s

Kubernetes manifests for the app, in namespace `bookingapp`. Plain YAML plus Kustomize. The pipeline
sets the image tags to the commit SHA and applies them. Design: [ARCHITECTURE.md §6](../../ARCHITECTURE.md#6-runtime-platform-k3s).

## Planned files

| File | Contents | Task |
|---|---|---|
| `kustomization.yaml` | Lists every manifest below. The pipeline runs `kustomize edit set image` with the SHA | G8 |
| `namespace.yaml` | Namespace `bookingapp` | G8 |
| `postgres.yaml` | StatefulSet `postgres` (1 replica, 5Gi PVC on `local-path`) + headless Service | G8 |
| `api.yaml` | Deployment + Service `api` (port 3000), readiness probe on `/health/ready` | G8 |
| `web.yaml` | Deployment + Service `web` (nginx, 2 replicas) | G8 |
| `ingress.yaml` | Ingresses: `cdn.<domain>` + `<domain>` → web, `api.<domain>` → api, TLS via cert-manager | G8 |
| `migrate-job.yaml` | Template for Job `migrate-<sha>` (`dbmate --wait up`, `backoffLimit: 0`). **Not** in `kustomization.yaml`: the pipeline creates it per deploy, before the rollout | G8 |
| `backup-cronjob.yaml` | CronJob `db-backup`: daily 03:00 Europe/Stockholm, `pg_dump -Fc` → S3, `set -euo pipefail` | G15 |
| `hpa.yaml` | HPA `api`: min 2, max 6, 60% CPU | VG2 |

**Labels:** every pod gets `app: <name>` (`app: api`, `app: web`, `app: postgres`). The runbook relies on
them, e.g. `kubectl -n bookingapp logs -l app=api --prefix` for logs from all API pods.

VG1 changes `api.yaml` (2 replicas, `maxUnavailable: 0`, `preStop` sleep, grace period), and VG2 adds
resource requests/limits.

The Grafana Ingress and cert-manager's ClusterIssuers belong to the cluster setup, not the app. They
live in [`cluster/`](../../cluster/).

## Applying by hand

Normally the pipeline does this. To apply by hand (first setup in G8, or debugging):

```bash
kubectl apply -k deploy/k8s
kubectl -n bookingapp rollout status deployment/api
```

## Secrets

Secrets are created by hand on the cluster and **never committed**. Replace every `<...>` and run once:

```bash
# Postgres superuser password (used by the StatefulSet)
kubectl -n bookingapp create secret generic postgres \
  --from-literal=POSTGRES_PASSWORD='<strong password>'

# API + migration Job database connection
kubectl -n bookingapp create secret generic api \
  --from-literal=DATABASE_URL='postgres://postgres:<password>@postgres:5432/bookingapp?sslmode=disable'

# Backup CronJob: S3 bucket and write-only credentials for that bucket
kubectl -n bookingapp create secret generic backup-s3 \
  --from-literal=AWS_ACCESS_KEY_ID='<key id>' \
  --from-literal=AWS_SECRET_ACCESS_KEY='<secret>' \
  --from-literal=S3_BUCKET='<bucket>' \
  --from-literal=S3_ENDPOINT='<https://s3 endpoint>'

# Pull images from GHCR: classic PAT with only read:packages, expiry after grading
kubectl -n bookingapp create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username='<github user>' \
  --docker-password='<PAT>'
kubectl -n bookingapp patch serviceaccount default \
  -p '{"imagePullSecrets":[{"name":"ghcr-pull"}]}'
```

To rotate a secret, delete it, create it again, then restart what uses it
(`kubectl -n bookingapp rollout restart deployment/api`).
