import { schema, type Database } from "@vigil/db";
import { asc, desc, eq } from "drizzle-orm";
import { persistCheck } from "./persist.js";
import {
  runMonitor,
  type Assertion,
  type Extraction,
  type Fetcher,
  type StepConfig,
} from "./runner.js";

type StepRow = typeof schema.monitorSteps.$inferSelect;

function toStepConfig(row: StepRow): StepConfig {
  return {
    url: row.url,
    method: row.method,
    headers: (row.headers ?? {}) as Record<string, string>,
    body: row.body ?? undefined,
    expectedStatus: row.expectedStatus,
    assertions: (row.assertions ?? []) as Assertion[],
    extract: (row.extract ?? []) as Extraction[],
  };
}

async function isDue(db: Database, monitorId: string, intervalSeconds: number): Promise<boolean> {
  const [last] = await db
    .select({ createdAt: schema.checkResults.createdAt })
    .from(schema.checkResults)
    .where(eq(schema.checkResults.monitorId, monitorId))
    .orderBy(desc(schema.checkResults.createdAt))
    .limit(1);

  if (!last) return true;
  return Date.now() - last.createdAt.getTime() >= intervalSeconds * 1000;
}

async function runPool<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      await task(item);
    }
  });
  await Promise.all(workers);
}

/** Run every active monitor whose interval has elapsed. Returns how many ran. */
export async function tick(db: Database, fetcher: Fetcher, concurrency: number): Promise<number> {
  const monitors = await db.query.monitors.findMany({
    where: eq(schema.monitors.isActive, true),
    with: { steps: { orderBy: asc(schema.monitorSteps.stepOrder) } },
  });

  const due = [];
  for (const monitor of monitors) {
    if (await isDue(db, monitor.id, monitor.intervalSeconds)) due.push(monitor);
  }

  await runPool(due, concurrency, async (monitor) => {
    try {
      const outcome = await runMonitor(monitor.steps.map(toStepConfig), fetcher);
      const applied = await persistCheck(
        db,
        { id: monitor.id, failThreshold: monitor.failThreshold },
        outcome,
      );
      if (applied.transition !== "none") {
        console.log(`monitor "${monitor.name}" incident ${applied.transition}`);
      }
    } catch (err) {
      console.error(`monitor ${monitor.id} check failed`, err);
    }
  });

  return due.length;
}
