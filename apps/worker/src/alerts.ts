import { formatAlert, type AlertMessage, type AlertTransition } from "@vigil/core";
import { schema, type Database } from "@vigil/db";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import type { CheckStatusApplied } from "./persist.js";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export interface Notifier {
  smtp: SmtpConfig | null;
}

export interface AlertContext {
  orgId: string;
  monitorName: string;
}

type ChannelRow = typeof schema.alertChannels.$inferSelect;

export function slackPayload(message: AlertMessage): { text: string } {
  return { text: `*${message.subject}*\n${message.text}` };
}

export function webhookPayload(
  message: AlertMessage,
  transition: AlertTransition,
  ctx: AlertContext,
): Record<string, unknown> {
  return {
    monitor: ctx.monitorName,
    transition,
    subject: message.subject,
    text: message.text,
  };
}

async function sendSlack(config: unknown, message: AlertMessage): Promise<void> {
  const { webhookUrl } = config as { webhookUrl: string };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(slackPayload(message)),
  });
  if (!res.ok) throw new Error(`Slack responded ${res.status}`);
}

async function sendWebhook(
  config: unknown,
  message: AlertMessage,
  transition: AlertTransition,
  ctx: AlertContext,
): Promise<void> {
  const { url } = config as { url: string };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(webhookPayload(message, transition, ctx)),
  });
  if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
}

async function sendEmail(config: unknown, message: AlertMessage, smtp: SmtpConfig | null): Promise<void> {
  if (!smtp) throw new Error("SMTP is not configured");
  const { to } = config as { to: string };
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transport.sendMail({ from: smtp.from, to, subject: message.subject, text: message.text });
}

async function deliver(
  channel: ChannelRow,
  message: AlertMessage,
  transition: AlertTransition,
  ctx: AlertContext,
  notifier: Notifier,
): Promise<void> {
  switch (channel.type) {
    case "slack":
      return sendSlack(channel.config, message);
    case "webhook":
      return sendWebhook(channel.config, message, transition, ctx);
    case "email":
      return sendEmail(channel.config, message, notifier.smtp);
  }
}

export async function dispatchAlerts(
  db: Database,
  ctx: AlertContext,
  applied: CheckStatusApplied,
  notifier: Notifier,
): Promise<void> {
  if (!applied.incident || applied.transition === "none") return;

  const transition: AlertTransition = applied.transition === "opened" ? "open" : "resolved";
  const message = formatAlert({
    monitorName: ctx.monitorName,
    transition,
    cause: applied.incident.cause,
    at: applied.incident.at,
  });

  const channels = await db
    .select()
    .from(schema.alertChannels)
    .where(eq(schema.alertChannels.orgId, ctx.orgId));

  for (const channel of channels) {
    const [claim] = await db
      .insert(schema.alertDeliveries)
      .values({ incidentId: applied.incident.id, channelId: channel.id, transition })
      .onConflictDoNothing()
      .returning({ id: schema.alertDeliveries.id });

    if (!claim) continue;

    try {
      await deliver(channel, message, transition, ctx, notifier);
    } catch (err) {
      await db.delete(schema.alertDeliveries).where(eq(schema.alertDeliveries.id, claim.id));
      console.error(`alert to channel ${channel.id} failed`, err);
    }
  }
}
