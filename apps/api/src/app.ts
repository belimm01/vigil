import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { alertChannels } from "./routes/alert-channels.js";
import { auth } from "./routes/auth.js";
import { health } from "./routes/health.js";
import { incidents } from "./routes/incidents.js";
import { monitors } from "./routes/monitors.js";
import { orgs } from "./routes/orgs.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());

  app.route("/health", health);
  app.route("/auth", auth);
  app.route("/orgs", orgs);
  app.route("/monitors", monitors);
  app.route("/incidents", incidents);
  app.route("/alert-channels", alertChannels);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not Found" }, 404));

  return app;
}
