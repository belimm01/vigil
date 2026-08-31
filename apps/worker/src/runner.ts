import type { CheckStatus } from "@vigil/core";

export type Assertion = { type: "bodyContains"; value: string };
export type Extraction = { name: string; from: "json" | "header"; path: string };

export interface StepConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  expectedStatus?: number | null;
  assertions: Assertion[];
  extract: Extraction[];
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export type Fetcher = (req: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}) => Promise<HttpResponse>;

export interface RunOutcome {
  status: CheckStatus;
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

const interpolate = (input: string, ctx: Record<string, string>): string =>
  input.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? "");

function readJsonPath(raw: string, path: string): string | undefined {
  let node: unknown;
  try {
    node = JSON.parse(raw);
  } catch {
    return undefined;
  }
  for (const key of path.split(".").filter(Boolean)) {
    if (node && typeof node === "object" && key in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return node == null ? undefined : String(node);
}

export async function runMonitor(
  steps: StepConfig[],
  fetcher: Fetcher,
  now: () => number = () => performance.now(),
): Promise<RunOutcome> {
  const context: Record<string, string> = {};
  const startedAt = now();
  const elapsed = () => Math.round(now() - startedAt);
  let lastStatus: number | null = null;

  for (const step of steps) {
    const headers = Object.fromEntries(
      Object.entries(step.headers).map(([k, v]) => [k, interpolate(v, context)]),
    );

    let res: HttpResponse;
    try {
      res = await fetcher({
        url: interpolate(step.url, context),
        method: step.method,
        headers,
        body:
          step.body == null
            ? undefined
            : interpolate(typeof step.body === "string" ? step.body : JSON.stringify(step.body), context),
      });
    } catch (err) {
      return {
        status: "down",
        httpStatus: null,
        latencyMs: elapsed(),
        error: err instanceof Error ? err.message : "Request failed",
      };
    }

    lastStatus = res.status;

    if (step.expectedStatus != null && res.status !== step.expectedStatus) {
      return {
        status: "down",
        httpStatus: res.status,
        latencyMs: elapsed(),
        error: `Expected status ${step.expectedStatus} but got ${res.status}`,
      };
    }

    for (const assertion of step.assertions) {
      if (assertion.type === "bodyContains" && !res.body.includes(assertion.value)) {
        return {
          status: "down",
          httpStatus: res.status,
          latencyMs: elapsed(),
          error: `Response body did not contain "${assertion.value}"`,
        };
      }
    }

    for (const extraction of step.extract) {
      const value =
        extraction.from === "header"
          ? res.headers[extraction.path.toLowerCase()]
          : readJsonPath(res.body, extraction.path);
      if (value !== undefined) context[extraction.name] = value;
    }
  }

  return { status: "up", httpStatus: lastStatus, latencyMs: elapsed(), error: null };
}
