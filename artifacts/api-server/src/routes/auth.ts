import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as DiscordStrategy } from "passport-discord";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendVerificationEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { z } from "zod";

const router: IRouter = Router();

// ---- Passport setup ----

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    done(null, user || null);
  } catch (err) {
    done(err, null);
  }
});

// Local strategy
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
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
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(new Error("No email from Google"));

          let [user] = await db.select().from(usersTable).where(eq(usersTable.googleId, profile.id)).limit(1);
          if (!user) {
            const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
            if (byEmail) {
              const [updated] = await db.update(usersTable).set({ googleId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, byEmail.id)).returning();
              user = updated;
            } else {
              const baseUsername = (profile.displayName || email.split("@")[0]).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
              const uniqueUsername = `${baseUsername}${Math.floor(Math.random() * 1000)}`;
              const [created] = await db.insert(usersTable).values({
                email,
                username: uniqueUsername,
                googleId: profile.id,
                isEmailVerified: true,
                avatarUrl: profile.photos?.[0]?.value || null,
              }).returning();
              user = created;
            }
          }
          return done(null, user);
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
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.email?.toLowerCase();
          if (!email) return done(new Error("No email from Discord"));

          let [user] = await db.select().from(usersTable).where(eq(usersTable.discordId, profile.id)).limit(1);
          if (!user) {
            const [byEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
            if (byEmail) {
              const [updated] = await db.update(usersTable).set({ discordId: profile.id, isEmailVerified: true }).where(eq(usersTable.id, byEmail.id)).returning();
              user = updated;
            } else {
              const baseUsername = profile.username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
              const uniqueUsername = `${baseUsername}${Math.floor(Math.random() * 1000)}`;
              const avatarUrl = profile.avatar
                ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
                : null;
              const [created] = await db.insert(usersTable).values({
                email,
                username: uniqueUsername,
                discordId: profile.id,
                isEmailVerified: true,
                avatarUrl,
              }).returning();
              user = created;
            }
          }
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

// ---- Input validation ----
const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

// ---- Routes ----

router.post("/register", async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }
  const { username, email, password } = parse.data;

  try {
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

    await sendVerificationEmail(user.email, verificationToken);

    const safeUser = mapUser(user);
    req.logIn(user, (err) => {
      if (err) {
        req.log.error({ err }, "Login after register failed");
      }
    });

    res.status(201).json({ user: safeUser, message: "Account created. Please check your email to verify your account." });
  } catch (err) {
    req.log.error({ err }, "Registration error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", (req: Request, res: Response, next) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid email or password format" });
    return;
  }

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
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.json({ user: mapUser(user) });
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

router.get("/verify-email", async (req: Request, res: Response) => {
  const token = String(req.query.token || "");
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.emailVerificationToken, token)).limit(1);
    if (!user) {
      res.status(400).json({ error: "Invalid or expired verification token" });
      return;
    }
    await db.update(usersTable).set({
      isEmailVerified: true,
      emailVerificationToken: null,
    }).where(eq(usersTable.id, user.id));

    res.json({ message: "Email verified successfully! You can now log in." });
  } catch (err) {
    req.log.error({ err }, "Email verification error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(mapUser(req.user as any));
});

// Google SSO
router.get("/sso/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/sso/google/callback", passport.authenticate("google", { failureRedirect: "/?sso_error=google" }), (req, res) => {
  res.redirect("/");
});

// Discord SSO
router.get("/sso/discord", passport.authenticate("discord"));
router.get("/sso/discord/callback", passport.authenticate("discord", { failureRedirect: "/?sso_error=discord" }), (req, res) => {
  res.redirect("/");
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
    if (!user) {
      const baseUsername = player.personaname.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 28) || "user";
      const uniqueUsername = `${baseUsername}${Math.floor(Math.random() * 1000)}`;
      const [created] = await db.insert(usersTable).values({
        email: `steam_${steamId}@scootware.local`,
        username: uniqueUsername,
        steamId,
        isEmailVerified: true,
        avatarUrl: player.avatarmedium || null,
      }).returning();
      user = created;
    }

    req.logIn(user, (err) => {
      if (err) {
        logger.error({ err }, "Steam login error");
        res.redirect("/?sso_error=steam");
        return;
      }
      res.redirect("/");
    });
  } catch (err) {
    logger.error({ err }, "Steam callback error");
    res.redirect("/?sso_error=steam");
  }
});

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
    avatarUrl: user.avatarUrl ?? null,
    isBanned: user.isBanned,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    postCount: user.postCount,
  };
}
