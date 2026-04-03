import express, { type Express } from "express";
import fs from "fs";
import cors from "cors";
import pinoHttp from "pino-http";
import dotenv from "dotenv";
dotenv.config();

import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db, loginEventsTable } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { passport } from "./routes/auth";
import path from "path";

const PgSession = connectPgSimple(session);

// Simple in-memory session store for development/PGlite fallback
class MemorySessionStore extends session.Store {
  private sessions: Record<string, any> = {};
  
  get(sid: string, callback: (err: Error | null, session?: Express.SessionData | null) => void) {
    callback(null, this.sessions[sid] || null);
  }
  
  set(sid: string, session: Express.SessionData, callback?: (err?: Error | null) => void) {
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

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "10kb", verify: (req: any, _res: any, buf: Buffer) => { (req as any).rawBody = buf; } }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Determine which session store to use
let sessionStore: session.Store;
// Check if pool is a PostgreSQL Pool (has both query and end methods, typical of pg.Pool)
// PGlite instances will not have the typical Pool interface
if (pool && typeof pool.query === "function" && typeof pool.end === "function" && pool.constructor?.name === "Pool") {
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
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
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

// Debug endpoint to diagnose static file serving
app.get("/debug/status", (req, res) => {
  const distDir = process.env.FORUM_DIST_PATH;
  const distExists = distDir ? fs.existsSync(distDir) : false;
  const indexExists = distDir ? fs.existsSync(path.join(distDir, "index.html")) : false;
  
  let distFiles = [];
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
