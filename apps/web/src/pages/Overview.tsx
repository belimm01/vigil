import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { CreateMonitor } from "../components/CreateMonitor.js";
import { Icon } from "../components/Icon.js";
import { UptimeBar } from "../components/UptimeBar.js";
import { EmptyState, Skeleton, StatTile, StatusBadge } from "../components/ui.js";
import { useOrg } from "../context/org.js";
import { formatLatency, formatUptime } from "../lib/format.js";
import type { CheckResult, Monitor, MonitorSummary } from "../types.js";

export function Overview() {
  const { orgId } = useOrg();
  const [creating, setCreating] = useState(false);

  const monitors = useQuery({
    queryKey: ["monitors", orgId],
    queryFn: () => api<Monitor[]>(`/monitors?orgId=${orgId}`),
    enabled: Boolean(orgId),
    refetchInterval: 15_000,
  });

  const list = monitors.data ?? [];

  const summaries = useQueries({
    queries: list.map((m) => ({
      queryKey: ["summary", m.id],
      queryFn: () => api<MonitorSummary>(`/monitors/${m.id}/summary`),
      refetchInterval: 15_000,
    })),
  });

  const summaryById = new Map<string, MonitorSummary>();
  summaries.forEach((s) => {
    if (s.data) summaryById.set(s.data.monitorId, s.data);
  });

  const statuses = list.map((m) => summaryById.get(m.id)?.currentStatus ?? null);
  const up = statuses.filter((s) => s === "up").length;
  const down = statuses.filter((s) => s === "down").length;
  const degraded = statuses.filter((s) => s === "degraded").length;
  const openIncidents = [...summaryById.values()].filter((s) => s.openIncident).length;

  return (
    <>
      <div className="page-head">
        <div className="title">
          <h1>Overview</h1>
          <span className="subtle">Live status across all monitored endpoints</span>
        </div>
        <button className="btn" onClick={() => setCreating(true)} disabled={!orgId}>
          <Icon name="plus" size={16} />
          New monitor
        </button>
      </div>

      <div className="tiles">
        <StatTile label="Monitors" value={list.length} icon="monitor" />
        <StatTile label="Operational" value={up} icon="check" tone={up ? "up" : undefined} />
        <StatTile
          label="Degraded"
          value={degraded}
          icon="trend"
          tone={degraded ? "degraded" : undefined}
        />
        <StatTile label="Down" value={down} icon="alert" tone={down ? "down" : undefined} />
        <StatTile
          label="Open incidents"
          value={openIncidents}
          icon="bell"
          tone={openIncidents ? "down" : undefined}
        />
      </div>

      {monitors.isLoading ? (
        <div className="grid-cards">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card monitor-card">
              <Skeleton height={20} width="60%" />
              <Skeleton height={34} />
              <Skeleton height={24} width="40%" />
            </div>
          ))}
        </div>
      ) : monitors.isError ? (
        <div className="card">
          <p className="error">{(monitors.error as Error).message}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="monitor"
            title="No monitors yet"
            hint="Add your first HTTP check or multi-step journey to start tracking uptime."
            action={
              <button className="btn" onClick={() => setCreating(true)}>
                <Icon name="plus" size={16} />
                New monitor
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid-cards">
          {list.map((m) => (
            <MonitorCard key={m.id} monitor={m} summary={summaryById.get(m.id)} />
          ))}
        </div>
      )}

      {creating && <CreateMonitor onClose={() => setCreating(false)} />}
    </>
  );
}

function MonitorCard({ monitor, summary }: { monitor: Monitor; summary?: MonitorSummary }) {
  const results = useQuery({
    queryKey: ["results", monitor.id, 60],
    queryFn: () => api<CheckResult[]>(`/monitors/${monitor.id}/results?limit=60`),
    refetchInterval: 15_000,
  });

  return (
    <Link to={`/monitors/${monitor.id}`} className="card monitor-card">
      <div className="head">
        <div>
          <div className="name">{monitor.name}</div>
          <div className="meta">
            <span>{monitor.type === "journey" ? "Journey" : "HTTP"}</span>
            <span>·</span>
            <span>every {monitor.intervalSeconds}s</span>
          </div>
        </div>
        <StatusBadge status={summary?.currentStatus ?? null} />
      </div>

      <UptimeBar results={results.data ?? []} />

      <div className="metric-row">
        <div>
          <div className="muted" style={{ fontSize: "0.78rem" }}>
            Uptime 24h
          </div>
          <div className="big">{formatUptime(summary?.uptime24h ?? null)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: "0.78rem" }}>
            p95 latency
          </div>
          <div className="big mono">{formatLatency(summary?.p95LatencyMs ?? null)}</div>
        </div>
      </div>
    </Link>
  );
}
