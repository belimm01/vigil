export type CheckStatus = "up" | "down" | "degraded";

export type MonitorType = "http" | "journey";

export interface Org {
  id: string;
  name: string;
  statusSlug: string | null;
  role: "owner" | "admin" | "viewer";
}

export interface Monitor {
  id: string;
  orgId: string;
  name: string;
  type: MonitorType;
  intervalSeconds: number;
  failThreshold: number;
  isActive: boolean;
  createdAt: string;
}

export interface MonitorStep {
  id: string;
  monitorId: string;
  stepOrder: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  expectedStatus: number | null;
  assertions: unknown[];
  extract: unknown[];
}

export interface MonitorDetail extends Monitor {
  steps: MonitorStep[];
}

export interface CheckResult {
  id: number;
  status: CheckStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface MonitorSummary {
  monitorId: string;
  currentStatus: CheckStatus | null;
  lastCheckedAt: string | null;
  uptime24h: number | null;
  uptime7d: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  checks24h: number;
  checks7d: number;
  openIncident: boolean;
}

export interface Incident {
  id: string;
  monitorId: string;
  monitorName: string;
  status: "open" | "resolved";
  startedAt: string;
  resolvedAt: string | null;
  cause: string | null;
}

export type AlertChannelType = "slack" | "email" | "webhook";

export interface AlertChannel {
  id: string;
  orgId: string;
  type: AlertChannelType;
  config: Record<string, string>;
}

export interface AuthResponse {
  user: { id: string; email: string };
  tokens: { accessToken: string; refreshToken: string };
}
