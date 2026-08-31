import { describe, expect, it } from "vitest";
import { healthStatus } from "./health.js";

describe("worker health", () => {
  it("reports liveness independently of scheduler readiness", () => {
    const result = healthStatus(
      { startedAt: 1_000, lastSuccessfulTickAt: null, readinessMaxAgeMs: 60_000 },
      "/health/live",
      1_500,
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: "ok", uptimeMs: 500 });
  });

  it("becomes ready only after a recent successful tick", () => {
    const base = { startedAt: 1_000, readinessMaxAgeMs: 60_000 };
    expect(healthStatus({ ...base, lastSuccessfulTickAt: null }, "/health/ready", 70_000).status).toBe(503);
    expect(healthStatus({ ...base, lastSuccessfulTickAt: 69_000 }, "/health/ready", 70_000).status).toBe(200);
    expect(healthStatus({ ...base, lastSuccessfulTickAt: 1_000 }, "/health/ready", 70_000).status).toBe(503);
  });
});
