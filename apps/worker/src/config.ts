import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  CHECK_CONCURRENCY: z.coerce.number().int().positive().default(10),
  TICK_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid worker configuration:\n${issues}`);
  }
  return parsed.data;
}
