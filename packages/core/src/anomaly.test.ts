import { describe, expect, it } from "vitest";
import { classifyLatency, percentile } from "./anomaly.js";

describe("percentile", () => {
  it("returns the only value for a single-element sample", () => {
    expect(percentile([42], 95)).toBe(42);
  });

  it("computes the median", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("interpolates between neighbouring ranks", () => {
    expect(percentile([10, 20], 50)).toBe(15);
  });

  it("throws on an empty sample", () => {
    expect(() => percentile([], 95)).toThrow();
  });
});

describe("classifyLatency", () => {
  const baseline = Array.from({ length: 50 }, () => 100);

  it("reports insufficient data below the minimum sample size", () => {
    expect(classifyLatency(9999, [100, 100], { minSamples: 20 })).toBe("insufficient-data");
  });

  it("treats a latency near the baseline as normal", () => {
    expect(classifyLatency(120, baseline)).toBe("normal");
  });

  it("flags a latency far above the baseline p95 as degraded", () => {
    expect(classifyLatency(400, baseline, { factor: 1.5 })).toBe("degraded");
  });

  it("respects a custom factor", () => {
    // p95 is 100, factor 3 => threshold 300, so 250 is still normal.
    expect(classifyLatency(250, baseline, { factor: 3 })).toBe("normal");
  });
});
