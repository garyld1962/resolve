import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { projects } from "./schema";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  throw new Error("POSTGRES_URL_NON_POOLING is not set");
}

const sql = postgres(url, { prepare: false });
const db = drizzle(sql);

async function main() {
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, "resolve"))
    .limit(1);

  if (existing.length > 0) {
    console.log("✓ default project 'resolve' already exists");
    return;
  }

  await db.insert(projects).values({
    slug: "resolve",
    name: "Resolve",
    accentColor: "#10B981", // Integrity Emerald per DESIGN.md
  });
  console.log("✓ seeded default project 'resolve'");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
