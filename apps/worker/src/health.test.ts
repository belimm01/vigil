import { describe, expect, it } from "vitest";
import { healthStatus } from "./health.js";

describe("worker health", () => {
  it("reports liveness independently of scheduler readiness", () => {
    const result = healthStatus({ startedAt: 1_000, lastSuccessfulTickAt: null }, "/health/live", 1_500);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok", uptimeMs: 500 });
  });

  it("becomes ready only after a successful tick", () => {
    expect(healthStatus({ startedAt: 1_000, lastSuccessfulTickAt: null }, "/health/ready").status).toBe(503);
    expect(healthStatus({ startedAt: 1_000, lastSuccessfulTickAt: 2_000 }, "/health/ready").status).toBe(200);
  });
});
