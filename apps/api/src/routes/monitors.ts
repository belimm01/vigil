import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
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
