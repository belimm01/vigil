import { Hono, type Context } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export type ReadinessCheck = () => Promise<void>;

async function databaseReady(): Promise<void> {
  await withTimeout(db.execute(sql`select 1`), 2_000);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("readiness check timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createHealth(readinessCheck: ReadinessCheck = databaseReady) {
  const health = new Hono();
  const live = (c: Context) => c.json({ status: "ok", uptime: process.uptime() });

  health.get("/", live);
  health.get("/live", live);
  health.get("/ready", async (c) => {
    try {
      await readinessCheck();
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  });
  return health;
}

export const health = createHealth();
