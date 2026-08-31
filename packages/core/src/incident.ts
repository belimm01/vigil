import type { CheckResult, MonitorState } from "./types.js";

export type IncidentDecision =
  | { action: "open"; cause: string }
  | { action: "resolve" }
  | { action: "none" };

const isOutage = (result: CheckResult): boolean => result.status === "down";

const describeCause = (result: CheckResult): string => {
  if (result.error) return result.error;
  if (result.httpStatus != null) return `Unexpected HTTP status ${result.httpStatus}`;
  return "Check failed";
};

/**
 * Decide how an incident should transition given the most recent check results.
 *
 * `recentResults` must be ordered newest-first. An incident opens only after
 * `failThreshold` consecutive outages, which debounces flapping monitors, and
 * resolves as soon as a single healthy result comes back.
 */
export function evaluateIncident(
  recentResults: CheckResult[],
  state: MonitorState,
): IncidentDecision {
  const latest = recentResults[0];
  if (!latest) return { action: "none" };

  if (state.openIncident) {
    return isOutage(latest) ? { action: "none" } : { action: "resolve" };
  }

  const threshold = Math.max(1, state.failThreshold);
  if (recentResults.length < threshold) return { action: "none" };

  const window = recentResults.slice(0, threshold);
  if (window.every(isOutage)) {
    return { action: "open", cause: describeCause(latest) };
  }

  return { action: "none" };
}
