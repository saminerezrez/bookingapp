import { Histogram, Registry } from "prom-client";

export const registry = new Registry();

// The _count series gives the request rate and errors, and the buckets give the p95 latency.
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "How long HTTP requests take, by method, route and status code",
  labelNames: ["method", "route", "status_code"],
  registers: [registry],
});
