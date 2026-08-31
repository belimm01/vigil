import { createDb } from "@vigil/db";
import type { Notifier } from "./alerts.js";
import { loadConfig } from "./config.js";
import { startHealthServer, type WorkerHealth } from "./health.js";
import { httpFetcher } from "./http.js";
import { tick } from "./scheduler.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

const notifier: Notifier = {
  smtp:
    config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS && config.SMTP_FROM
      ? {
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          pass: config.SMTP_PASS,
          from: config.SMTP_FROM,
        }
      : null,
};

console.log("vigil worker started");

const health: WorkerHealth = {
  startedAt: Date.now(),
  lastSuccessfulTickAt: null,
  readinessMaxAgeMs: Math.max(60_000, config.TICK_INTERVAL_MS * 3),
};
startHealthServer(config.HEALTH_PORT, health);

const runTick = async () => {
  try {
    const ran = await tick(db, httpFetcher, config.CHECK_CONCURRENCY, notifier);
    health.lastSuccessfulTickAt = Date.now();
    if (ran > 0) console.log(`ran ${ran} check(s)`);
  } catch (err) {
    console.error("tick failed", err);
  }
};

await runTick();
setInterval(runTick, config.TICK_INTERVAL_MS);
