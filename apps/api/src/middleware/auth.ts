import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { verifyToken } from "../lib/tokens.js";

export interface AuthVars {
  userId: string;
}

export const requireAuth = createMiddleware<{ Variables: AuthVars }>(async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing bearer token" });
  }

  try {
    const claims = await verifyToken(header.slice(7), "access");
    c.set("userId", claims.sub);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  await next();
});
