# Runbook

What to do when something goes wrong in production. Every procedure follows the same pattern:
**symptoms → check → fix → afterwards.**

All commands run on the VPS (`ssh deploy@bokatid.xyz`). The app lives in namespace `bookingapp`.

| Shortcut | |
|---|---|
| Dashboard | https://grafana.bokatid.xyz |
| Running version | `curl https://api.bokatid.xyz/version` |
| Pod overview | `kubectl -n bookingapp get pods -o wide` |
| Recent events | `kubectl -n bookingapp get events --sort-by=.lastTimestamp \| tail -20` |

---

## 1. A deploy made things worse

**Symptoms**
- The error rate or p95 panel jumps right after a deploy
- The smoke test failed in the pipeline
- Users report errors that started after a merge

**Check**
```bash
curl https://api.bokatid.xyz/version                    # which SHA is live?
kubectl -n bookingapp rollout history deployment/api
kubectl -n bookingapp logs -l app=api --prefix --since=10m | grep '"level":50'   # pino errors, all api pods
```

**Fix: roll back the API**
```bash
kubectl -n bookingapp rollout undo deployment/api
kubectl -n bookingapp rollout status deployment/api
curl https://api.bokatid.xyz/version                    # should show the previous SHA
```
The same works for the frontend with `deployment/web`.

**Afterwards**
- `git revert` the bad commit and merge it. Otherwise the next deploy puts the bad version back.
- Rolling back does **not** undo migrations. That's safe, because every migration is backward
  compatible with the previous version of the code (ARCHITECTURE §6).

---

## 2. A pod is crash-looping

**Symptoms**
- `kubectl get pods` shows `CrashLoopBackOff`, `Error` or a growing `RESTARTS` count
- Fewer API pods than expected in the replica panel

**Check**
```bash
kubectl -n bookingapp get pods
kubectl -n bookingapp describe pod <pod>          # look at "Last State", "Reason" and Events
kubectl -n bookingapp logs <pod> --previous       # logs from the crashed container
```

**Fix, by cause**

| What you see | Cause | Fix |
|---|---|---|
| A startup log naming a missing variable | `config.ts` fails fast on a missing env var | Fix the Secret or env (see [deploy/k8s/README.md](../deploy/k8s/README.md#secrets)), then `kubectl -n bookingapp rollout restart deployment/api` |
| `Reason: OOMKilled` | The memory limit is too low | Raise the limit in `deploy/k8s/api.yaml` and merge |
| `ImagePullBackOff` / `ErrImagePull` | The image tag doesn't exist in GHCR (the build step failed), or the package was made private | Check the pipeline's build step and that the GHCR packages are public |
| A DB connection error on startup | The database is down | See §3 |
| Only the new pods crash | A bad release | See §1 |

**Afterwards:** if it was a config problem, update `.env.example` and the Secrets section so it can't
happen again silently.

---

## 3. The database is down

**Symptoms**
- `https://api.bokatid.xyz/health/ready` returns `503`
- All API pods are `0/1 READY`, so Traefik has no endpoints and the API returns `503`/`502`
- Logs are full of connection errors

**Check**
```bash
kubectl -n bookingapp get pod postgres-0
kubectl -n bookingapp describe pod postgres-0
kubectl -n bookingapp logs postgres-0 --tail=50
kubectl -n bookingapp get pvc
df -h                                             # on the VPS: is the disk full?
```

**Fix**

| What you see | Fix |
|---|---|
| The pod is crashed or stuck | `kubectl -n bookingapp delete pod postgres-0`. The StatefulSet recreates it, and the data stays on the volume |
| Disk full (`No space left on device`) | Free space on the VPS (old images: `sudo k3s crictl rmi --prune`; logs), then restart the pod |
| The data is corrupted or the volume is lost | Restore from backup (§4) |

The API recovers by itself. As soon as Postgres answers, readiness turns green again and traffic
returns. No API restart is needed, and Kubernetes doesn't restart the API pods during the outage,
because there's no liveness probe that could fail on the DB.

---

## 4. Restore from backup

Dumps are in the S3 bucket as `postgres/bookingapp-YYYYMMDD-HHMMSS.dump` (UTC time, `pg_dump -Fc` format),
one per night.

**Always restore into a scratch database first** and check it before touching production.

Downloading needs your own AWS login with read access to the bucket. The key in the `backup-s3` Secret
is for the CronJob, which only needs to upload.

```bash
# 1. Find and download the newest dump (on your own machine, logged in to AWS)
aws s3 ls s3://<bucket>/postgres/
aws s3 cp s3://<bucket>/postgres/bookingapp-<timestamp>.dump ./restore.dump
scp ./restore.dump deploy@bokatid.xyz:~/restore.dump
# Then, on the VPS (ssh deploy@bokatid.xyz), from ~:

# 2. Copy it into the Postgres pod
kubectl -n bookingapp cp ./restore.dump postgres-0:/tmp/restore.dump

# 3. Restore into a scratch database and check it
kubectl -n bookingapp exec postgres-0 -- createdb -U postgres bookingapp_restore
kubectl -n bookingapp exec postgres-0 -- pg_restore -U postgres -d bookingapp_restore --no-owner /tmp/restore.dump
kubectl -n bookingapp exec postgres-0 -- psql -U postgres -d bookingapp_restore -c "select count(*), max(created_at) from bookings;"
```

If the count and the latest booking look right, restore into production:

```bash
# 4. Stop the API so nothing writes during the restore
kubectl -n bookingapp scale deployment/api --replicas=0

# 5. Replace production data with the dump
kubectl -n bookingapp exec postgres-0 -- pg_restore -U postgres -d bookingapp --clean --if-exists --no-owner /tmp/restore.dump

# 6. Start the API again and verify
kubectl -n bookingapp scale deployment/api --replicas=1
kubectl -n bookingapp rollout status deployment/api
curl "https://api.bokatid.xyz/available-slots?date=<a weekday>"

# 7. Clean up
kubectl -n bookingapp exec postgres-0 -- dropdb -U postgres bookingapp_restore
kubectl -n bookingapp exec postgres-0 -- rm /tmp/restore.dump
rm ./restore.dump
```

**Data loss:** anything booked after the dump (at most about 24 hours) is lost. Note the time window.

**Restore test log**

| Date | Dump | Rows restored | Matches production? | By |
|---|---|---|---|---|
| Nov 2026 | A daily dump from S3 | 9 bookings | Yes | Sofie |
