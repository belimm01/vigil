import { Hono } from "hono";

export const health = new Hono();

health.get("/", (c) =>
  c.json({
    status: "ok",
    uptime: process.uptime(),
  }),
);
