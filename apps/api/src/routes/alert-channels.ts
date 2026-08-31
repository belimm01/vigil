import { zValidator } from "@hono/zod-validator";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { requireMembership } from "../lib/authz.js";
import { requireAuth, type AuthVars } from "../middleware/auth.js";

const orgId = z.string().uuid();

const createBody = z.discriminatedUnion("type", [
  z.object({ orgId, type: z.literal("slack"), config: z.object({ webhookUrl: z.string().url() }) }),
  z.object({ orgId, type: z.literal("email"), config: z.object({ to: z.string().email() }) }),
  z.object({ orgId, type: z.literal("webhook"), config: z.object({ url: z.string().url() }) }),
]);

export const alertChannels = new Hono<{ Variables: AuthVars }>();

alertChannels.use("*", requireAuth);

alertChannels.post("/", zValidator("json", createBody), async (c) => {
  const input = c.req.valid("json");
  await requireMembership(c.get("userId"), input.orgId, "admin");

  const [created] = await db
    .insert(schema.alertChannels)
    .values({ orgId: input.orgId, type: input.type, config: input.config })
    .returning();

  return c.json(created, 201);
});

alertChannels.get("/", zValidator("query", z.object({ orgId })), async (c) => {
  const { orgId } = c.req.valid("query");
  await requireMembership(c.get("userId"), orgId);

  const rows = await db
    .select()
    .from(schema.alertChannels)
    .where(eq(schema.alertChannels.orgId, orgId))
    .orderBy(asc(schema.alertChannels.id));
  return c.json(rows);
});

alertChannels.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await db.query.alertChannels.findFirst({
    where: eq(schema.alertChannels.id, id),
  });
  if (!existing) throw new HTTPException(404, { message: "Alert channel not found" });

  await requireMembership(c.get("userId"), existing.orgId, "admin");

  await db.delete(schema.alertChannels).where(eq(schema.alertChannels.id, id));
  return c.body(null, 204);
});
