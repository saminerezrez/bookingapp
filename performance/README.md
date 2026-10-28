# performance

[k6](https://k6.io) scripts that demonstrate the two VG requirements under load. Added in **VG3**.
They aren't part of the pipeline. We run them by hand for the rehearsal and the defense.

**Always run k6 from a laptop, never on the VPS.** Otherwise k6 competes with the API for the same
CPU, and neither the zero-downtime nor the autoscaling result means anything.

## Planned files

| File | Purpose |
|---|---|
| `steady.js` | Constant moderate load. Threshold `http_req_failed: rate==0`, so k6 fails if a single request fails |
| `ramp.js` | Ramps up load (mostly `GET /available-slots`) until the HPA scales out, holds, then stops |

## Demo 1: deploy without downtime

```bash
# Terminal 1: watch pods being replaced
kubectl -n bookingapp get pods -w

# Terminal 2: constant load during the whole deploy
k6 run -e BASE_URL=https://api.<domain> performance/steady.js

# Meanwhile: merge a small change to main and let the pipeline deploy it
```

**Pass:** the pipeline deploys a new SHA (`/version`), the pods are replaced one by one, and k6 ends with
`http_req_failed: 0.00%` and the threshold passed.

## Demo 2: autoscaling

```bash
# Terminal 1: watch the HPA
kubectl -n bookingapp get hpa api -w

# Terminal 2: ramp the load
k6 run -e BASE_URL=https://api.<domain> performance/ramp.js
```

**Pass:** CPU goes above the 60% target, replicas go 2 → N, no pod is stuck in `Pending`, and about a
minute after the load stops, replicas go back to 2. The replica panel in Grafana shows the same curve.

If the HPA doesn't scale, lower its target (for example 40%) and run again (ROADMAP VG3).

Record both demos on screen as a fallback for the defense.
