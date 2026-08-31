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

  it("separates liveness from database readiness", async () => {
    const { createHealth } = await import("./routes/health.js");
    const unavailable = createHealth(async () => {
      throw new Error("database unavailable");
    });
    expect((await unavailable.request("/live")).status).toBe(200);
    expect((await unavailable.request("/ready")).status).toBe(503);

    const available = createHealth(async () => undefined);
    expect((await available.request("/ready")).status).toBe(200);
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

  it("rejects unauthenticated access to alert channels", async () => {
    const res = await app.request("/alert-channels?orgId=00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
  });

  it("rejects alert channels with an invalid config for their type", async () => {
    const { signToken } = await import("./lib/tokens.js");
    const token = await signToken("00000000-0000-0000-0000-000000000001", "access");
    const res = await app.request("/alert-channels", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        orgId: "00000000-0000-0000-0000-000000000000",
        type: "slack",
        config: { webhookUrl: "not-a-url" },
      }),
    });
    expect(res.status).toBe(400);
  });
});
