import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { usersTable, siteConfigTable, loginEventsTable, inviteCodesTable, inviteRequestsTable, productAccessTable, postsTable, accountChangesTable } from "@workspace/db";
import { eq, gt, and, sql } from "drizzle-orm";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { z } from "zod";

// Extend express-session to include our SSO pending data and link mode
declare module "express-session" {
  interface SessionData {
    ssoPending?: {
      provider: "google" | "discord" | "steam";
      providerId: string;
      email?: string;
      displayName?: string;
      avatarUrl?: string | null;
      suggestedUsername: string;
    };
    ssoLinkMode?: boolean;
  }
}

const router: IRouter = Router();

// ---- Rate Limiting ----
// Login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => (req.user as any)?.role === "admin", // Skip for admins
  keyGenerator: (req: any) => req.ip || "unknown",
});

// Register: 3 attempts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many registration attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => req.ip || "unknown",
});

// Forgot password: 3 attempts per hour per email
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many password reset requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const email = req.body?.email;
    return email ? `forgot:${email.toLowerCase()}` : req.ip || "unknown";
  },
});

// Reset password: 5 attempts per hour per token
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many password reset attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const token = req.body?.token;
    return token ? `reset:${token.substring(0, 8)}` : req.ip || "unknown";
  },
});

// SSO linking: 10 attempts per 15 minutes per IP
const ssoLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many SSO linking attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: any) => (req.user as any)?.role === "admin",
  keyGenerator: (req: any) => req.ip || "unknown",
});

