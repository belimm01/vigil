export type CheckStatus = "up" | "down" | "degraded";

export type MonitorType = "http" | "journey";

export type IncidentStatus = "open" | "resolved";

export interface CheckResult {
  status: CheckStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: Date;
}

export interface MonitorState {
  failThreshold: number;
  openIncident: { id: string; startedAt: Date } | null;
}
