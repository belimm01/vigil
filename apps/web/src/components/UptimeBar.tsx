import type { CheckResult } from "../types.js";
import { formatDateTime, formatLatency } from "../lib/format.js";

export function UptimeBar({ results, max = 60 }: { results: CheckResult[]; max?: number }) {
  const slots = [...results].slice(0, max).reverse();

  if (slots.length === 0) {
    return (
      <div className="uptimebar" aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className="slot" />
        ))}
      </div>
    );
  }

  return (
    <div className="uptimebar" role="img" aria-label={`Recent status across ${slots.length} checks`}>
      {slots.map((r) => (
        <div
          key={r.id}
          className={`slot ${r.status}`}
          title={`${formatDateTime(r.createdAt)} · ${r.status} · ${formatLatency(r.latencyMs)}`}
        />
      ))}
    </div>
  );
}
