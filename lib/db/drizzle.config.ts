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
  console.warn("   To run migrations later, set DATABASE_URL and run:");
  console.warn("   pnpm --filter @workspace/db run push-force");
  
  // Use a dummy URL that won't try to connect in production when not needed
  // This prevents "ENOTFOUND base" errors during build-only scenarios
  process.env.DRIZZLE_SKIP_VALIDATION = "true";
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: databaseUrl ? {
    url: databaseUrl,
  } : {
    // Fallback only for local development
    // In production without DATABASE_URL, this won't be used
    url: process.env.NODE_ENV === "production" 
      ? "postgresql://localhost/scootware-dummy" // Won't connect in prod
      : "postgresql://localhost/scootware",
  },
  out: "./drizzle",
});
