import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { requireMembership } from "../lib/authz.js";
import { requireAuth, type AuthVars } from "../middleware/auth.js";

const listQuery = z.object({
  orgId: z.string().uuid(),
  monitorId: z.string().uuid().optional(),
});

export const incidents = new Hono<{ Variables: AuthVars }>();

incidents.use("*", requireAuth);

incidents.get("/", zValidator("query", listQuery), async (c) => {
  const { orgId, monitorId } = c.req.valid("query");
  await requireMembership(c.get("userId"), orgId);

  const conditions = [eq(schema.monitors.orgId, orgId)];
  if (monitorId) conditions.push(eq(schema.incidents.monitorId, monitorId));

  const rows = await db
    .select({
      id: schema.incidents.id,
      monitorId: schema.incidents.monitorId,
      monitorName: schema.monitors.name,
      status: schema.incidents.status,
      startedAt: schema.incidents.startedAt,
      resolvedAt: schema.incidents.resolvedAt,
      cause: schema.incidents.cause,
    })
    .from(schema.incidents)
    .innerJoin(schema.monitors, eq(schema.incidents.monitorId, schema.monitors.id))
    .where(and(...conditions))
    .orderBy(desc(schema.incidents.startedAt));

  return c.json(rows);
});