// Invite requests: 3 per 24 hours per email
const inviteRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { error: "Too many invite requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const email = req.body?.email;
    return email ? `invite:${email.toLowerCase()}` : req.ip || "unknown";
  },
});

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        upgradeType: usersTable.upgradeType,
        upgradeExpiresAt: usersTable.upgradeExpiresAt,
        avatarUrl: usersTable.avatarUrl,
        passwordHash: usersTable.passwordHash,
        isBanned: usersTable.isBanned,
        isEmailVerified: usersTable.isEmailVerified,
        createdAt: usersTable.createdAt,
        googleId: usersTable.googleId,
        discordId: usersTable.discordId,
        steamId: usersTable.steamId,
        postCount: sql<number>`(SELECT COUNT(*)::int FROM ${postsTable} p WHERE p.author_id = ${usersTable.id})`,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (user) {
      // Fetch active products for this user
      const now = new Date();
      const activeProducts = await db
        .select()
        .from(productAccessTable)
        .where(and(eq(productAccessTable.userId, id), gt(productAccessTable.expiresAt, now)));
      
      // Attach products to user object
      (user as any).activeProducts = activeProducts.map((p: any) => {
        let tier = "premium";
        if (p.paymentRef?.startsWith("admin-assign:")) {
          tier = p.paymentRef.split(":")[1] || "premium";
        }
        return {
          productId: p.productId,
          expiresAt: p.expiresAt,
          tier,
        };
      });
    }
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// Local strategy
passport.use(
  new LocalStrategy({ usernameField: "identifier" }, async (identifier, password, done) => {
    try {
      const normalized = identifier.trim();
      const isEmail = normalized.includes("@");
      const query = isEmail
        ? eq(usersTable.email, normalized.toLowerCase())
        : eq(usersTable.username, normalized);

      const [user] = await db.select().from(usersTable).where(query).limit(1);
      if (!user || !user.passwordHash) return done(null, false, { message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: "Invalid credentials" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Google strategy (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/sso/google/callback",
        passReqToCallback: true,
      },
      async (req: any, _accessToken: any, _refreshToken: any, profile: any, done: any) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(new Error("No email from Google"));

          // Check if already linked by provider ID
          let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.id)).limit(1);
          if (user) return done(null, user);

          // If user is authenticated and in link mode, link provider to their account
          if (req.isAuthenticated && req.isAuthenticated() && req.session.ssoLinkMode) {
            const authedUser = req.user as any;
            const [updated] = await db.update(usersTable).set({ googleId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, authedUser.id)).returning();
            // Don't delete flag here - let callback handle cleanup after redirect decision
            return done(null, updated);
          }

          // Check if email matches an existing account — auto-link
          const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
          if (byEmail) {
            const [updated] = await db.update(usersTable).set({ googleId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, byEmail.id)).returning();
            return done(null, updated);
          }

          // No linked account — store pending data in session and pass a sentinel
          const baseUsername = (profile.displayName || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
          req.session.ssoPending = {
            provider: "google" as const,
            providerId: profile.id,
            email,
            displayName: profile.displayName || baseUsername,
            avatarUrl: profile.photos?.[0]?.value || null,
            suggestedUsername: `${baseUsername}${Math.floor(Math.random() * 1000)}`,
          };
          // Pass false — no user to log in yet
          return done(null, false, { message: "sso_pending" });
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// Discord strategy (only if configured)
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: process.env.DISCORD_CALLBACK_URL || "/api/auth/sso/discord/callback",
        scope: ["identify", "email"],
        passReqToCallback: true,
      } as any,
      async (req: any, _accessToken: any, _refreshToken: any, profile: any, done: any) => {
        try {
          const email = profile.email?.toLowerCase();

          // Check if already linked by provider ID
          let [user] = await db.select().from(usersTable).where(eq(usersTable.discordId, profile.id)).limit(1);
          if (user) return done(null, user);

          // If user is authenticated and in link mode, link provider to their account
          if (req.isAuthenticated && req.isAuthenticated() && req.session.ssoLinkMode) {
            const authedUser = req.user as any;
            const [updated] = await db.update(usersTable).set({ discordId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, authedUser.id)).returning();
            // Don't delete flag here - let callback handle cleanup after redirect decision
            return done(null, updated);
          }

          // Check if email matches an existing account — auto-link
          if (email) {
            const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
            if (byEmail) {
              const [updated] = await db.update(usersTable).set({ discordId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, byEmail.id)).returning();
              return done(null, updated);
            }
          }

          // No linked account — store pending data in session
          const baseUsername = (profile.username || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
          const avatarUrl = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;
          req.session.ssoPending = {
            provider: "discord" as const,
            providerId: profile.id,
            email: email || undefined,
            displayName: profile.username || baseUsername,
            avatarUrl,
            suggestedUsername: `${baseUsername}${Math.floor(Math.random() * 1000)}`,
          };
          return done(null, false, { message: "sso_pending" });
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// ---- Input validation ----
async function getSiteConfig() {
  const rows = await db.select().from(siteConfigTable);
  const config: any = {
    siteName: "Scootware Forum",
    siteDescription: "The official Scootware gaming products and tools",
    maintenanceMode: false,
    registrationMode: "open",
    requireEmailVerification: true,
    inviteRequestMode: "admin",
    inviteRequestCooldownDays: 7,
    rateLimitChangePasswordPerWindow: 5,
    rateLimitChangePasswordWindowMs: 3600000, // 1 hour
    rateLimitChangeUsernamePerWindow: 3,
    rateLimitChangeUsernameWindowMs: 86400000, // 24 hours
  };

  for (const row of rows) {
    if (row.key === "maintenanceMode" || row.key === "requireEmailVerification") {
      config[row.key] = row.value === "true";
    } else if (row.key === "inviteRequestCooldownDays" || 
               row.key === "rateLimitChangePasswordPerWindow" || 
               row.key === "rateLimitChangeUsernamePerWindow") {
      config[row.key] = Number(row.value) || 0;
    } else if (row.key === "rateLimitChangePasswordWindowMs" ||
               row.key === "rateLimitChangeUsernameWindowMs") {
      config[row.key] = Number(row.value) || 0;
    } else if (row.key === "products") {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = {};
      }
    } else {
      config[row.key] = row.value;
    }
  }

  return config;
}

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  inviteCode: z.string().min(1).max(128).optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1).max(128).optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).max(128),
}).refine((data) => !!data.identifier || !!data.email, {
  message: "Email or username is required",
  path: ["identifier"],
});

// ---- Routes ----

router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }
  const { username, email, password, inviteCode } = parse.data;

  try {
    const config = await getSiteConfig();

    if (config.maintenanceMode) {
      res.status(503).json({ error: "Registration is temporarily disabled during maintenance." });
      return;
    }

    if (config.registrationMode === "closed") {
      res.status(403).json({ error: "Registration is currently disabled." });
      return;
    }

    let inviteRecord: any = null;
    if (inviteCode && typeof inviteCode === "string") {
      const [invite] = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, inviteCode.toUpperCase())).limit(1);
      if (!invite || invite.isBanned || invite.isUsed) {
        res.status(400).json({ error: "Invalid or already used invite code." });
        return;
      }
      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        res.status(400).json({ error: "Invite code has expired." });
        return;
      }
      inviteRecord = invite;
    }

    if (config.registrationMode === "invite-only" && !inviteRecord) {
      res.status(400).json({ error: "Invite code is required for registration." });
      return;
    }

    const [existing] = await db.select().from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const [existingUsername] = await db.select().from(usersTable)
      .where(eq(usersTable.username, username)).limit(1);
    if (existingUsername) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const [user] = await db.insert(usersTable).values({
      username,
      email: email.toLowerCase(),
      passwordHash,
      emailVerificationToken: verificationToken,
      isEmailVerified: false,
    }).returning();

    if (inviteRecord) {
      await db.update(inviteCodesTable)
        .set({ isUsed: true, usedBy: user.id, usedAt: new Date() })
        .where(eq(inviteCodesTable.id, inviteRecord.id));
    }

    const emailSent = await sendVerificationEmail(user.email, verificationToken);
    if (!emailSent) {
      // Roll back the user so they can retry registration cleanly
      await db.delete(usersTable).where(eq(usersTable.id, user.id));
      res.status(500).json({ error: "Failed to send verification email. Please check your email address and try again." });
      return;
    }

    res.status(201).json({ message: "Account created. Please check your email inbox for a verification link before logging in." });
  } catch (err) {
    req.log.error({ err }, "Registration error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get('/site-config', async (_req: Request, res: Response) => {
  try {
    const cfg = await getSiteConfig();
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

router.post('/request-invite', inviteRequestLimiter, async (req: Request, res: Response) => {
  const { email, username, reason } = req.body;
  if (!email || !username) {
    res.status(400).json({ error: 'Email and username are required to request an invite' });
    return;
  }

  try {
    const config = await getSiteConfig();
    const cooldown = Number(config.inviteRequestCooldownDays) || 7;

    const fromTime = new Date(Date.now() - cooldown * 24 * 60 * 60 * 1000);
    const recent = await db.select().from(inviteRequestsTable)
      .where(and(
        eq(inviteRequestsTable.email, email.toLowerCase()),
        gt(inviteRequestsTable.createdAt, fromTime)
      ));

    if (recent.length > 0) {
      return res.status(429).json({ error: `Please wait ${cooldown} days between invite requests.` });
    }

    const newReq = await db.insert(inviteRequestsTable).values({
      email: email.toLowerCase(),
      username,
      reason: reason || null,
      status: 'pending',
    }).returning();

    if (config.inviteRequestMode === 'auto') {
      const code = crypto.randomBytes(32).toString('hex').toUpperCase().slice(0, 32);
      const [invite] = await db.insert(inviteCodesTable).values({ code, createdBy: null }).returning();
      await db.update(inviteRequestsTable).set({ status: 'approved', processedAt: new Date() }).where(eq(inviteRequestsTable.id, newReq[0].id));
      return res.json({ message: 'Invite automatically granted', inviteCode: code, invite });
    }

    return res.json({ message: 'Invite request received and pending admin approval', request: newReq[0] });
  } catch (err) {
    req.log.error({ err }, 'Invite request error');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/login", loginLimiter, async (req: Request, res: Response, next) => {
  const loginPayload = {
    identifier: typeof req.body.identifier === "string" ? req.body.identifier : (typeof req.body.email === "string" ? req.body.email : undefined),
    email: typeof req.body.email === "string" ? req.body.email : undefined,
    password: req.body.password,
  };

  const parse = loginSchema.safeParse(loginPayload);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Invalid email/username or password format" });
    return;
  }

  // Ensure passport local strategy gets identifier in body
  req.body.identifier = parse.data.identifier || parse.data.email;

  passport.authenticate("local", (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({ error: info?.message || "Invalid credentials" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: `Account banned: ${user.banReason || "Contact support"}` });
      return;
    }
    // EMAIL VERIFICATION DISABLED: Users can login immediately after registration without verifying email
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      // Record successful login
      (async function record() {
        try {
          const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
          await db.insert(loginEventsTable).values({ userId: user.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record login event");
        }
      })();

      req.session.save(async () => {
        // Fetch active products before responding
        const now = new Date();
        const activeProducts = await db
          .select()
          .from(productAccessTable)
          .where(and(eq(productAccessTable.userId, user.id), gt(productAccessTable.expiresAt, now)));
        
        // Attach products
        (user as any).activeProducts = activeProducts.map((p: any) => {
          let tier = "premium";
          if (p.paymentRef?.startsWith("admin-assign:")) {
            tier = p.paymentRef.split(":")[1] || "premium";
          }
          return {
            productId: p.productId,
            expiresAt: p.expiresAt,
            tier,
          };
        });

        res.json({ user: mapUser(user) });
      });
    });
  })(req, res, next);
});

router.post("/logout", (req: Request, res: Response, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
});

router.post("/resend-verification", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    // Always respond with success to avoid user enumeration
    if (!user || user.isEmailVerified) {
      res.json({ message: "If that email is registered and unverified, a new link has been sent." });
      return;
    }

    // Generate a fresh token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await db.update(usersTable).set({ emailVerificationToken: verificationToken }).where(eq(usersTable.id, user.id));
    await sendVerificationEmail(user.email, verificationToken);
    res.json({ message: "If that email is registered and unverified, a new link has been sent." });
  } catch (err) {
    req.log.error({ err }, "Resend verification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify-email", async (req: Request, res: Response) => {
  const token = String(req.query.token || "");
  const siteUrl = process.env.SITE_URL || "https://scootware.us";

  if (!token) {
    res.redirect(`${siteUrl}/login?verified=error&reason=missing_token`);
    return;
  }

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.emailVerificationToken, token)).limit(1);
    if (!user) {
      res.redirect(`${siteUrl}/login?verified=error&reason=invalid_token`);
      return;
    }
    await db.update(usersTable).set({
      isEmailVerified: true,
      emailVerificationToken: null,
    }).where(eq(usersTable.id, user.id));

    // Redirect to login page with success flag so the frontend can show a toast
    res.redirect(`${siteUrl}/login?verified=success`);
  } catch (err) {
    req.log.error({ err }, "Email verification error");
    res.redirect(`${siteUrl}/login?verified=error&reason=server_error`);
  }
});

