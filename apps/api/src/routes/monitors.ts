import { zValidator } from "@hono/zod-validator";
import { percentile } from "@vigil/core";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { requireMembership } from "../lib/authz.js";
import { requireAuth, type AuthVars } from "../middleware/auth.js";

const stepInput = z.object({
  url: z.string().url(),
  method: z.string().default("GET"),
  headers: z.record(z.string()).default({}),
  body: z.unknown().optional(),
  expectedStatus: z.number().int().default(200),
  assertions: z.array(z.unknown()).default([]),
  extract: z.array(z.unknown()).default([]),
});

const createBody = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(["http", "journey"]).default("http"),
  intervalSeconds: z.number().int().min(30).max(3600).default(60),
  failThreshold: z.number().int().min(1).max(10).default(3),
  steps: z.array(stepInput).min(1),
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  intervalSeconds: z.number().int().min(30).max(3600).optional(),
  failThreshold: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

export const monitors = new Hono<{ Variables: AuthVars }>();

monitors.use("*", requireAuth);

monitors.post("/", zValidator("json", createBody), async (c) => {
  const input = c.req.valid("json");
  await requireMembership(c.get("userId"), input.orgId, "admin");

  const monitor = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.monitors)
      .values({
        orgId: input.orgId,
        name: input.name,
        type: input.type,
        intervalSeconds: input.intervalSeconds,
        failThreshold: input.failThreshold,
      })
      .returning();

    await tx.insert(schema.monitorSteps).values(
      input.steps.map((step, index) => ({
        monitorId: created!.id,
        stepOrder: index,
        url: step.url,
        method: step.method,
        headers: step.headers,
        body: step.body ?? null,
        expectedStatus: step.expectedStatus,
        assertions: step.assertions,
        extract: step.extract,
      })),
    );

    return created!;
  });

  return c.json(monitor, 201);
});

monitors.get("/", zValidator("query", z.object({ orgId: z.string().uuid() })), async (c) => {
  const { orgId } = c.req.valid("query");
  await requireMembership(c.get("userId"), orgId);

  const rows = await db.query.monitors.findMany({
    where: eq(schema.monitors.orgId, orgId),
    orderBy: asc(schema.monitors.createdAt),
  });
  return c.json(rows);
});

monitors.get("/:id", async (c) => {
  const monitor = await db.query.monitors.findFirst({
    where: eq(schema.monitors.id, c.req.param("id")),
    with: { steps: { orderBy: asc(schema.monitorSteps.stepOrder) } },
  });
  if (!monitor) throw new HTTPException(404, { message: "Monitor not found" });

  await requireMembership(c.get("userId"), monitor.orgId);
  return c.json(monitor);
});

monitors.get(
  "/:id/results",
  zValidator("query", z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) })),
  async (c) => {
    const { limit } = c.req.valid("query");
    const monitor = await db.query.monitors.findFirst({
      where: eq(schema.monitors.id, c.req.param("id")),
    });
    if (!monitor) throw new HTTPException(404, { message: "Monitor not found" });
    await requireMembership(c.get("userId"), monitor.orgId);

    const rows = await db
      .select({
        id: schema.checkResults.id,
        status: schema.checkResults.status,
        httpStatus: schema.checkResults.httpStatus,
        latencyMs: schema.checkResults.latencyMs,
        error: schema.checkResults.error,
        createdAt: schema.checkResults.createdAt,
      })
      .from(schema.checkResults)
      .where(eq(schema.checkResults.monitorId, monitor.id))
      .orderBy(desc(schema.checkResults.createdAt))
      .limit(limit);

    return c.json(rows);
  },
);

monitors.get("/:id/summary", async (c) => {
  const monitor = await db.query.monitors.findFirst({
    where: eq(schema.monitors.id, c.req.param("id")),
  });
  if (!monitor) throw new HTTPException(404, { message: "Monitor not found" });
  await requireMembership(c.get("userId"), monitor.orgId);

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const window = await db
    .select({
      status: schema.checkResults.status,
      latencyMs: schema.checkResults.latencyMs,
      createdAt: schema.checkResults.createdAt,
    })
    .from(schema.checkResults)
    .where(and(eq(schema.checkResults.monitorId, monitor.id), gte(schema.checkResults.createdAt, since7d)))
    .orderBy(desc(schema.checkResults.createdAt));

  const [latest] = await db
    .select({ status: schema.checkResults.status, createdAt: schema.checkResults.createdAt })
    .from(schema.checkResults)
    .where(eq(schema.checkResults.monitorId, monitor.id))
    .orderBy(desc(schema.checkResults.createdAt))
    .limit(1);

  const openIncident = await db.query.incidents.findFirst({
    where: and(eq(schema.incidents.monitorId, monitor.id), eq(schema.incidents.status, "open")),
  });

  const within24h = window.filter((r) => r.createdAt >= since24h);
  const uptime = (rows: { status: string }[]): number | null =>
    rows.length === 0 ? null : (rows.filter((r) => r.status !== "down").length / rows.length) * 100;

  const latencies = window
    .map((r) => r.latencyMs)
    .filter((n): n is number => n != null);

  return c.json({
    monitorId: monitor.id,
    currentStatus: latest?.status ?? null,
    lastCheckedAt: latest?.createdAt ?? null,
    uptime24h: uptime(within24h),
    uptime7d: uptime(window),
    p50LatencyMs: latencies.length ? Math.round(percentile(latencies, 50)) : null,
    p95LatencyMs: latencies.length ? Math.round(percentile(latencies, 95)) : null,
    checks24h: within24h.length,
    checks7d: window.length,
    openIncident: Boolean(openIncident),
  });
});

monitors.patch("/:id", zValidator("json", updateBody), async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.monitors.findFirst({ where: eq(schema.monitors.id, id) });
  if (!existing) throw new HTTPException(404, { message: "Monitor not found" });

  await requireMembership(c.get("userId"), existing.orgId, "admin");

  const [updated] = await db
    .update(schema.monitors)
    .set(c.req.valid("json"))
    .where(eq(schema.monitors.id, id))
    .returning();
  return c.json(updated);
});

monitors.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.monitors.findFirst({ where: eq(schema.monitors.id, id) });
  if (!existing) throw new HTTPException(404, { message: "Monitor not found" });

  await requireMembership(c.get("userId"), existing.orgId, "admin");

  await db.delete(schema.monitors).where(eq(schema.monitors.id, id));
  return c.body(null, 204);
});
