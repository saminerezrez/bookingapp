# deploy/k8s

Kubernetes manifests for the app, in namespace `bookingapp`. Plain YAML plus Kustomize. The pipeline
sets the image tags to the commit SHA and applies them. Design: [ARCHITECTURE.md §6](../../ARCHITECTURE.md#6-runtime-platform-k3s).

## Files

| File | Contents | Task |
|---|---|---|
| `kustomization.yaml` | Lists every manifest below. The pipeline replaces `newTag: dev` with the commit SHA | G8 |
| `namespace.yaml` | Namespace `bookingapp` | G8 |
| `postgres.yaml` | StatefulSet `postgres` (1 replica, 5Gi PVC on `local-path`) + headless Service | G8 |
| `api.yaml` | Deployment + Service `api` (1 replica, port 3000), readiness probe on `/health/ready`, `CORS_ORIGIN=https://bokatid.xyz` | G8 |
| `web.yaml` | Deployment + Service `web` (nginx, 2 replicas) | G8 |
| `ingress.yaml` | Ingresses: `bokatid.xyz` + `cdn.bokatid.xyz` → web, `api.bokatid.xyz` → api, TLS via cert-manager, HTTP → HTTPS redirect | G8 |
| `migrate-job.yaml` | Template for Job `migrate-<sha>` (`dbmate --wait up`, `backoffLimit: 0`). **Not** in `kustomization.yaml`: [`deploy.sh`](../deploy.sh) creates it per deploy, before the rollout | G8 |
| `servicemonitor.yaml` | ServiceMonitor `api`: Prometheus scrapes `/metrics` on the api Service every 15s. Needs the monitoring stack ([cluster/README.md §4](../../cluster/README.md#4-monitoring-g14)) | G14 |
| `backup-cronjob.yaml` | CronJob `postgres-daily-backup`: daily 03:00 Europe/Stockholm, `pg_dump -Fc` checked with `pg_restore -l`, then `aws s3 cp` to the bucket. Both steps run with `sh -e` | G15 |

**Labels:** every pod gets `app: <name>` (`app: api`, `app: web`, `app: postgres`). The runbook relies on
them, e.g. `kubectl -n bookingapp logs -l app=api --prefix` for logs from all API pods.

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

# Backup CronJob: the AWS S3 bucket and an access key that only needs to upload to it
kubectl -n bookingapp create secret generic backup-s3 \
  --from-literal=AWS_ACCESS_KEY_ID='<key id>' \
  --from-literal=AWS_SECRET_ACCESS_KEY='<secret>' \
  --from-literal=AWS_DEFAULT_REGION='<region, e.g. eu-north-1>' \
  --from-literal=S3_BUCKET='<bucket>'
```

The images on GHCR are public, so no pull secret is needed.

To rotate a secret, delete it, create it again, then restart what uses it
(`kubectl -n bookingapp rollout restart deployment/api`).
