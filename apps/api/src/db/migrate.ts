import { runMigrations } from "@vigil/db";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required to run migrations");
  process.exit(1);
}

await runMigrations(url);
console.log("migrations applied");
