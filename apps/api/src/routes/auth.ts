import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { db, schema } from "../db/client.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { issueTokenPair, verifyToken } from "../lib/tokens.js";
import { requireAuth, type AuthVars } from "../middleware/auth.js";

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerBody = credentials.extend({
  orgName: z.string().min(1),
});

export const auth = new Hono<{ Variables: AuthVars }>();

auth.post("/register", zValidator("json", registerBody), async (c) => {
  const { email, password, orgName } = c.req.valid("json");
  const normalized = email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, normalized),
  });
  if (existing) throw new HTTPException(409, { message: "Email already registered" });

  const passwordHash = await hashPassword(password);
  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({ email: normalized, passwordHash })
      .returning();
    const [org] = await tx.insert(schema.orgs).values({ name: orgName }).returning();
    await tx.insert(schema.memberships).values({ orgId: org!.id, userId: created!.id, role: "owner" });
    return created!;
  });

  return c.json(
    { user: { id: user.id, email: user.email }, tokens: await issueTokenPair(user.id) },
    201,
  );
});

auth.post("/login", zValidator("json", credentials), async (c) => {
  const { email, password } = c.req.valid("json");
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HTTPException(401, { message: "Invalid credentials" });
  }

  return c.json({ user: { id: user.id, email: user.email }, tokens: await issueTokenPair(user.id) });
});

auth.post("/refresh", zValidator("json", z.object({ refreshToken: z.string() })), async (c) => {
  const { refreshToken } = c.req.valid("json");
  try {
    const claims = await verifyToken(refreshToken, "refresh");
    return c.json({ tokens: await issueTokenPair(claims.sub) });
  } catch {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }
});

auth.get("/me", requireAuth, async (c) => {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, c.get("userId")),
  });
  if (!user) throw new HTTPException(404, { message: "User not found" });
  return c.json({ id: user.id, email: user.email });
});
