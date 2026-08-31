import { relations } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  statusSlug: text("status_slug").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "viewer"] }).notNull(),
  },
  (t) => ({
    pk: unique().on(t.orgId, t.userId),
  }),
);

export const monitors = pgTable(
  "monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["http", "journey"] }).notNull(),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    failThreshold: integer("fail_threshold").notNull().default(3),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byOrg: index("monitors_org_idx").on(t.orgId),
  }),
);

export const monitorSteps = pgTable(
  "monitor_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    stepOrder: integer("step_order").notNull(),
    url: text("url").notNull(),
    method: text("method").notNull().default("GET"),
    headers: jsonb("headers").notNull().default({}),
    body: jsonb("body"),
    expectedStatus: integer("expected_status").default(200),
    assertions: jsonb("assertions").notNull().default([]),
    extract: jsonb("extract").notNull().default([]),
  },
  (t) => ({
    order: unique("monitor_steps_order_uq").on(t.monitorId, t.stepOrder),
  }),
);

export const checkResults = pgTable(
  "check_results",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["up", "down", "degraded"] }).notNull(),
    httpStatus: integer("http_status"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMonitorTime: index("check_results_monitor_time_idx").on(t.monitorId, t.createdAt),
  }),
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["open", "resolved"] }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cause: text("cause"),
  },
  (t) => ({
    byMonitor: index("incidents_monitor_idx").on(t.monitorId),
  }),
);

export const alertChannels = pgTable("alert_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["email", "slack", "webhook"] }).notNull(),
  config: jsonb("config").notNull(),
});

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
    transition: text("transition", { enum: ["open", "resolved"] }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    once: unique("alert_deliveries_once_uq").on(t.incidentId, t.channelId, t.transition),
  }),
);

export const uptimeDaily = pgTable(
  "uptime_daily",
  {
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    checksTotal: integer("checks_total").notNull(),
    checksUp: integer("checks_up").notNull(),
    p95Latency: integer("p95_latency"),
  },
  (t) => ({
    pk: unique("uptime_daily_pk").on(t.monitorId, t.day),
  }),
);

export const orgsRelations = relations(orgs, ({ many }) => ({
  memberships: many(memberships),
  monitors: many(monitors),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  org: one(orgs, { fields: [monitors.orgId], references: [orgs.id] }),
  steps: many(monitorSteps),
  incidents: many(incidents),
}));

export const monitorStepsRelations = relations(monitorSteps, ({ one }) => ({
  monitor: one(monitors, { fields: [monitorSteps.monitorId], references: [monitors.id] }),
}));
