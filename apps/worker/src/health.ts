import { createServer } from "node:http";

export type WorkerHealth = {
  startedAt: number;
  lastSuccessfulTickAt: number | null;
};

export function healthStatus(state: WorkerHealth, path: string, now = Date.now()) {
  if (path === "/health/live") {
    return { status: 200, body: { status: "ok", uptimeMs: now - state.startedAt } };
  }
  if (path === "/health/ready") {
    const ready = state.lastSuccessfulTickAt !== null;
    return {
      status: ready ? 200 : 503,
      body: { status: ready ? "ready" : "starting", lastSuccessfulTickAt: state.lastSuccessfulTickAt },
    };
  }
  return { status: 404, body: { status: "not-found" } };
}

export function startHealthServer(port: number, state: WorkerHealth) {
  return createServer((request, response) => {
    const result = healthStatus(state, request.url ?? "/");
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
  }).listen(port);
}
