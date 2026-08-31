import { describe, expect, it } from "vitest";
import { formatAlert } from "./alert.js";

const at = new Date("2026-01-01T12:00:00.000Z");

describe("formatAlert", () => {
  it("describes an opened incident with its cause", () => {
    const message = formatAlert({
      monitorName: "API",
      transition: "open",
      cause: "Unexpected HTTP status 503",
      at,
    });
    expect(message.subject).toBe("[Vigil] API is DOWN");
    expect(message.text).toContain("went down at 2026-01-01T12:00:00.000Z");
    expect(message.text).toContain("Cause: Unexpected HTTP status 503");
  });

  it("omits the cause clause when none is given", () => {
    const message = formatAlert({ monitorName: "API", transition: "open", at });
    expect(message.text).not.toContain("Cause:");
  });

  it("describes a resolved incident", () => {
    const message = formatAlert({ monitorName: "API", transition: "resolved", at });
    expect(message.subject).toBe("[Vigil] API has recovered");
    expect(message.text).toContain("recovered at 2026-01-01T12:00:00.000Z");
  });
});
