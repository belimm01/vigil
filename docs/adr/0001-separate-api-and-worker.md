# ADR 0001: Separate the API and check worker

- Status: accepted
- Date: 2026-08-31

## Context

Monitor checks are outbound, variable-latency work. Running them in the request-serving process couples API availability and rollout behavior to the number and duration of checks.

## Decision

Deploy the API and worker as independent processes. They share the Drizzle schema and framework-independent domain core, but scale and restart separately. PostgreSQL remains the coordination boundary. Migrations run as a deployment hook before either workload is updated.

## Consequences

- API latency and availability are isolated from scheduled check execution.
- Worker concurrency can be tuned independently.
- At-least-once scheduling means incident transitions and alert delivery must remain idempotent.
- PostgreSQL capacity and schema compatibility constrain rolling deployments; migrations must follow expand-contract rules.
