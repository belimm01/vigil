import { useLayoutEffect, useRef, useState } from "react";
import type { CheckResult } from "../types.js";
import { formatDateTime, formatLatency } from "../lib/format.js";

interface Point {
  x: number;
  y: number;
  value: number;
  createdAt: string;
}

const HEIGHT = 240;
const PAD = { top: 16, right: 18, bottom: 26, left: 48 };

export function LatencyChart({ results, p95 }: { results: CheckResult[]; p95: number | null }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(680);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = [...results]
    .reverse()
    .filter((r) => r.latencyMs != null)
    .map((r) => ({ value: r.latencyMs as number, createdAt: r.createdAt }));

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <div ref={wrapRef} className="chart-wrap">
        <div className="empty" style={{ padding: "48px 0" }}>
          <p className="muted">Not enough data yet. Latency will appear after a few checks.</p>
        </div>
      </div>
    );
  }

  const maxLatency = Math.max(...data.map((d) => d.value), p95 ?? 0);
  const maxY = maxLatency <= 0 ? 1 : maxLatency * 1.15;

  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const points: Point[] = data.map((d, i) => ({ x: x(i), y: y(d.value), value: d.value, createdAt: d.createdAt }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]!.x.toFixed(1)},${PAD.top + innerH} L${points[0]!.x.toFixed(1)},${PAD.top + innerH} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ v: maxY * t, y: y(maxY * t) }));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i]!.x - px);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  };

  const active = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg
        className="chart"
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Latency over the last ${data.length} checks, p95 ${formatLatency(p95)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-area-1)" />
            <stop offset="100%" stopColor="var(--chart-area-2)" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={PAD.left} y1={t.y} x2={width - PAD.right} y2={t.y} />
            <text className="axis-label" x={PAD.left - 8} y={t.y + 3} textAnchor="end">
              {formatLatency(t.v)}
            </text>
          </g>
        ))}

        {p95 != null && p95 > 0 && (
          <g>
            <line className="ref-line" x1={PAD.left} y1={y(p95)} x2={width - PAD.right} y2={y(p95)} />
            <text className="axis-label" x={width - PAD.right} y={y(p95) - 5} textAnchor="end">
              p95 {formatLatency(p95)}
            </text>
          </g>
        )}

        <path className="area" d={areaPath} />
        <path className="line" d={linePath} />

        {active && (
          <>
            <line className="cursor-line" x1={active.x} y1={PAD.top} x2={active.x} y2={PAD.top + innerH} />
            <circle className="marker" cx={active.x} cy={active.y} r={4.5} />
          </>
        )}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{ left: `${(active.x / width) * 100}%`, top: active.y }}
        >
          <strong className="mono">{formatLatency(active.value)}</strong>
          <span className="muted"> · {formatDateTime(active.createdAt)}</span>
        </div>
      )}
    </div>
  );
}
