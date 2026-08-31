import { describe, expect, it, vi } from "vitest";
import { runMonitor, type Fetcher, type HttpResponse, type StepConfig } from "./runner.js";

const ok = (over: Partial<HttpResponse> = {}): HttpResponse => ({
  status: 200,
  headers: {},
  body: "",
  ...over,
});

const step = (over: Partial<StepConfig> = {}): StepConfig => ({
  url: "https://example.com",
  method: "GET",
  headers: {},
  expectedStatus: 200,
  assertions: [],
  extract: [],
  ...over,
});

const fakeClock = () => {
  let t = 0;
  return () => (t += 50);
};

describe("runMonitor", () => {
  it("reports up when the response matches expectations", async () => {
    const fetcher: Fetcher = async () => ok({ status: 200 });
    const result = await runMonitor([step()], fetcher, fakeClock());
    expect(result.status).toBe("up");
    expect(result.httpStatus).toBe(200);
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it("reports down on an unexpected status code", async () => {
    const fetcher: Fetcher = async () => ok({ status: 503 });
    const result = await runMonitor([step({ expectedStatus: 200 })], fetcher, fakeClock());
    expect(result.status).toBe("down");
    expect(result.httpStatus).toBe(503);
    expect(result.error).toContain("503");
  });

  it("reports down when a body assertion fails", async () => {
    const fetcher: Fetcher = async () => ok({ body: "nope" });
    const result = await runMonitor(
      [step({ assertions: [{ type: "bodyContains", value: "welcome" }] })],
      fetcher,
      fakeClock(),
    );
    expect(result.status).toBe("down");
    expect(result.error).toContain("welcome");
  });

  it("reports down when the request throws", async () => {
    const fetcher: Fetcher = async () => {
      throw new Error("ECONNREFUSED");
    };
    const result = await runMonitor([step()], fetcher, fakeClock());
    expect(result.status).toBe("down");
    expect(result.httpStatus).toBeNull();
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("chains steps by extracting a value and interpolating it into the next", async () => {
    const fetcher = vi.fn<Fetcher>(async (req) => {
      if (req.url.endsWith("/login")) return ok({ body: JSON.stringify({ token: "abc123" }) });
      return ok({ body: "ok" });
    });

    const steps: StepConfig[] = [
      step({ url: "https://api.test/login", extract: [{ name: "token", from: "json", path: "token" }] }),
      step({ url: "https://api.test/me", headers: { authorization: "Bearer {{token}}" } }),
    ];

    const result = await runMonitor(steps, fetcher, fakeClock());
    expect(result.status).toBe("up");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]![0].headers.authorization).toBe("Bearer abc123");
  });
});
