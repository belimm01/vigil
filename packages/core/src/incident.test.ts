import { describe, expect, it } from "vitest";
import { evaluateIncident } from "./incident.js";
import type { CheckResult, MonitorState } from "./types.js";

const result = (over: Partial<CheckResult> = {}): CheckResult => ({
  status: "up",
  httpStatus: 200,
  latencyMs: 120,
  error: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const down = (error: string | null = null): CheckResult =>
  result({ status: "down", httpStatus: error ? null : 500, error });

const state = (over: Partial<MonitorState> = {}): MonitorState => ({
  failThreshold: 3,
  openIncident: null,
  ...over,
});

describe("evaluateIncident", () => {
  it("does nothing when there are no results", () => {
    expect(evaluateIncident([], state())).toEqual({ action: "none" });
  });

  it("does not open before the failure threshold is reached", () => {
    const results = [down(), down()];
    expect(evaluateIncident(results, state({ failThreshold: 3 }))).toEqual({ action: "none" });
  });

  it("opens an incident after consecutive failures reach the threshold", () => {
    const results = [down("connection refused"), down(), down()];
    expect(evaluateIncident(results, state({ failThreshold: 3 }))).toEqual({
      action: "open",
      cause: "connection refused",
    });
  });

  it("does not open when the failure run is broken by a healthy result", () => {
    const results = [down(), result(), down()];
    expect(evaluateIncident(results, state({ failThreshold: 3 }))).toEqual({ action: "none" });
  });

  it("resolves an open incident as soon as a healthy result returns", () => {
    const results = [result(), down(), down(), down()];
    const open = state({ openIncident: { id: "inc-1", startedAt: new Date() } });
    expect(evaluateIncident(results, open)).toEqual({ action: "resolve" });
  });

  it("keeps an open incident open while the latest result is still down", () => {
    const results = [down(), down()];
    const open = state({ openIncident: { id: "inc-1", startedAt: new Date() } });
    expect(evaluateIncident(results, open)).toEqual({ action: "none" });
  });

  it("does not treat a degraded result as an outage", () => {
    const results = [result({ status: "degraded" }), result({ status: "degraded" }), result({ status: "degraded" })];
    expect(evaluateIncident(results, state({ failThreshold: 3 }))).toEqual({ action: "none" });
  });

  it("falls back to the http status when no error message is present", () => {
    const results = [down(), down(), down()];
    expect(evaluateIncident(results, state({ failThreshold: 3 }))).toEqual({
      action: "open",
      cause: "Unexpected HTTP status 500",
    });
  });
});
