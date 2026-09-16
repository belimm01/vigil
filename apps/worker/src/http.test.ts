import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { httpFetcher } from "./http.js";

const servers: Server[] = [];

async function listen(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

describe("httpFetcher", () => {
  it("forwards the method, path, headers and body and normalizes response headers", async () => {
    const received: { method?: string; url?: string; header?: string; body?: string } = {};
    const url = await listen((req, res) => {
      received.method = req.method;
      received.url = req.url;
      received.header = req.headers["x-journey"] as string;
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        received.body = Buffer.concat(chunks).toString();
        res.writeHead(201, { "X-Session": "session-value", "Content-Type": "application/json" });
        res.end('{"created":true}');
      });
    });

    const response = await httpFetcher({
      url: `${url}/checks?region=eu`,
      method: "POST",
      headers: { "content-type": "application/json", "x-journey": "checkout" },
      body: '{"name":"probe"}',
    });

    expect(received).toEqual({
      method: "POST",
      url: "/checks?region=eu",
      header: "checkout",
      body: '{"name":"probe"}',
    });
    expect(response.status).toBe(201);
    expect(response.headers["x-session"]).toBe("session-value");
    expect(response.headers).not.toHaveProperty("X-Session");
    expect(response.body).toBe('{"created":true}');
  });

  it("returns an unsuccessful HTTP response for monitor status evaluation", async () => {
    const url = await listen((_req, res) => {
      res.writeHead(503, { "Retry-After": "30" });
      res.end("temporarily unavailable");
    });

    const response = await httpFetcher({ url, method: "GET", headers: {} });

    expect(response.status).toBe(503);
    expect(response.headers["retry-after"]).toBe("30");
    expect(response.body).toBe("temporarily unavailable");
  });

  it("rejects a response whose connection closes before the body completes", async () => {
    const url = await listen((_req, res) => {
      res.writeHead(200, { "Content-Length": "100" });
      res.flushHeaders();
      const socket = res.socket;
      res.on("finish", () => socket?.destroy());
      res.end("partial");
    });

    await expect(httpFetcher({ url, method: "GET", headers: {} })).rejects.toThrow();
  });

  it.each(["headers", "body"])("aborts a request stalled before completing %s", async (stage) => {
    let received = false;
    const url = await listen((_req, res) => {
      received = true;
      if (stage === "body") {
        res.writeHead(200);
        res.flushHeaders();
        res.write("partial");
      }
    });

    await expect(httpFetcher({ url, method: "GET", headers: {} })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(received).toBe(true);
  }, 15_000);
});
