import type { Fetcher } from "./runner.js";

const REQUEST_TIMEOUT_MS = 10_000;

/** A Fetcher backed by the global fetch, with an abort-based timeout. */
export const httpFetcher: Fetcher = async (req) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    const body = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return { status: res.status, headers, body };
  } finally {
    clearTimeout(timer);
  }
};