router.get("/me", async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  
  try {
    // Fetch product access for this user
    const productAccess = await db.select({
      productId: productAccessTable.productId,
      expiresAt: productAccessTable.expiresAt,
    })
      .from(productAccessTable)
      .where(eq(productAccessTable.userId, (req.user as any).id));

    // Filter out expired accesses
    const now = new Date();
    const validProductAccess = productAccess.filter((p: any) => new Date(p.expiresAt) > now);

    res.json({
      ...mapUser(req.user as any),
      productAccess: validProductAccess,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Google SSO
router.get("/sso/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/sso/google/callback", (req: Request, res: Response, next) => {
  passport.authenticate("google", (err: any, user: any, info: any) => {
    if (err) return res.redirect("/?sso_error=google");
    if (!user && info?.message === "sso_pending") {
      // Session already has ssoPending data set by the strategy
      return req.session.save(() => res.redirect("/sso-create-username"));
    }
    if (!user) return res.redirect("/?sso_error=google");
    req.logIn(user, (loginErr) => {
      if (loginErr) return res.redirect("/?sso_error=google");
      (async function record() {
        try {
          const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
          await db.insert(loginEventsTable).values({ userId: user.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record login event");
        }
      })();

      req.session.save(() => {
        // Check if we were in link mode - redirect to account settings with success param
        if (req.session.ssoLinkMode) {
          delete req.session.ssoLinkMode;
          const siteUrl = process.env.SITE_URL || "";
          return res.redirect(`${siteUrl}/account?linked=google`);
        }
        const siteUrl = process.env.SITE_URL || "";
        res.redirect(`${siteUrl}/`);
      });
    });
  })(req, res, next);
});

// Discord SSO
router.get("/sso/discord", passport.authenticate("discord"));
router.get("/sso/discord/callback", (req: Request, res: Response, next) => {
  passport.authenticate("discord", (err: any, user: any, info: any) => {
    if (err) return res.redirect("/?sso_error=discord");
    if (!user && info?.message === "sso_pending") {
      return req.session.save(() => res.redirect("/sso-create-username"));
    }
    if (!user) return res.redirect("/?sso_error=discord");
    req.logIn(user, (loginErr) => {
      if (loginErr) return res.redirect("/?sso_error=discord");
      (async function record() {
        try {
          const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
          await db.insert(loginEventsTable).values({ userId: user.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record login event");
        }
      })();

      req.session.save(() => {
        // Check if we were in link mode - redirect to account settings with success param
        if (req.session.ssoLinkMode) {
          delete req.session.ssoLinkMode;
          const siteUrl = process.env.SITE_URL || "";
          return res.redirect(`${siteUrl}/account?linked=discord`);
        }
        const siteUrl = process.env.SITE_URL || "";
        res.redirect(`${siteUrl}/`);
      });
    });
  })(req, res, next);
});

// Steam SSO (OpenID - simple redirect for now)
router.get("/sso/steam", (_req, res) => {
  const realm = process.env.STEAM_REALM || "http://localhost:80";
  const returnUrl = process.env.STEAM_CALLBACK_URL || `${realm}/api/auth/sso/steam/callback`;
  const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(realm)}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  res.redirect(steamLoginUrl);
});

router.get("/sso/steam/callback", async (req: Request, res: Response) => {
  try {
    // Extract Steam ID from OpenID response
    const claimedId = String(req.query["openid.claimed_id"] || "");
    const steamId = claimedId.match(/\/id\/(\d+)$/)?.[1];
    if (!steamId) {
      res.redirect("/?sso_error=steam");
      return;
    }

    // Fetch Steam user info
    const apiKey = process.env.STEAM_API_KEY;
    if (!apiKey) {
      res.redirect("/?sso_error=steam_no_key");
      return;
    }

    const steamRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`);
    const steamData = await steamRes.json() as any;
    const player = steamData?.response?.players?.[0];
    if (!player) {
      res.redirect("/?sso_error=steam");
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.steamId, steamId)).limit(1);
    if (user) {
      // Already linked — log in directly
      req.logIn(user, (err) => {
        if (err) {
          logger.error({ err }, "Steam login error");
          res.redirect("/?sso_error=steam");
          return;
        }
        (async function record() {
          try {
            const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
            await db.insert(loginEventsTable).values({ userId: user.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
          } catch (err) {
            logger.error({ err }, "Failed to record login event");
          }
        })();

        req.session.save(() => {
          const siteUrl = process.env.SITE_URL || "";
          res.redirect(`${siteUrl}/`);
        });
      });
      return;
    }

    // If user is authenticated and in link mode, link provider to their account
    if (req.isAuthenticated && req.isAuthenticated() && req.session.ssoLinkMode) {
      const authedUser = req.user as any;
      const baseUsername = (player.personaname || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
      await db.update(usersTable).set({ steamId }).where(eq(usersTable.id, authedUser.id));
      delete req.session.ssoLinkMode;
      req.session.save(() => {
        const siteUrl = process.env.SITE_URL || "";
        res.redirect(`${siteUrl}/account?linked=steam`);
      });
      return;
    }

    // No linked account — store pending data in session
    const baseUsername = (player.personaname || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
    req.session.ssoPending = {
      provider: "steam" as const,
      providerId: steamId,
      displayName: player.personaname || baseUsername,
      avatarUrl: player.avatarmedium || null,
      suggestedUsername: `${baseUsername}${Math.floor(Math.random() * 1000)}`,
    };
    req.session.save(() => res.redirect("/sso-create-username"));
  } catch (err) {
    logger.error({ err }, "Steam callback error");
    res.redirect("/?sso_error=steam");
  }
});

// ---- SSO Linking Endpoints ----

// Get pending SSO data from session
router.get("/sso/pending", (req: Request, res: Response) => {
  const pending = req.session.ssoPending;
  if (!pending) {
    res.status(404).json({ error: "No pending SSO session" });
    return;
  }
  res.json({
    provider: pending.provider,
    displayName: pending.displayName,
    avatarUrl: pending.avatarUrl,
    suggestedUsername: pending.suggestedUsername,
    email: pending.email || null,
  });
});

// Link pending SSO to an existing account via email+password
router.post("/sso/link", ssoLinkLimiter, async (req: Request, res: Response) => {
  const pending = req.session.ssoPending;
  if (!pending) {
    res.status(400).json({ error: "No pending SSO session. Please start the SSO flow again." });
    return;
  }

  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required to link an existing account." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    // Attach SSO provider ID to the existing account
    const providerField = pending.provider === "google" ? "googleId" : pending.provider === "discord" ? "discordId" : "steamId";
    const [updated] = await db.update(usersTable).set({ [providerField]: pending.providerId }).where(eq(usersTable.id, user.id)).returning();

    // Clear pending data and log in
    delete req.session.ssoPending;
    req.logIn(updated, (err) => {
      if (err) {
        res.status(500).json({ error: "Login failed after linking." });
        return;
      }
      (async function record() {
        try {
          const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
          await db.insert(loginEventsTable).values({ userId: updated.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record login event");
        }
      })();

      req.session.save(() => {
        res.json({ user: mapUser(updated) });
      });
    });
  } catch (err) {
    req.log.error({ err }, "SSO link error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new account from pending SSO data
const ssoCreateSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().min(8).max(128).optional().or(z.literal("")),
});

router.post("/sso/create", async (req: Request, res: Response) => {
  const pending = req.session.ssoPending;
  if (!pending) {
    res.status(400).json({ error: "No pending SSO session. Please start the SSO flow again." });
    return;
  }

  const parse = ssoCreateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { username } = parse.data;
  const email = parse.data.email || undefined;
  const password = parse.data.password || undefined;

  try {
    // Check username uniqueness
    const [existingUsername] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (existingUsername) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }

    // Check email uniqueness if provided
    const finalEmail = email || `${pending.provider}_${pending.providerId}@scootware.local`;
    if (email) {
      const [existingEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
      if (existingEmail) {
        res.status(400).json({ error: "Email already registered. Try linking your existing account instead." });
        return;
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const providerField = pending.provider === "google" ? "googleId" : pending.provider === "discord" ? "discordId" : "steamId";

    const [created] = await db.insert(usersTable).values({
      username,
      email: finalEmail.toLowerCase(),
      passwordHash,
      [providerField]: pending.providerId,
      isEmailVerified: true, // SSO-verified identity
      avatarUrl: pending.avatarUrl || null,
    }).returning();

    // Clear pending data and log in
    delete req.session.ssoPending;
    req.logIn(created, (err) => {
      if (err) {
        res.status(500).json({ error: "Login failed after account creation." });
        return;
      }
      (async function record() {
        try {
          const ip = req.ip || (req.headers && req.headers["x-forwarded-for"] ? String(req.headers["x-forwarded-for"]).split(",")[0] : undefined) || req.connection?.remoteAddress || "";
          await db.insert(loginEventsTable).values({ userId: created.id, ip, userAgent: req.get ? req.get("user-agent") : undefined, eventType: "login" }).returning();
        } catch (err) {
          req.log?.error({ err }, "Failed to record login event");
        }
      })();

      req.session.save(() => {
        res.json({ user: mapUser(created) });
      });
    });
  } catch (err) {
    req.log.error({ err }, "SSO create error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Authenticated User SSO Linking Endpoints ----

// Get linked SSO providers for current user
router.get("/user/linked-providers", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = req.user as any;
  const providers: { provider: string; linked: boolean }[] = [
    { provider: "google", linked: !!user.googleId },
    { provider: "discord", linked: !!user.discordId },
    { provider: "steam", linked: !!user.steamId },
  ];

  res.json({ providers });
});

// Initiate Google SSO linking for authenticated user
router.get("/user/link-sso/google", (req: Request, res: Response, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.session.ssoLinkMode = true;
  req.session.save(() => {
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });
});

// Initiate Discord SSO linking for authenticated user
router.get("/user/link-sso/discord", (req: Request, res: Response, next) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.session.ssoLinkMode = true;
  req.session.save(() => {
    passport.authenticate("discord")(req, res, next);
  });
});

// Initiate Steam SSO linking for authenticated user
router.get("/user/link-sso/steam", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  req.session.ssoLinkMode = true;
  req.session.save(() => {
    const realm = process.env.STEAM_REALM || "http://localhost:80";
    const returnUrl = process.env.STEAM_CALLBACK_URL || `${realm}/api/auth/sso/steam/callback`;
    const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(realm)}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    res.redirect(steamLoginUrl);
  });
});

// Unlink SSO provider from authenticated user
router.post("/user/unlink-sso/:provider", async (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const provider = String(req.params.provider);
  if (!["google", "discord", "steam"].includes(provider)) {
    res.status(400).json({ error: "Invalid provider" });
    return;
  }

  try {
    const user = req.user as any;

    // Check if user has a password - if not, they can't unlink their only auth method
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (!currentUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Count linked providers
    const linkedCount = (currentUser.googleId ? 1 : 0) + (currentUser.discordId ? 1 : 0) + (currentUser.steamId ? 1 : 0) + (currentUser.passwordHash ? 1 : 0);
    
    if (linkedCount <= 1) {
      res.status(400).json({ error: "Cannot unlink your only authentication method. Please link another provider first or set a password." });
      return;
    }

    // Unlink the provider
    let updateData: any = {};
    if (provider === "google") {
      updateData = { googleId: null };
    } else if (provider === "discord") {
      updateData = { discordId: null };
    } else if (provider === "steam") {
      updateData = { steamId: null };
    }

    const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, user.id)).returning();

    res.json({ message: `Successfully unlinked ${provider}` });
  } catch (err) {
    req.log.error({ err }, "SSO unlink error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Password Reset Endpoints ----

// Request password reset - sends email with reset token
router.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase())).limit(1);
    
    // Always respond with success to avoid user enumeration attacks
    if (!user) {
      res.json({ message: "If that email exists, a password reset link has been sent." });
      return;
    }

    // Generate reset token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await db.update(usersTable).set({
      passwordResetToken: resetToken,
      passwordResetExpiresAt: expiresAt,
    }).where(eq(usersTable.id, user.id));

    // Send reset email
    const resetUrl = `${process.env.SITE_URL || "https://scootware.us"}/reset-password?token=${resetToken}`;
    const emailSent = await sendPasswordResetEmail(user.email, resetUrl);

    if (!emailSent) {
      logger.warn(`Failed to send password reset email to ${user.email}`);
    }

    res.json({ message: "If that email exists, a password reset link has been sent." });
  } catch (err) {
    req.log.error({ err }, "Forgot password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Validate password reset token
router.post("/validate-reset-token", async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ valid: false, error: "Token is required." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.passwordResetToken, token)).limit(1);

    if (!user || !user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt) < new Date()) {
      res.status(400).json({ valid: false, error: "Reset token is invalid or expired." });
      return;
    }

    res.json({ valid: true, email: user.email });
  } catch (err) {
    req.log.error({ err }, "Validate reset token error");
    res.status(500).json({ valid: false, error: "Internal server error" });
  }
});

// Reset password with token
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

router.post("/reset-password", resetPasswordLimiter, async (req: Request, res: Response) => {
  const parse = resetPasswordSchema.safeParse(req.body);
  
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { token, password } = parse.data;

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.passwordResetToken, token)).limit(1);

    if (!user || !user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt) < new Date()) {
      res.status(400).json({ error: "Reset token is invalid or expired." });
      return;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await db.update(usersTable).set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    }).where(eq(usersTable.id, user.id));

    res.json({ message: "Password reset successfully. You can now login with your new password." });
  } catch (err) {
    req.log.error({ err }, "Reset password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Change password for authenticated user (requires current password if they have one set)
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"],
});

router.post("/change-password", async (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { currentPassword, newPassword } = parse.data;
  const user = req.user as any;

  try {
    const config = await getSiteConfig();
    const maxAttempts = config.rateLimitChangePasswordPerWindow || 5;
    const windowMs = config.rateLimitChangePasswordWindowMs || 3600000;

    // Check rate limiting
    const fromTime = new Date(Date.now() - windowMs);
    const recentChanges = await db
      .select()
      .from(accountChangesTable)
      .where(
        and(
          eq(accountChangesTable.userId, user.id),
          eq(accountChangesTable.changeType, "password"),
          gt(accountChangesTable.changedAt, fromTime)
        )
      );

    if (recentChanges.length >= maxAttempts) {
      const remaining = Math.ceil((recentChanges[0].changedAt.getTime() + windowMs - Date.now()) / 1000 / 60);
      res.status(429).json({ 
        error: `Too many password change attempts. Please try again in ${remaining} minute${remaining === 1 ? "" : "s"}.`,
        retryAfter: remaining * 60
      });
      return;
    }

    // Fetch current user from DB
    const [currentUser] = await db.select().from(usersTable)
      .where(eq(usersTable.id, user.id)).limit(1);

    if (!currentUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // If user has a password, verify current password
    if (currentUser.passwordHash) {
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required" });
        return;
      }
      const passwordValid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
      if (!passwordValid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
      // Prevent using the same password
      const samePassword = await bcrypt.compare(newPassword, currentUser.passwordHash);
      if (samePassword) {
        res.status(400).json({ error: "New password must be different from current password" });
        return;
      }
    } else {
      // SSO-only user is setting password for the first time - no verification needed
      if (!newPassword) {
        res.status(400).json({ error: "New password is required" });
        return;
      }
    }

    // Hash and update new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash })
      .where(eq(usersTable.id, user.id));

    // Track the change
    await db.insert(accountChangesTable).values({
      userId: user.id,
      changeType: "password",
      newValue: null,
      oldValue: null,
    });

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper function to send password reset email


export { passport };
export default router;

function mapUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    upgradeType: user.upgradeType ?? null,
    upgradeExpiresAt: user.upgradeExpiresAt ?? null,
    activeProducts: user.activeProducts ?? [],
    avatarUrl: user.avatarUrl ?? null,
    isBanned: user.isBanned,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    postCount: user.postCount,
  };
}
