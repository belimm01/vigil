import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../config.js";

const { DATABASE_URL } = loadConfig();
const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

const client = postgres(DATABASE_URL, { max: 1 });
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log("migrations applied");
