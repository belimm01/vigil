# Operations runbook

## Checks stop running

1. Confirm the worker process is alive and the scheduler loop is advancing.
2. Check database connectivity, lock contention, and active-monitor query latency.
3. Compare `CHECK_CONCURRENCY` with available sockets, CPU, and database capacity.
4. Restart only after confirming an overlapping worker cannot create an alert storm; delivery uniqueness protects transition notifications, but target checks are at-least-once.

## API is healthy but dashboard is unavailable

Check the web pod, nginx configuration, and the web-to-API Service route. `/api/health` is served by the API and should be tested through the same ingress path as the browser.

## Migration fails

Stop the rollout. Inspect the migration and database state before retrying. Prefer backward-compatible additions, deploy readers/writers, backfill, then remove old fields in a later release. Restore from a tested backup when a partially applied non-transactional change cannot be completed safely.

## JWT secret exposure

Replace the Secret and restart every API replica. Existing access and refresh tokens become invalid. Audit logs and remove the exposed value from every retained artifact; rotating only the pod does not revoke leaked signing material.
