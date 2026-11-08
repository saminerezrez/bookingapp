# cluster

Everything installed **once** on the cluster, outside the app's own manifests. Commands and values live
here, so the setup can be rebuilt from scratch on a new VPS.

> **Status: v1.** The steps follow the plan in [ARCHITECTURE.md](../ARCHITECTURE.md). They're checked
> and corrected while doing G6 (VPS + k3s) and G14 (monitoring).

## Planned files

| Path | Contents | Task |
|---|---|---|
| `cert-manager/cluster-issuers.yaml` | ClusterIssuers `letsencrypt-staging` and `letsencrypt-prod` (HTTP-01 via Traefik) | G6 |
| `helm/kube-prometheus-stack.yaml` | Values: no Alertmanager, short retention, Grafana Ingress at `grafana.<domain>` | G14 |
| `helm/loki.yaml` | Values: single-binary mode, filesystem storage | G14 |
| `helm/alloy.yaml` | Values: collect pod stdout and ship it to Loki | G14 |
| `grafana/bookingapp.json` | The dashboard: request rate, errors, p95, replica count, logs | G14 |
| `monitoring/redirect-https.yaml` | HTTP → HTTPS redirect for `grafana.<domain>` | G14 |

## 1. VPS (G6)

Ubuntu 24.04, ≥ 4 vCPU, ≥ 8 GB RAM.

```bash
# As root: a user with SSH key login, then turn off password logins
adduser --disabled-password --gecos "" deploy && usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-deploy && chmod 440 /etc/sudoers.d/90-deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
# Log in as deploy and check sudo works BEFORE the next step, or you can lock yourself out
printf "PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n" \
  > /etc/ssh/sshd_config.d/00-bookingapp.conf
sshd -t && systemctl reload ssh

# Firewall: only SSH and web from outside; allow k3s pod and service networks inside
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw allow from 10.42.0.0/16 && ufw allow from 10.43.0.0/16
ufw enable

# Automatic security updates
apt install -y unattended-upgrades
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  > /etc/apt/apt.conf.d/20auto-upgrades
```

## 2. k3s (G6)

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="v1.36.5+k3s1" sudo sh -
sudo kubectl get nodes                    # one node, Ready
```

k3s includes Traefik (ingress on ports 80/443), a service load balancer, `local-path` storage and
metrics-server (needed for the HPA). None of these need installing separately.

To let the `deploy` user (and the pipeline over SSH) run `kubectl`, copy `/etc/rancher/k3s/k3s.yaml`
to `~deploy/.kube/config` with mode `600`, and add `KUBECONFIG=/home/deploy/.kube/config` to
`/etc/environment`, because k3s's `kubectl` otherwise reads the root-only file. This is the full
**cluster-admin** kubeconfig, a known shortcut, and so is passwordless `sudo` for `deploy`, which has no password
and logs in by key only. A production setup would give the pipeline a ServiceAccount limited to the `bookingapp`
namespace.

## 3. cert-manager (G6)

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.21.3/cert-manager.yaml
kubectl -n cert-manager wait --for=condition=Available deployment --all --timeout=240s
kubectl apply -f cluster/cert-manager/cluster-issuers.yaml
kubectl create namespace bookingapp
```

Use `letsencrypt-staging` until certificates are issued correctly, then switch the Ingresses to
`letsencrypt-prod`. This avoids hitting Let's Encrypt's rate limits while experimenting.

## 4. Monitoring (G14)

Install this **before** merging anything that contains `deploy/k8s/servicemonitor.yaml`. The
ServiceMonitor type comes from this stack, so the deploy fails until it exists.

Run on the VPS as `deploy`, from a checkout of the repo (`~/src/bookingapp`).

```bash
# Helm, checked against its published checksum
cd /tmp
curl -fsSLO https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz
curl -fsSLO https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz.sha256sum
sha256sum -c helm-v3.19.0-linux-amd64.tar.gz.sha256sum
tar -xzf helm-v3.19.0-linux-amd64.tar.gz && sudo install linux-amd64/helm /usr/local/bin/helm
cd ~/src/bookingapp

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Namespace, a random Grafana admin password (never shown in the terminal or committed), and the HTTPS redirect
kubectl create namespace monitoring
kubectl -n monitoring create secret generic grafana-admin \
  --from-literal=admin-user=admin --from-literal=admin-password="$(openssl rand -base64 24)"
kubectl apply -f cluster/monitoring/redirect-https.yaml

# Prometheus + Grafana + kube-state-metrics + node-exporter, then Loki, then Alloy
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack --version 92.11.0 \
  -n monitoring -f cluster/helm/kube-prometheus-stack.yaml --wait --timeout 10m
helm upgrade --install loki grafana/loki --version 7.5.0 \
  -n monitoring -f cluster/helm/loki.yaml --wait --timeout 10m
helm upgrade --install alloy grafana/alloy --version 1.14.2 \
  -n monitoring -f cluster/helm/alloy.yaml --wait --timeout 5m

# The dashboard. Grafana loads every ConfigMap labelled grafana_dashboard=1
kubectl -n monitoring create configmap bookingapp-dashboard \
  --from-file=cluster/grafana/bookingapp.json --dry-run=client -o yaml | kubectl apply -f -
kubectl -n monitoring label configmap bookingapp-dashboard grafana_dashboard=1 --overwrite
```

Log in at `https://grafana.<domain>` as `admin`. To read the password:

```bash
kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d; echo
```

To change a setting or the dashboard, edit the file here, merge it, then run the same `helm upgrade --install`
or `configmap` command again.

## 5. Deploy access for the pipeline (G9)

- Generate an SSH key pair for the pipeline. Add the public key to `~deploy/.ssh/authorized_keys` on the VPS.
- In GitHub → Settings → Secrets: `DEPLOY_SSH_KEY` (private key), `DEPLOY_HOST` (VPS address).
- The Kubernetes API (port 6443) stays closed in the firewall. The pipeline runs `kubectl` on the VPS over SSH.
