import { createDb } from "@vigil/db";
import { loadConfig } from "./config.js";
import { httpFetcher } from "./http.js";
import { tick } from "./scheduler.js";

const config = loadConfig();
const db = createDb(config.DATABASE_URL);

console.log("vigil worker started");

const runTick = async () => {
  try {
    const ran = await tick(db, httpFetcher, config.CHECK_CONCURRENCY);
    if (ran > 0) console.log(`ran ${ran} check(s)`);
  } catch (err) {
    console.error("tick failed", err);
  }
};

await runTick();
setInterval(runTick, config.TICK_INTERVAL_MS);
