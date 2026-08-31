import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.js";

export { schema };
export * from "./schema.js";

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  const client = postgres(url);
  return drizzle(client, { schema });
}

export async function runMigrations(url: string): Promise<void> {
  const folder = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
  } finally {
    await client.end();
  }
}
