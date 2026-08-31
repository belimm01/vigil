import { createDb } from "@vigil/db";
import type { Notifier } from "./alerts.js";
import { loadConfig } from "./config.js";
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

const runTick = async () => {
  try {
    const ran = await tick(db, httpFetcher, config.CHECK_CONCURRENCY, notifier);
    if (ran > 0) console.log(`ran ${ran} check(s)`);
  } catch (err) {
    console.error("tick failed", err);
  }
};

await runTick();
setInterval(runTick, config.TICK_INTERVAL_MS);
