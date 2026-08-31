import { createDb, schema } from "@vigil/db";
import { loadConfig } from "../config.js";

export const db = createDb(loadConfig().DATABASE_URL);
export { schema };
