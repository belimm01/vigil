import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearToken, getToken, setToken } from "./api.js";

const fetchMock = vi.fn<typeof fetch>();
let events: EventTarget;

beforeEach(() => {
  const values = new Map<string, string>();
  events = new EventTarget();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("window", events);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("dashboard API client", () => {
  it("sends unauthenticated login requests under /api and returns JSON", async () => {
    fetchMock.mockResolvedValue(Response.json({ token: "session-value" }));
    const body = JSON.stringify({ email: "reader@example.test", password: "test-password" });

    await expect(api("/auth/login", { method: "POST", body })).resolves.toEqual({
      token: "session-value",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });
    expect(getToken()).toBeNull();
  });

  it("reads the current token for each request and stops sending it after sign-out", async () => {
    fetchMock.mockImplementation(async () => Response.json([]));
    setToken("first-session");
    await api("/orgs");
    setToken("second-session");
    await api("/orgs");
    clearToken();
    await api("/orgs");

    expect(fetchMock.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { "content-type": "application/json", authorization: "Bearer first-session" },
      { "content-type": "application/json", authorization: "Bearer second-session" },
      { "content-type": "application/json" },
    ]);
    expect(getToken()).toBeNull();
  });

  it("forwards monitor mutation options and accepts empty deletion responses", async () => {
    setToken("session-value");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const controller = new AbortController();

    await expect(api("/monitors/monitor-1", {
      method: "DELETE",
      headers: { "x-request-id": "delete-monitor" },
      signal: controller.signal,
    })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/monitors/monitor-1", {
      method: "DELETE",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: "Bearer session-value",
        "x-request-id": "delete-monitor",
      },
    });
  });

  it("clears a rejected session before notifying authentication listeners", async () => {
    setToken("expired-session");
    const listener = vi.fn(() => expect(getToken()).toBeNull());
    events.addEventListener("vigil:unauthorized", listener);
    fetchMock.mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));

    await expect(api("/orgs")).rejects.toThrow("Unauthorized");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });

  it("does not emit a session-expired event for a rejected unauthenticated login", async () => {
    const listener = vi.fn();
    events.addEventListener("vigil:unauthorized", listener);
    fetchMock.mockResolvedValue(Response.json({ error: "Invalid credentials" }, { status: 401 }));

    await expect(api("/auth/login", { method: "POST" })).rejects.toThrow("Invalid credentials");
    expect(listener).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });

  it.each([
    { response: () => Response.json({ error: "Forbidden" }, { status: 403 }), message: "Forbidden" },
    { response: () => new Response("unavailable", { status: 503, statusText: "Service Unavailable" }), message: "Service Unavailable" },
    { response: () => Response.json({}, { status: 500 }), message: "Request failed" },
  ])("preserves the session on $message errors", async ({ response, message }) => {
    setToken("session-value");
    const listener = vi.fn();
    events.addEventListener("vigil:unauthorized", listener);
    fetchMock.mockResolvedValue(response());

    await expect(api("/orgs")).rejects.toThrow(message);
    expect(getToken()).toBe("session-value");
    expect(listener).not.toHaveBeenCalled();
  });

  it("propagates transport failures without clearing the session or retrying", async () => {
    setToken("session-value");
    const failure = new TypeError("Network unavailable");
    fetchMock.mockRejectedValue(failure);
    const listener = vi.fn();
    events.addEventListener("vigil:unauthorized", listener);

    await expect(api("/orgs")).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getToken()).toBe("session-value");
    expect(listener).not.toHaveBeenCalled();
  });
});
