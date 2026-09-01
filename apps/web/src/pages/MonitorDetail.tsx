import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { Icon } from "../components/Icon.js";
import { LatencyChart } from "../components/LatencyChart.js";
import { UptimeBar } from "../components/UptimeBar.js";
import { EmptyState, Skeleton, StatTile, StatusBadge } from "../components/ui.js";
import {
  formatDateTime,
  formatDuration,
  formatLatency,
  formatRelative,
  formatUptime,
} from "../lib/format.js";
import type { CheckResult, Incident, MonitorDetail as MonitorDetailType, MonitorSummary } from "../types.js";

export function MonitorDetail() {
  const { id } = useParams<{ id: string }>();

  const monitor = useQuery({
    queryKey: ["monitor", id],
    queryFn: () => api<MonitorDetailType>(`/monitors/${id}`),
    enabled: Boolean(id),
  });

  const summary = useQuery({
    queryKey: ["summary", id],
    queryFn: () => api<MonitorSummary>(`/monitors/${id}/summary`),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });

  const results = useQuery({
    queryKey: ["results", id, 200],
    queryFn: () => api<CheckResult[]>(`/monitors/${id}/results?limit=200`),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });

  const orgId = monitor.data?.orgId;
  const incidents = useQuery({
    queryKey: ["incidents", orgId, id],
    queryFn: () => api<Incident[]>(`/incidents?orgId=${orgId}&monitorId=${id}`),
    enabled: Boolean(orgId && id),
    refetchInterval: 30_000,
  });

  if (monitor.isLoading) {
    return (
      <div className="stack">
        <Skeleton height={28} width="40%" />
        <div className="tiles">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={92} radius={14} />
          ))}
        </div>
        <Skeleton height={280} radius={14} />
      </div>
    );
  }

  if (monitor.isError || !monitor.data) {
    return (
      <div className="card">
        <EmptyState
          icon="monitor"
          title="Monitor not found"
          hint={(monitor.error as Error | undefined)?.message}
          action={
            <Link to="/" className="btn secondary">
              Back to overview
            </Link>
          }
        />
      </div>
    );
  }

  const m = monitor.data;
  const s = summary.data;
  const list = results.data ?? [];
  const showSteps = m.type === "journey" || m.steps.length > 1;

  return (
    <>
      <Link to="/" className="link cluster" style={{ width: "fit-content" }}>
        <Icon name="arrowLeft" size={16} />
        Overview
      </Link>

      <div className="page-head">
        <div className="title">
          <div className="cluster">
            <h1>{m.name}</h1>
            <StatusBadge status={s?.currentStatus ?? null} />
          </div>
          <span className="subtle">
            {m.type === "journey" ? "Multi-step journey" : "HTTP check"} · every {m.intervalSeconds}s ·
            checks {formatRelative(s?.lastCheckedAt ?? null)}
          </span>
        </div>
      </div>

      <div className="tiles">
        <StatTile label="Uptime 24h" value={formatUptime(s?.uptime24h ?? null)} icon="check" />
        <StatTile label="Uptime 7d" value={formatUptime(s?.uptime7d ?? null)} icon="clock" />
        <StatTile label="p50 latency" value={formatLatency(s?.p50LatencyMs ?? null)} icon="trend" />
        <StatTile label="p95 latency" value={formatLatency(s?.p95LatencyMs ?? null)} icon="pulse" />
        <StatTile label="Checks (7d)" value={s?.checks7d ?? 0} icon="monitor" />
      </div>

      <div className="detail-grid">
        <div className="stack">
          <div className="card">
            <div className="section-title">
              <h2>Latency</h2>
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                last {list.filter((r) => r.latencyMs != null).length} checks
              </span>
            </div>
            <LatencyChart results={list} p95={s?.p95LatencyMs ?? null} />
          </div>

          <div className="card">
            <div className="section-title">
              <h2>Recent status</h2>
            </div>
            <UptimeBar results={list} max={90} />
            <div className="uptimebar-legend">
              <span>90 checks ago</span>
              <span>now</span>
            </div>
          </div>

          <div className="card">
            <div className="section-title">
              <h2>Recent checks</h2>
            </div>
            {list.length === 0 ? (
              <EmptyState title="No checks recorded yet" hint="Results appear once the worker runs this monitor." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th className="num">HTTP</th>
                    <th className="num">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 20).map((r) => (
                    <tr key={r.id}>
                      <td title={formatDateTime(r.createdAt)}>{formatRelative(r.createdAt)}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="num">{r.httpStatus ?? "—"}</td>
                      <td className="num">{formatLatency(r.latencyMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="stack">
          {showSteps && (
            <div className="card">
              <div className="section-title">
                <h2>Journey steps</h2>
                <span className="badge neutral">{m.steps.length}</span>
              </div>
              <div className="steps">
                {m.steps.map((step) => (
                  <div className="step" key={step.id}>
                    <span className="idx">{step.stepOrder + 1}</span>
                    <span className="method">{step.method}</span>
                    <span className="url">{step.url}</span>
                    <span className="badge neutral">{step.expectedStatus ?? "any"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="section-title">
              <h2>Incidents</h2>
            </div>
            {(incidents.data?.length ?? 0) === 0 ? (
              <EmptyState icon="bell" title="No incidents" hint="This monitor has stayed healthy." />
            ) : (
              <div className="timeline">
                {incidents.data!.map((inc) => (
                  <div className="item" key={inc.id}>
                    <span className={`marker ${inc.status}`} />
                    <div className="body">
                      <strong>{inc.status === "open" ? "Ongoing outage" : "Resolved outage"}</strong>
                      {inc.cause && <span className="secondary">{inc.cause}</span>}
                      <span className="when">
                        {formatDateTime(inc.startedAt)} · lasted{" "}
                        {formatDuration(inc.startedAt, inc.resolvedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
