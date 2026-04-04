import rateLimit, { type Options } from "express-rate-limit";
import { db, siteConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Default rate limit configurations (in seconds/milliseconds/requests)
 * These can be overridden in the site_config table with keys like:
 * - rateLimitLoginPerWindow
 * - rateLimitLoginWindowMs
 * - etc.
 */
const RATE_LIMIT_DEFAULTS = {
  // Login: 5 attempts per 15 minutes per IP
  login: {
    messagesPerWindow: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Register: 3 attempts per hour per IP
  register: {
    messagesPerWindow: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Forgot password: 3 attempts per hour per email (tracked via request body)
  forgotPassword: {
    messagesPerWindow: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // Reset password: 5 attempts per hour per token
  resetPassword: {
    messagesPerWindow: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  // SSO linking: 10 attempts per 15 minutes per user
  ssoLink: {
    messagesPerWindow: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  // Invite requests: 3 per day per email
  inviteRequest: {
    messagesPerWindow: 3,
    windowMs: 24 * 60 * 60 * 1000, // 1 day
  },
  // General API: 500 requests per minute per IP
  api: {
    messagesPerWindow: 500,
    windowMs: 60 * 1000, // 1 minute
  },
};

/**
 * Load rate limit config from database, falling back to defaults
 */
async function getRateLimitConfig(
  category: string
): Promise<{ messagesPerWindow: number; windowMs: number }> {
  try {
    const perWindowKey = `rateLimit${capitalize(category)}PerWindow`;
    const windowMsKey = `rateLimit${capitalize(category)}WindowMs`;

    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(
        (row: any) =>
          row.key === perWindowKey ||
          row.key === windowMsKey);

    const config = { ...RATE_LIMIT_DEFAULTS[category as keyof typeof RATE_LIMIT_DEFAULTS] };

    for (const row of rows) {
      if (row.key === perWindowKey) {
        config.messagesPerWindow = parseInt(row.value, 10);
      } else if (row.key === windowMsKey) {
        config.windowMs = parseInt(row.value, 10);
      }
    }

    return config;
  } catch (err) {
    logger.warn({ err, category }, "Failed to load rate limit config, using defaults");
    return RATE_LIMIT_DEFAULTS[category as keyof typeof RATE_LIMIT_DEFAULTS] || RATE_LIMIT_DEFAULTS.api;
  }
}

/**
 * Create a rate limiter for a specific endpoint
 */
export async function createRateLimiter(
  category: "login" | "register" | "forgotPassword" | "resetPassword" | "ssoLink" | "inviteRequest" | "api",
  options?: Partial<Options>
) {
  const config = await getRateLimitConfig(category);

  return rateLimit({
    windowMs: config.windowMs,
    max: config.messagesPerWindow,
    message: {
      error: `Too many requests, please try again later`,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skip: (req: any) => {
      // Skip rate limiting for admin users
      const user = (req as any).user as any;
      return user?.role === "admin";
    },
    keyGenerator: (req: any) => {
      // Custom key generator - use email for password reset endpoints
      if (category === "forgotPassword" || category === "inviteRequest") {
        const email = req.body?.email || req.body?.email;
        if (email) return `${category}:${email.toLowerCase()}`;
      }
      // Use IP for other endpoints
      return req.ip || "unknown";
    },
    ...options,
  });
}

/**
 * Pre-load all rate limiters (called at app startup)
 * This prevents delays on first request while config is loaded
 */
export async function preloadRateLimiters() {
  const categories = [
    "login",
    "register",
    "forgotPassword",
    "resetPassword",
    "ssoLink",
    "inviteRequest",
  ] as const;

  const limiters: Record<string, ReturnType<typeof rateLimit>> = {};

  for (const category of categories) {
    try {
      limiters[category] = await createRateLimiter(category);
      logger.info({ category }, "Preloaded rate limiter");
    } catch (err) {
      logger.error({ err, category }, "Failed to preload rate limiter");
    }
  }

  return limiters;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export { RATE_LIMIT_DEFAULTS };
