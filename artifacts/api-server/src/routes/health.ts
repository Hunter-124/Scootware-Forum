import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const checkHealth = async () => {
  try {
    // Simple query to verify DB connection
    await db.execute(sql`SELECT 1`);
    return { status: "ok", database: "connected" };
  } catch (err) {
    return { status: "unhealthy", database: "disconnected", error: err instanceof Error ? err.message : String(err) };
  }
};

router.get("/healthz", async (_req, res) => {
  const health = await checkHealth();
  const data = HealthCheckResponse.parse({ status: health.status });
  res.status(health.status === "ok" ? 200 : 503).json({ ...data, ...health });
});

// Backward-compatible health check endpoint for legacy diagnose scripts
router.get("/status", async (_req, res) => {
  const health = await checkHealth();
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

// Alias for loader app health checks
router.get("/health", async (_req, res) => {
  const health = await checkHealth();
  const data = HealthCheckResponse.parse({ status: health.status });
  res.status(health.status === "ok" ? 200 : 503).json({ ...data, ...health });
});

export default router;
