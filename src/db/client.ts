import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/* Runtime queries use POSTGRES_URL (PgBouncer-pooled on port 6543 via Supabase).
   Migrations use POSTGRES_URL_NON_POOLING — see drizzle.config.ts. */
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL is not set");
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
