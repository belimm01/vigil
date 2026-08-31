import { formatAlert } from "@vigil/core";
import { describe, expect, it } from "vitest";
import { slackPayload, webhookPayload } from "./alerts.js";

const at = new Date("2026-01-01T12:00:00.000Z");
const message = formatAlert({ monitorName: "API", transition: "open", cause: "boom", at });

describe("slackPayload", () => {
  it("renders the subject and text into a single Slack message", () => {
    expect(slackPayload(message)).toEqual({
      text: `*${message.subject}*\n${message.text}`,
    });
  });
});

describe("webhookPayload", () => {
  it("includes the monitor, transition and message fields", () => {
    expect(webhookPayload(message, "open", { orgId: "org-1", monitorName: "API" })).toEqual({
      monitor: "API",
      transition: "open",
      subject: message.subject,
      text: message.text,
    });
  });
});
