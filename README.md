# Vigil

[![CI](https://github.com/belimm01/vigil/actions/workflows/ci.yml/badge.svg)](https://github.com/belimm01/vigil/actions/workflows/ci.yml)

Vigil is a self-hostable **synthetic uptime and performance monitoring** platform.
It runs scheduled health checks — and multi-step scripted journeys — against your
APIs and websites, tracks uptime and latency over time, and opens incidents when
things break. Unlike a simple pinger, it detects latency anomalies against a
rolling baseline, so a slow-but-healthy endpoint is caught before it becomes an
outage.

> A focused, production-shaped project: background scheduling, time-series data,
> multi-tenant authorization, and a shared domain core — each feature exists
> because the domain needs it, not to tick a box.

## Architecture

```
                 ┌──────────────┐        ┌──────────────┐
   browser  ───▶ │  web (React) │ ─────▶ │  api (Hono)  │
                 └──────────────┘  HTTP  └──────┬───────┘
                                                │ Drizzle
                                         ┌──────▼───────┐
                                         │  PostgreSQL  │
                                         └──────▲───────┘
                                                │ Drizzle
                 ┌──────────────┐  fetch ┌──────┴───────┐
   endpoints ◀── │ worker (poll)│ ◀──────│  scheduler   │
                 └──────────────┘        └──────────────┘

  packages/core  pure domain logic (incident engine, anomaly detection)
  packages/db    shared Drizzle schema, client factory, migrations
```

The **api** and **worker** are independent processes that share the database
schema and the domain core, so checks keep running regardless of API load.

## Tech stack

- **Language:** TypeScript (ESM, Node 22), strict compiler settings
- **API:** [Hono](https://hono.dev), [jose](https://github.com/panva/jose) JWTs, `node:crypto` scrypt password hashing, Zod validation
- **Database:** PostgreSQL 16 via [Drizzle ORM](https://orm.drizzle.team) and `postgres.js`
- **Frontend:** React 19, Vite 6, TanStack Query
- **Tooling:** npm workspaces monorepo, Vitest, GitHub Actions CI

## Monorepo layout

```
packages/
  core/   domain logic — incident state machine, latency anomaly detection (16 tests)
  db/     Drizzle schema, createDb() factory, runMigrations(), generated SQL
apps/
  api/    Hono HTTP API — auth, organizations, monitor management
  worker/ scheduler + HTTP check runner + incident persistence (5 tests)
  web/    React dashboard
```

## Getting started

Requires Node 22+ and Docker (for Postgres).

```bash
npm install
cp .env.example .env

docker compose up -d postgres    # starts PostgreSQL on :5432
npm run migrate                  # apply database migrations

npm run dev:api      # http://localhost:4000
npm run dev:worker   # begins polling active monitors
npm run dev:web      # http://localhost:5173
```

Register an account in the UI, add an HTTP monitor, and the worker will start
checking it on the next tick.

## How it works

**Incident debouncing.** A monitor doesn't alert on a single blip. `evaluateIncident`
opens an incident only after `failThreshold` consecutive failures and resolves it
on the first healthy result — the logic is a pure function, fully unit-tested.

**Latency anomaly detection.** On each healthy check the worker compares the new
latency to the 95th percentile of a trailing baseline. A response that is much
slower than usual is recorded as `degraded` even when it returns `200`.

**Multi-step journeys.** A monitor can chain requests: values extracted from one
response (via JSON path or a header) are interpolated into `{{placeholders}}` in
later steps — enough to script a login-then-fetch flow.

**Idempotent alerting.** The `alert_deliveries` table carries a unique constraint
on `(incident, channel, transition)`, so a retried job can never double-notify.

**Alert channels.** An organization can register Slack, email, or generic webhook
channels via `/api/alert-channels`. When the worker opens or resolves an incident it
formats a message in the domain core and fans it out to every channel, claiming a
delivery row before sending so a failed send is retried on the next tick rather
than duplicated. Email uses SMTP — set `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`
for the worker (see `.env.example` for a Gmail app-password example).

## Production engineering

- [ADR: separate API and worker](docs/adr/0001-separate-api-and-worker.md) records the scaling, coordination, and rollout boundary.
- [Service objectives](docs/slo.md) distinguish platform availability from monitored-target failures.
- [Security model](docs/security.md) documents tenant authorization, secret handling, and the outbound-request/SSRF boundary.
- [Operations runbook](docs/runbook.md) covers scheduler recovery, migration failure, dashboard routing, and JWT rotation.

The multi-stage root `Dockerfile` builds non-root API, worker, and web targets. The Helm chart under `deploy/helm/vigil` deploys them independently with resource guarantees, health probes, NetworkPolicy, and pre-existing Secrets:

```bash
helm lint deploy/helm/vigil
helm template vigil deploy/helm/vigil > /tmp/vigil.yaml
```

Default image repositories and zero digests are placeholders. Override each repository and SHA-256 digest with a published image. Database migrations must complete before workload rollout.

## Testing

```bash
npm test         # unit tests across the workspace
npm run build    # type-checked build of every package
npm run typecheck
```

## Roadmap

- [x] Auth, organizations, monitor CRUD, scheduler, incident engine, anomaly detection
- [ ] BullMQ + Redis job queue with retries and backoff (replacing the interval scheduler)
- [ ] WebSocket live dashboard and incident timeline
- [x] Email / Slack / webhook alert channels
- [ ] Public status page with 90-day uptime bars from the daily rollup
- [ ] Playwright end-to-end coverage

## License

MIT
