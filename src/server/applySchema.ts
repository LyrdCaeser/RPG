import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import "dotenv/config";
import { closePool, query } from "./db.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDirectory, "schema.sql");

if (!process.env.DATABASE_URL) {
  console.log(
    [
      "DATABASE_URL is not set.",
      "Add DATABASE_URL as a Codex/OpenAI app environment variable or secret, then run npm run db:schema again.",
      "The schema was not applied. This is expected in development environments without database secrets."
    ].join("\n")
  );
  process.exit(0);
}

try {
  const schema = await readFile(schemaPath, "utf8");
  await query(schema);
  console.log("PostgreSQL schema applied successfully.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown schema error.";
  console.error(`Failed to apply PostgreSQL schema: ${message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
