import type { ReactNode } from "react";
import { Icon } from "./Icon.js";
import type { CheckStatus } from "../types.js";

const statusText: Record<CheckStatus, string> = {
  up: "operational",
  down: "down",
  degraded: "degraded",
};

export function StatusBadge({ status }: { status: CheckStatus | null }) {
  if (!status) {
    return (
      <span className="badge neutral">
        <span className="dot" />
        no data
      </span>
    );
  }
  return (
    <span className={`badge ${status}`}>
      <span className="dot" />
      {statusText[status]}
    </span>
  );
}

export function Skeleton({ height = 16, width, radius }: { height?: number; width?: string; radius?: number }) {
  return (
    <div
      className="skeleton"
      style={{ height, width: width ?? "100%", borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  hint,
  action,
}: {
  icon?: "inbox" | "monitor" | "bell" | "alert";
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} className="icon" />
      <h3>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  icon?: Parameters<typeof Icon>[0]["name"];
  tone?: "up" | "down" | "degraded";
}) {
  return (
    <div className="tile">
      <div className="tile-label">
        {icon && <Icon name={icon} size={15} />}
        {label}
      </div>
      <div className={`tile-value${tone ? ` ${tone}` : ""}`}>{value}</div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}
