import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

/* Lazy initialization: Next.js evaluates this module during build-time page-data
   collection, before runtime env vars are available. Throwing at module load breaks
   CI (where POSTGRES_URL is intentionally absent). Defer until first query.
   Runtime uses POSTGRES_URL (PgBouncer-pooled, port 6543); migrations use
   POSTGRES_URL_NON_POOLING — see drizzle.config.ts. */
let instance: Db | undefined;

function create(): Db {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "POSTGRES_URL is not set. Run `vercel env pull .env.local` or set it in the environment.",
    );
  }
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop: string | symbol) {
    instance ??= create();
    return Reflect.get(instance, prop);
  },
});
