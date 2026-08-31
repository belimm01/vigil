import { beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";

let app: Hono;

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgres://vigil:vigil@localhost:5432/vigil";
  process.env.JWT_SECRET ??= "test-secret-value-1234567890";
  const { createApp } = await import("./app.js");
  app = createApp();
});

describe("api app", () => {
  it("serves the health endpoint", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const res = await app.request("/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("rejects unauthenticated access to monitors", async () => {
    const res = await app.request("/monitors?orgId=00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
  });

  it("rejects malformed registration payloads", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    });
    expect(res.status).toBe(400);
  });
});
