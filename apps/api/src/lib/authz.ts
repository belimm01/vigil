import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/client.js";

export type Role = "owner" | "admin" | "viewer";

const rank: Record<Role, number> = { viewer: 0, admin: 1, owner: 2 };

export async function requireMembership(
  userId: string,
  orgId: string,
  min: Role = "viewer",
): Promise<Role> {
  const membership = await db.query.memberships.findFirst({
    where: and(eq(schema.memberships.userId, userId), eq(schema.memberships.orgId, orgId)),
  });

  if (!membership) {
    throw new HTTPException(403, { message: "Not a member of this organization" });
  }
  if (rank[membership.role] < rank[min]) {
    throw new HTTPException(403, { message: "Insufficient role" });
  }
  return membership.role;
}
