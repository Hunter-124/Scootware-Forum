import { defineConfig } from "drizzle-kit";
import path from "path";
import { config } from "dotenv";

// Load .env files in order of precedence
config({ path: path.resolve(process.cwd(), "../../.env") });
if (process.env.NODE_ENV === "development") {
  config({ path: path.resolve(process.cwd(), "../../.env.local"), override: false });
} else if (process.env.NODE_ENV === "production") {
  config({ path: path.resolve(process.cwd(), "../../.env.production"), override: false });
}

// DATABASE_URL is optional for local development (uses PGlite)
// Required for production/migrations with PostgreSQL
const databaseUrl = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  console.warn("⚠️  DATABASE_URL not set in production mode. Database migrations will be skipped.");
  console.warn("   Make sure DATABASE_URL is set via environment variables on the VPS.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: databaseUrl ? {
    url: databaseUrl,
  } : {
    // Fallback configuration for local development - won't be used if URL is missing
    url: "postgresql://localhost/scootware",
  },
  out: "./migrations",
});
