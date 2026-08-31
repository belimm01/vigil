import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "../db/client.js";
import { requireAuth, type AuthVars } from "../middleware/auth.js";

export const orgs = new Hono<{ Variables: AuthVars }>();

orgs.use("*", requireAuth);

orgs.get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.orgs.id,
      name: schema.orgs.name,
      statusSlug: schema.orgs.statusSlug,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(schema.orgs, eq(schema.memberships.orgId, schema.orgs.id))
    .where(eq(schema.memberships.userId, c.get("userId")));

  return c.json(rows);
});
