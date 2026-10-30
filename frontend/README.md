# frontend

React 19 + TypeScript + Vite. Visitors pick a date, see the free slots and book one.
Setup, configuration and deployment: see the [root README](../README.md).

```bash
cp .env.example .env      # VITE_API_URL=http://localhost:3000
npm ci
npm run dev               # http://localhost:5173
npm run lint
npm run build             # production build in dist/
```

In production the build is served by nginx on `cdn.<domain>`. `nginx.conf` and the `Dockerfile` are
added in G7.
