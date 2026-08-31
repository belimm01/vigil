import { classifyLatency, evaluateIncident, type CheckResult } from "@vigil/core";
import { schema, type Database } from "@vigil/db";
import { and, desc, eq } from "drizzle-orm";
import type { RunOutcome } from "./runner.js";

const BASELINE_LIMIT = 100;

export interface MonitorRef {
  id: string;
  failThreshold: number;
}

export async function persistCheck(
  db: Database,
  monitor: MonitorRef,
  outcome: RunOutcome,
): Promise<CheckStatusApplied> {
  let status = outcome.status;

  if (status === "up") {
    const recent = await db
      .select({ latencyMs: schema.checkResults.latencyMs })
      .from(schema.checkResults)
      .where(and(eq(schema.checkResults.monitorId, monitor.id), eq(schema.checkResults.status, "up")))
      .orderBy(desc(schema.checkResults.createdAt))
      .limit(BASELINE_LIMIT);

    const baseline = recent.map((r) => r.latencyMs).filter((n): n is number => n != null);
    if (classifyLatency(outcome.latencyMs, baseline) === "degraded") {
      status = "degraded";
    }
  }

  await db.insert(schema.checkResults).values({
    monitorId: monitor.id,
    status,
    httpStatus: outcome.httpStatus,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
  });

  const reconciled = await reconcileIncident(db, monitor);
  return { status, ...reconciled };
}

export interface IncidentRef {
  id: string;
  cause: string | null;
  at: Date;
}

export interface CheckStatusApplied {
  status: "up" | "down" | "degraded";
  transition: "opened" | "resolved" | "none";
  incident: IncidentRef | null;
}

async function reconcileIncident(
  db: Database,
  monitor: MonitorRef,
): Promise<{ transition: CheckStatusApplied["transition"]; incident: IncidentRef | null }> {
  const rows = await db
    .select()
    .from(schema.checkResults)
    .where(eq(schema.checkResults.monitorId, monitor.id))
    .orderBy(desc(schema.checkResults.createdAt))
    .limit(Math.max(monitor.failThreshold, 1));

  const recent: CheckResult[] = rows.map((r) => ({
    status: r.status,
    httpStatus: r.httpStatus,
    latencyMs: r.latencyMs,
    error: r.error,
    createdAt: r.createdAt,
  }));

  const open = await db.query.incidents.findFirst({
    where: and(eq(schema.incidents.monitorId, monitor.id), eq(schema.incidents.status, "open")),
  });

  const decision = evaluateIncident(recent, {
    failThreshold: monitor.failThreshold,
    openIncident: open ? { id: open.id, startedAt: open.startedAt } : null,
  });

  if (decision.action === "open") {
    const [created] = await db
      .insert(schema.incidents)
      .values({ monitorId: monitor.id, status: "open", cause: decision.cause })
      .returning();
    return {
      transition: "opened",
      incident: { id: created!.id, cause: created!.cause, at: created!.startedAt },
    };
  }

  if (decision.action === "resolve" && open) {
    const [updated] = await db
      .update(schema.incidents)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(schema.incidents.id, open.id))
      .returning();
    return {
      transition: "resolved",
      incident: { id: updated!.id, cause: updated!.cause, at: updated!.resolvedAt! },
    };
  }

  return { transition: "none", incident: null };
}
