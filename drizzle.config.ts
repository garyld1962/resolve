import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  throw new Error(
    "POSTGRES_URL_NON_POOLING is not set. Run `vercel env pull .env.local`.",
  );
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
