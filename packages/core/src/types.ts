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
  /** Consecutive failing results before an incident is opened. */
  failThreshold: number;
  /** The currently open incident, if any. */
  openIncident: { id: string; startedAt: Date } | null;
}
