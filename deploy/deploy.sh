#!/usr/bin/env bash
# Runs on the VPS. The pipeline copies deploy/k8s to ~/k8s first and sets the image tags.
set -euo pipefail

sha="$1"
job="migrate-$sha"
cd ~/k8s

# A rerun of the same commit needs the old Job out of the way.
kubectl -n bookingapp delete job "$job" --ignore-not-found
sed "s/__SHA__/$sha/g" migrate-job.yaml | kubectl apply -f -

status=""
for _ in $(seq 1 60); do
  status=$(kubectl -n bookingapp get job "$job" \
    -o jsonpath='{range .status.conditions[?(@.status=="True")]}{.type}{"\n"}{end}')
  if grep -qE '^(Complete|Failed)$' <<<"$status"; then
    break
  fi
  sleep 5
done

kubectl -n bookingapp logs "job/$job" || true

# A failed migration stops here, so the old pods keep serving the old schema.
if ! grep -q '^Complete$' <<<"$status"; then
  echo "Migration did not complete" >&2
  exit 1
fi

kubectl apply -k .
kubectl -n bookingapp rollout status deployment/api --timeout=180s
kubectl -n bookingapp rollout status deployment/web --timeout=180s
