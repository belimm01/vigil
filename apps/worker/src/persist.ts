import { classifyLatency, evaluateIncident, type CheckResult } from "@vigil/core";
import { schema, type Database } from "@vigil/db";
import { and, desc, eq } from "drizzle-orm";
import type { RunOutcome } from "./runner.js";

const BASELINE_LIMIT = 100;

export interface MonitorRef {
  id: string;
  failThreshold: number;
}

/**
 * Persist a check result, downgrade healthy-but-slow responses to "degraded",
 * and open or resolve the monitor's incident accordingly.
 */
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

  const transition = await reconcileIncident(db, monitor);
  return { status, transition };
}

export interface CheckStatusApplied {
  status: "up" | "down" | "degraded";
  transition: "opened" | "resolved" | "none";
}

async function reconcileIncident(db: Database, monitor: MonitorRef): Promise<CheckStatusApplied["transition"]> {
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
    await db
      .insert(schema.incidents)
      .values({ monitorId: monitor.id, status: "open", cause: decision.cause });
    return "opened";
  }

  if (decision.action === "resolve" && open) {
    await db
      .update(schema.incidents)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(eq(schema.incidents.id, open.id));
    return "resolved";
  }

  return "none";
}
