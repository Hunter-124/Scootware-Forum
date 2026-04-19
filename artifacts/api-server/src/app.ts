import express, { type Express } from "express";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import dotenv from "dotenv";
dotenv.config();

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db, loginEventsTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { passport } from "./routes/auth";
import { xssProtection } from "./lib/xss-protection";
import path from "path";

const PgSession = connectPgSimple(session);

// Simple in-memory session store for development/PGlite fallback
class MemorySessionStore extends session.Store {
  private sessions: Record<string, any> = {};
  
  get(sid: string, callback: (err: Error | null, session?: any | null) => void) {
    callback(null, this.sessions[sid] || null);
  }
  
  set(sid: string, session: any, callback?: (err?: Error | null) => void) {
    this.sessions[sid] = session;
    callback?.();
  }
  
  destroy(sid: string, callback?: (err?: Error | null) => void) {
    delete this.sessions[sid];
    callback?.();
  }
}

const app: Express = express();

// Trust reverse proxies so `req.protocol` and `req.secure` reflect the
// original client request (useful when TLS is terminated at a proxy).
// Use `true` to trust the chain of proxies (safer when behind CDNs/load-balancers).
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security: Add helmet.js for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://cloudflareinsights.com", "https://static.cloudflareinsights.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
    },
  },
}));

// CORS configuration
const allowedOriginsString = process.env.ALLOWED_ORIGINS;
let allowedOrigins: string[] = [
  process.env.SITE_URL || "https://scootware.us",
  process.env.FRONTEND_URL || "https://scootware.us",
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean) as string[];

