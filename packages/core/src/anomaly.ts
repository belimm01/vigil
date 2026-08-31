export interface AnomalyOptions {
  /** Minimum baseline samples required before we trust the baseline. */
  minSamples?: number;
  /** How far above the baseline p95 a latency must sit to count as degraded. */
  factor?: number;
}

export type LatencyVerdict = "normal" | "degraded" | "insufficient-data";

/** Linear-interpolated percentile of an unsorted numeric sample. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("percentile requires a non-empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const weight = rank - lo;
  return sorted[lo]! * (1 - weight) + sorted[hi]! * weight;
}

/**
 * Classify a latency against a trailing baseline. A response can be perfectly
 * healthy (HTTP 200) yet still be "degraded" if it is much slower than usual.
 */
export function classifyLatency(
  currentMs: number,
  baselineMs: number[],
  options: AnomalyOptions = {},
): LatencyVerdict {
  const minSamples = options.minSamples ?? 20;
  const factor = options.factor ?? 1.5;

  if (baselineMs.length < minSamples) return "insufficient-data";

  const threshold = percentile(baselineMs, 95) * factor;
  return currentMs > threshold ? "degraded" : "normal";
}
