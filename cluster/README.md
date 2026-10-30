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

## 1. VPS (G6)

Ubuntu 24.04, ≥ 4 vCPU, ≥ 8 GB RAM.

```bash
# As root: a user with SSH key login, then turn off password logins
adduser deploy && usermod -aG sudo deploy
# copy your public key to /home/deploy/.ssh/authorized_keys
# in /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no
systemctl restart ssh

# Firewall: only SSH and web from outside; allow k3s pod and service networks inside
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw allow from 10.42.0.0/16 && ufw allow from 10.43.0.0/16
ufw enable

# Automatic security updates
apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

## 2. k3s (G6)

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes                    # one node, Ready
```

k3s includes Traefik (ingress on ports 80/443), a service load balancer, `local-path` storage and
metrics-server (needed for the HPA). None of these need installing separately.

To let the `deploy` user (and the pipeline over SSH) run `kubectl`, copy `/etc/rancher/k3s/k3s.yaml`
to `~deploy/.kube/config` with mode `600`. This is the full **cluster-admin** kubeconfig, a known
shortcut. A production setup would give the pipeline a ServiceAccount limited to the `bookingapp`
namespace.

## 3. cert-manager (G6)

```bash
helm repo add jetstack https://charts.jetstack.io && helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace --set crds.enabled=true
kubectl apply -f cluster/cert-manager/cluster-issuers.yaml
```

Use `letsencrypt-staging` until certificates are issued correctly, then switch the Ingresses to
`letsencrypt-prod`. This avoids hitting Let's Encrypt's rate limits while experimenting.

## 4. Monitoring (G14)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

kubectl create namespace monitoring
kubectl -n monitoring create secret generic grafana-admin \
  --from-literal=admin-user=admin --from-literal=admin-password='<strong password>'

helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring -f cluster/helm/kube-prometheus-stack.yaml
helm install loki grafana/loki -n monitoring -f cluster/helm/loki.yaml
helm install alloy grafana/alloy -n monitoring -f cluster/helm/alloy.yaml
```

Then import `grafana/bookingapp.json` in Grafana, or load it through the chart's dashboard provisioning.

To upgrade any of them: the same command with `helm upgrade` instead of `helm install`.

## 5. Deploy access for the pipeline (G9)

- Generate an SSH key pair for the pipeline. Add the public key to `~deploy/.ssh/authorized_keys` on the VPS.
- In GitHub → Settings → Secrets: `DEPLOY_SSH_KEY` (private key), `DEPLOY_HOST` (VPS address).
- The Kubernetes API (port 6443) stays closed in the firewall. The pipeline runs `kubectl` on the VPS over SSH.