if (allowedOriginsString) {
  try {
    const parsed = JSON.parse(allowedOriginsString);
    if (Array.isArray(parsed)) {
      allowedOrigins = [...new Set([...allowedOrigins, ...parsed])];
    }
  } catch (err) {
    logger.error({ err, allowedOriginsString }, "Failed to parse ALLOWED_ORIGINS environment variable as JSON");
  }
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(allowed => {
      if ((allowed as string).includes("*")) {
        const pattern = (allowed as string).replace("*", ".*");
        return new RegExp(pattern).test(origin);
      }
      return origin === allowed;
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn({ origin }, "CORS request blocked");
      callback(new Error("CORS not allowed"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

// Increase body size limits to allow large file uploads (1GB)
// Note: multer is used for file uploads with more granular limits per route

app.use(express.json({ 
  limit: "1gb",
  verify: (req: any, res, buf, encoding) => {
    // Capture raw body for diagnostics
    req.rawBody = buf.toString((encoding as BufferEncoding) || 'utf-8');
  }
}));
app.use(express.urlencoded({ extended: true, limit: "1gb" }));

// Security: Add XSS protection middleware to sanitize user input
app.use(xssProtection);


// Security: Require SESSION_SECRET to be set
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  logger.error(
    "SESSION_SECRET environment variable is not set! " +
    "Sessions will be insecure. Set SESSION_SECRET to a random 32-byte hex string. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is required in production. " +
      "Generate a secure secret and set it as an environment variable."
    );
  }
}


// Support for loader/API clients that can't handle cookies: 
// extract session ID from Authorization header, X-Session-ID header, or query params
app.use(async (req: any, res, next) => {
  const authHeader = req.headers.authorization;
  const xSid = req.headers["x-session-id"];
  const userAgent = req.headers["user-agent"];

  // Check headers first, then common query parameters used by loaders/clients
  let sid = (typeof xSid === "string" ? xSid : undefined) 
    || (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : (authHeader && authHeader !== "undefined" ? authHeader : undefined))
    || (req.query.sid as string)
    || (req.query.token as string)
    || (req.query.session as string)
    || (req.query.session_id as string);

  // IP-based session recovery fallback for ScootwareLoader
  if (!sid && userAgent === "ScootwareLoader/1.0" && pool) {
    try {
      // Use CF-Connecting-IP if available, otherwise req.ip
      let clientIp = (req.headers["cf-connecting-ip"] as string) || req.ip;
      
      // Normalize IPv6 mapped IPv4
      if (clientIp && clientIp.startsWith("::ffff:")) {
        clientIp = clientIp.substring(7);
      }
      
      // Find latest successful login with a session from this IP in last 60 mins
      const result = await pool.query(
        "SELECT session_id FROM login_events WHERE ip = $1 AND user_agent = $2 AND session_id IS NOT NULL AND created_at > NOW() - INTERVAL '60 minutes' ORDER BY created_at DESC LIMIT 1",
        [clientIp, userAgent]
      );
      if (result.rows && result.rows.length > 0) {
        sid = result.rows[0].session_id;
        logger.info({ ip: clientIp, sid: sid.substring(0, 8) }, "IP-based session recovery successful");
      }
    } catch (err) {
      logger.error({ err }, "IP-based session recovery failed");
    }
  }

  // Log all requests to /api/products to debug loader auth
  if (req.url && req.url.includes("/products/")) {
    logger.info({
      url: req.url,
      headers: req.headers,
      query: req.query,
      sidFound: !!sid
    }, "VERBOSE Loader session middleware check");
  }

  if (sid && sid !== "undefined" && sid !== "null" && (!req.headers.cookie || !req.headers.cookie.includes("connect.sid"))) {
    // If the SID is not signed (doesn't start with s:), sign it so express-session accepts it
    if (!sid.startsWith("s:")) {
      const secret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(sid)
        .digest("base64")
        .replace(/\=+$/, "");
      sid = `s:${sid}.${signature}`;
    }
    
    const cookieStr = `connect.sid=${sid}`;
    req.headers.cookie = req.headers.cookie ? `${cookieStr}; ${req.headers.cookie}` : cookieStr;
    
    if (req.url && req.url.includes("/products/")) {
      logger.info({ cookieSet: cookieStr.substring(0, 50) }, "Loader session cookie injected");
    }
  }
  next();
});

let sessionStore: session.Store;
// Check if pool is a PostgreSQL Pool (has both query and end methods, typical of pg.Pool)
if (pool && typeof pool.query === "function" && typeof pool.end === "function") {
  // PostgreSQL Pool - use PgSession
  sessionStore = new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true,
  });
} else {
  // PGlite or fallback - use memory session store
  sessionStore = new MemorySessionStore();
}

app.use(
  session({
    store: sessionStore,
    secret: sessionSecret || "dev-secret-do-not-use-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      // For reverse proxy (Nginx): must allow HTTP cookies
      // Nginx handles HTTPS, proxies to localhost:3000 (HTTP)
      // Express sees X-Forwarded-Proto to detect original protocol
      secure: false,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded avatars
app.use("/uploads", express.static(path.resolve("uploads")));

// Serve frontend static files
const forumDistPath = process.env.FORUM_DIST_PATH;
if (forumDistPath && fs.existsSync(forumDistPath)) {
  app.use(express.static(forumDistPath));
  // Catch-all: serve index.html for client-side routing (except API and uploads)
  app.get(/^\/(?!api|uploads|debug).*/, (req, res) => {
    res.sendFile(path.join(forumDistPath, "index.html"));
  });
}

// Record guest IP on first API request (creates a session when needed)
app.use("/api", async (req: any, res: any, next: any) => {
  try {
    // Only log for unauthenticated visitors and only once per session
    const isAuthed = req.isAuthenticated && req.isAuthenticated();
    if (!isAuthed) {
      if (!req.session?.guestIpLogged) {
        const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
        try {
          await db.insert(loginEventsTable).values({ userId: null, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "guest" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record guest login event");
        }
        // Flag the session so we don't duplicate
        if (req.session) {
          req.session.guestIpLogged = true;
          req.session.save(() => next());
          return;
        }
      }
    }
  } catch (err) {
    // ignore logging failures
  }
  next();
});

app.use("/api", router);

// Error handling middleware for multer and other errors
app.use((err: any, req: any, res: any, next: any) => {
  // Handle JSON parse errors specifically
  if (err instanceof SyntaxError && 'body' in err && req.url?.includes('/api/admin/config')) {
    req.log?.error({ err, url: req.url, method: req.method, contentType: req.get('content-type'), rawBody: (req as any).rawBody }, "JSON parse error on config endpoint");
    return res.status(400).json({ 
      error: "Invalid JSON in request body",
      details: "The request body must be valid JSON with quoted property names and string values",
      received: (req as any).rawBody ? (req as any).rawBody.substring(0, 200) : "unknown"
    });
  }
  
  // Handle other JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    req.log?.error({ err }, "JSON parse error");
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  req.log?.error({ err, code: err.code, message: err.message }, "Request error");
  
  // Don't try to send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  // Handle multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large" });
  }
  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({ error: "Too many files" });
  }
  if (err.code === "LIMIT_FIELD_COUNT") {
    return res.status(413).json({ error: "Too many fields" });
  }
  if (err.code === "LIMIT_PARTS") {
    return res.status(413).json({ error: "Too many parts" });
  }
  
  // Handle file validation errors
  if (err.message && err.message.includes("is not an .exe file")) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes(".exe")) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes("allowed")) {
    return res.status(400).json({ error: err.message });
  }
  
  // Default error response - always return JSON
  const statusCode = err.status || err.statusCode || 500;
  const errorMessage = process.env.NODE_ENV !== "production" ? err.message : "Internal server error";
  
  res.status(statusCode).json({ 
    error: errorMessage,
    code: err.code || undefined
  });
});

// Debug endpoint to diagnose static file serving
app.get("/debug/status", (req, res) => {
  const distDir = process.env.FORUM_DIST_PATH;
  const distExists = distDir ? fs.existsSync(distDir) : false;
  const indexExists = distDir ? fs.existsSync(path.join(distDir, "index.html")) : false;
  
  let distFiles: string[] = [];
  try {
    if (distDir && distExists) {
      distFiles = fs.readdirSync(distDir).slice(0, 10);
    }
  } catch (err) {
    distFiles = [String(err)];
  }

  res.json({
    env: process.env.NODE_ENV,
    forumDistPath: distDir,
    pathExists: distExists,
    indexExists: indexExists,
    filesInDir: distFiles,
    cwd: process.cwd(),
  });
});

export default app;
