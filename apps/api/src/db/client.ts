import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadConfig } from "../config.js";
import * as schema from "./schema.js";

const { DATABASE_URL } = loadConfig();

const queryClient = postgres(DATABASE_URL);

export const db = drizzle(queryClient, { schema });
export { schema };
