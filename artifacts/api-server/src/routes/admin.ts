import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  siteConfigTable,
  loginEventsTable,
  inviteCodesTable,
  inviteRequestsTable,
  threadsTable,
  postsTable,
  shoutboxTable,
  shoutboxRateLimitTable,
  profilePostsTable,
  cryptoPaymentRequestsTable,
  productAccessTable,
  subscriptionExtensionsTable,
  SUBSCRIPTION_TYPES,
} from "@workspace/db";
import { eq, ilike, or, sql, desc, inArray, and, gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const PAGE_SIZE = 20;

function requireAdmin(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.use(requireAdmin);

router.get("/users", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1")));
  const search = String(req.query.search || "").trim();

  try {
    const whereClause = search
      ? or(ilike(usersTable.username, `%${search}%`), ilike(usersTable.email, `%${search}%`))
      : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(whereClause);

    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        upgradeType: usersTable.upgradeType,
        upgradeExpiresAt: usersTable.upgradeExpiresAt,
        avatarUrl: usersTable.avatarUrl,
        isBanned: usersTable.isBanned,
        isEmailVerified: usersTable.isEmailVerified,
        createdAt: usersTable.createdAt,
        postCount: sql<number>`(SELECT COUNT(*)::int FROM ${postsTable} p WHERE p.author_id = ${usersTable.id})`,
      })
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    // Fetch active products for all users
    const userIds = users.map((u: any) => u.id);
    const now = new Date();
    const activeProducts = await db
      .select()
      .from(productAccessTable)
      .where(and(inArray(productAccessTable.userId, userIds), gt(productAccessTable.expiresAt, now)));

    const productsByUserId = new Map<number, any[]>();
    for (const ap of activeProducts) {
      if (!productsByUserId.has(ap.userId)) {
        productsByUserId.set(ap.userId, []);
      }
      // Extract tier from paymentRef if admin-assigned (format: "admin-assign:tier")
      let tier = "premium";
      if (ap.paymentRef?.startsWith("admin-assign:")) {
        tier = ap.paymentRef.split(":")[1] || "premium";
      }
      productsByUserId.get(ap.userId)!.push({
        productId: ap.productId,
        expiresAt: ap.expiresAt,
        tier,
      });
    }

    res.json({
      users: users.map((u: any) => mapUser(u, productsByUserId.get(u.id) || [])),
      total: count,
      page,
      totalPages: Math.ceil(count / PAGE_SIZE),
    });
  } catch (err) {
    req.log.error({ err }, "Admin get users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const updateUserSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  role: z.enum(["user", "admin"]).optional(),
  upgradeType: z.enum(SUBSCRIPTION_TYPES as [string, ...string[]]).nullable().optional(),
  upgradeExpiresAt: z.string().datetime().nullable().optional(),
  productIds: z.array(z.string()).optional(),
  tier: z.enum(["premium", "lifetime"]).optional(),
  extend: z.boolean().optional(),
  extendDays: z.number().int().positive().optional(),
}).strict();

router.patch("/users/:userId", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parse = updateUserSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    const updates: any = {};
    if (parse.data.username !== undefined) updates.username = parse.data.username;
    if (parse.data.role !== undefined) updates.role = parse.data.role;
    if ("upgradeType" in parse.data) updates.upgradeType = parse.data.upgradeType;
    if ("upgradeExpiresAt" in parse.data) {
      updates.upgradeExpiresAt = parse.data.upgradeExpiresAt ? new Date(parse.data.upgradeExpiresAt) : null;
    }

    // Handle subscription extension
    if (parse.data.extend === true) {
      const extendDays = parse.data.extendDays || 30;
      
      // Get all active product access for this user
      const now = new Date();
      const activeAccess = await db
        .select()
        .from(productAccessTable)
        .where(and(eq(productAccessTable.userId, userId), gt(productAccessTable.expiresAt, now)));

      if (activeAccess.length > 0) {
        // Extend each product by the specified number of days
        const extensionMs = extendDays * 24 * 60 * 60 * 1000;
        
        for (const access of activeAccess) {
          const newExpiresAt = new Date(access.expiresAt.getTime() + extensionMs);
          await db
            .update(productAccessTable)
            .set({ expiresAt: newExpiresAt })
            .where(eq(productAccessTable.id, access.id!));
        }

        // Update legacy field based on first product
        const firstAccess = activeAccess[0];
        const newExpiresAt = new Date(firstAccess.expiresAt.getTime() + extensionMs);
        updates.upgradeExpiresAt = newExpiresAt;
      }
    }

    // Handle multiple product assignment (replace mode)
    if (parse.data.productIds !== undefined) {
      const productIds = parse.data.productIds;
      const tier = parse.data.tier || "premium";

      if (productIds.length === 0) {
        // Remove all product access
        await db.delete(productAccessTable).where(eq(productAccessTable.userId, userId));
        updates.upgradeType = null;
        updates.upgradeExpiresAt = null;
      } else {
        // Delete existing product access
        await db.delete(productAccessTable).where(eq(productAccessTable.userId, userId));

        // Insert new product access entries (30 day expiry) - batch insert
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const accessEntries = productIds.map(productId => ({
          userId,
          productId,
          expiresAt,
          paymentRef: `admin-assign:${tier}`,
        }));

        if (accessEntries.length > 0) {
          await db.insert(productAccessTable).values(accessEntries);
        }

        // Update legacy fields (first product for backward compatibility)
        const firstProduct = productIds[0];
        const upgradeType = `${firstProduct}_${tier.toUpperCase()}`;
        updates.upgradeType = upgradeType;
        updates.upgradeExpiresAt = expiresAt;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Fetch active products for the updated user
    const now = new Date();
    const activeProds = await db
      .select()
      .from(productAccessTable)
      .where(and(eq(productAccessTable.userId, userId), gt(productAccessTable.expiresAt, now)));

    const activeProducts = activeProds.map((p: any) => {
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

    res.json(mapUser(user, activeProducts));
  } catch (err) {
    req.log.error({ err }, "Admin update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const banSchema = z.object({ reason: z.string().min(1).max(500) });

router.post("/users/:userId/ban", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentUser = req.user as any;

  if (userId === currentUser.id) {
    res.status(400).json({ error: "Cannot ban yourself" });
    return;
  }

  const parse = banSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Reason is required" });
    return;
  }

  try {
    const [user] = await db.update(usersTable).set({
      isBanned: true,
      banReason: parse.data.reason,
    }).where(eq(usersTable.id, userId)).returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ message: `User ${user.username} has been banned` });
  } catch (err) {
    req.log.error({ err }, "Admin ban user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/unban", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  try {
    const [user] = await db.update(usersTable).set({
      isBanned: false,
      banReason: null,
    }).where(eq(usersTable.id, userId)).returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ message: `User ${user.username} has been unbanned` });
  } catch (err) {
    req.log.error({ err }, "Admin unban user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:userId", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentUser = req.user as any;

  if (userId === currentUser.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  try {
    // Retrieve ALL threads by the user
    const userThreads = await db.select({ id: threadsTable.id }).from(threadsTable).where(eq(threadsTable.authorId, userId));
    const threadIds = userThreads.map((t: any) => t.id);

    // Batch all deletion operations in parallel for better performance
    // This avoids locking the database with sequential operations
    const deleteOps = [
      threadIds.length > 0 ? db.delete(postsTable).where(inArray(postsTable.threadId, threadIds)) : null,
      db.delete(postsTable).where(eq(postsTable.authorId, userId)),
      db.delete(profilePostsTable).where(or(eq(profilePostsTable.authorId, userId), eq(profilePostsTable.profileUserId, userId))),
      db.delete(shoutboxTable).where(eq(shoutboxTable.authorId, userId)),
      db.delete(cryptoPaymentRequestsTable).where(eq(cryptoPaymentRequestsTable.userId, userId)),
      db.delete(productAccessTable).where(eq(productAccessTable.userId, userId)),
      db.delete(loginEventsTable).where(eq(loginEventsTable.userId, userId)),
      threadIds.length > 0 ? db.delete(threadsTable).where(inArray(threadsTable.id, threadIds)) : null,
      db.delete(threadsTable).where(eq(threadsTable.authorId, userId)), // Fallback for any remaining
    ].filter(Boolean) as any[];

    // Execute all deletes in parallel
    await Promise.all(deleteOps);

    const [deletedUser] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning();
    
    if (!deletedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ message: `User ${deletedUser.username} has been eradicated` });
  } catch (err) {
    req.log.error({ err }, "Admin delete user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST fallback for environments that block HTTP DELETE requests
router.post("/users/:userId/delete", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentUser = req.user as any;

  if (userId === currentUser.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  try {
    // Retrieve ALL threads by the user
    const userThreads = await db.select({ id: threadsTable.id }).from(threadsTable).where(eq(threadsTable.authorId, userId));
    const threadIds = userThreads.map((t: any) => t.id);

    // Batch all deletion operations in parallel for better performance
    const deleteOps = [
      threadIds.length > 0 ? db.delete(postsTable).where(inArray(postsTable.threadId, threadIds)) : null,
      db.delete(postsTable).where(eq(postsTable.authorId, userId)),
      db.delete(profilePostsTable).where(or(eq(profilePostsTable.authorId, userId), eq(profilePostsTable.profileUserId, userId))),
      db.delete(shoutboxTable).where(eq(shoutboxTable.authorId, userId)),
      db.delete(cryptoPaymentRequestsTable).where(eq(cryptoPaymentRequestsTable.userId, userId)),
      db.delete(productAccessTable).where(eq(productAccessTable.userId, userId)),
      db.delete(loginEventsTable).where(eq(loginEventsTable.userId, userId)),
      threadIds.length > 0 ? db.delete(threadsTable).where(inArray(threadsTable.id, threadIds)) : null,
      db.delete(threadsTable).where(eq(threadsTable.authorId, userId)), // Fallback for any remaining
    ].filter(Boolean) as any[];

    // Execute all deletes in parallel
    await Promise.all(deleteOps);

    const [deletedUser] = await db.delete(usersTable).where(eq(usersTable.id, userId)).returning();
    
    if (!deletedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ message: `User ${deletedUser.username} has been eradicated` });
  } catch (err) {
    req.log.error({ err }, "Admin delete user error (POST fallback)");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/users/:userId/verify-email", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }
  try {
    const [user] = await db.update(usersTable).set({
      isEmailVerified: true,
      emailVerificationToken: null,
    }).where(eq(usersTable.id, userId)).returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ message: `Email verified for user ${user.username}` });
  } catch (err) {
    req.log.error({ err }, "Admin verify email error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const CONFIG_KEYS = [
  "siteName", "siteDescription", "maintenanceMode", "registrationMode", "requireEmailVerification", 
  "inviteRequestMode", "inviteRequestCooldownDays", "products",
  // Shoutbox rate limiting (in rate limits tab)
  "shoutboxRateLimitPerWindow", "shoutboxRateLimitWindowMs", "shoutboxRateLimitStrikeDecayMs", 
  "shoutboxRateLimitMaxStrikes", "shoutboxMaxMessages", "shoutboxMaxCharacters",
  // Authentication rate limiters
  "rateLimitLoginPerWindow", "rateLimitLoginWindowMs",
  "rateLimitRegisterPerWindow", "rateLimitRegisterWindowMs",
  "rateLimitForgotPasswordPerWindow", "rateLimitForgotPasswordWindowMs",
  "rateLimitResetPasswordPerWindow", "rateLimitResetPasswordWindowMs",
  "rateLimitSsoLinkPerWindow", "rateLimitSsoLinkWindowMs",
  "rateLimitInviteRequestPerWindow", "rateLimitInviteRequestWindowMs",
  "rateLimitApiPerWindow", "rateLimitApiWindowMs",
  // Forum interaction rate limiters
  "rateLimitCreateThreadPerWindow", "rateLimitCreateThreadWindowMs",
  "rateLimitCreatePostPerWindow", "rateLimitCreatePostWindowMs",
  "rateLimitEditPostPerWindow", "rateLimitEditPostWindowMs",
  "rateLimitDeletePostPerWindow", "rateLimitDeletePostWindowMs",
  // Profile interaction rate limiters
  "rateLimitProfilePostPerWindow", "rateLimitProfilePostWindowMs",
  "rateLimitEditProfilePostPerWindow", "rateLimitEditProfilePostWindowMs",
  "rateLimitDeleteProfilePostPerWindow", "rateLimitDeleteProfilePostWindowMs",
  // File upload rate limiters
  "rateLimitFileUploadPerWindow", "rateLimitFileUploadWindowMs",
  "rateLimitAvatarUploadPerWindow", "rateLimitAvatarUploadWindowMs",
  // Verification and misc rate limiters
  "rateLimitVerifyEmailPerWindow", "rateLimitVerifyEmailWindowMs",
  "rateLimitPurchasePerWindow", "rateLimitPurchaseWindowMs",
];

router.get("/config", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    const config: any = {
      siteName: "Scootware Forum",
      siteDescription: "The official Scootware gaming products and tools",
      maintenanceMode: false,
      registrationMode: "open",
      requireEmailVerification: true,
      inviteRequestMode: "admin",
      inviteRequestCooldownDays: 7,
      // Shoutbox
      shoutboxRateLimitPerWindow: 5,
      shoutboxRateLimitWindowMs: 10000,
      shoutboxRateLimitStrikeDecayMs: 3600,
      shoutboxRateLimitMaxStrikes: 3,
      shoutboxMaxMessages: 50,
      shoutboxMaxCharacters: 500,
      // Authentication
      rateLimitLoginPerWindow: 5,
      rateLimitLoginWindowMs: 900000,
      rateLimitRegisterPerWindow: 3,
      rateLimitRegisterWindowMs: 3600000,
      rateLimitForgotPasswordPerWindow: 3,
      rateLimitForgotPasswordWindowMs: 3600000,
      rateLimitResetPasswordPerWindow: 5,
      rateLimitResetPasswordWindowMs: 3600000,
      rateLimitSsoLinkPerWindow: 10,
      rateLimitSsoLinkWindowMs: 900000,
      rateLimitInviteRequestPerWindow: 3,
      rateLimitInviteRequestWindowMs: 86400000,
      rateLimitApiPerWindow: 500,
      rateLimitApiWindowMs: 60000,
      // Forum interactions
      rateLimitCreateThreadPerWindow: 5,
      rateLimitCreateThreadWindowMs: 3600000,
      rateLimitCreatePostPerWindow: 10,
      rateLimitCreatePostWindowMs: 300000,
      rateLimitEditPostPerWindow: 20,
      rateLimitEditPostWindowMs: 3600000,
      rateLimitDeletePostPerWindow: 10,
      rateLimitDeletePostWindowMs: 3600000,
      // Profile interactions
      rateLimitProfilePostPerWindow: 5,
      rateLimitProfilePostWindowMs: 600000,
      rateLimitEditProfilePostPerWindow: 10,
      rateLimitEditProfilePostWindowMs: 3600000,
      rateLimitDeleteProfilePostPerWindow: 10,
      rateLimitDeleteProfilePostWindowMs: 3600000,
      // File uploads
      rateLimitFileUploadPerWindow: 5,
      rateLimitFileUploadWindowMs: 600000,
      rateLimitAvatarUploadPerWindow: 3,
      rateLimitAvatarUploadWindowMs: 3600000,
      // Verification and misc
      rateLimitVerifyEmailPerWindow: 3,
      rateLimitVerifyEmailWindowMs: 3600000,
      rateLimitPurchasePerWindow: 10,
      rateLimitPurchaseWindowMs: 3600000,
    };
    // Define all numeric config fields  
    const numericKeys = new Set([
      // Shoutbox rate limiting
      "shoutboxRateLimitPerWindow", "shoutboxRateLimitWindowMs", "shoutboxRateLimitStrikeDecayMs", "shoutboxRateLimitMaxStrikes", 
      "shoutboxMaxMessages", "shoutboxMaxCharacters",
      // Authentication rate limiting
      "rateLimitLoginPerWindow", "rateLimitLoginWindowMs", "rateLimitRegisterPerWindow", "rateLimitRegisterWindowMs", 
      "rateLimitForgotPasswordPerWindow", "rateLimitForgotPasswordWindowMs", "rateLimitResetPasswordPerWindow", "rateLimitResetPasswordWindowMs", 
      "rateLimitSsoLinkPerWindow", "rateLimitSsoLinkWindowMs", "rateLimitInviteRequestPerWindow", "rateLimitInviteRequestWindowMs",
      "rateLimitApiPerWindow", "rateLimitApiWindowMs",
      // Forum interaction rate limiting
      "rateLimitCreateThreadPerWindow", "rateLimitCreateThreadWindowMs", "rateLimitCreatePostPerWindow", "rateLimitCreatePostWindowMs",
      "rateLimitEditPostPerWindow", "rateLimitEditPostWindowMs", "rateLimitDeletePostPerWindow", "rateLimitDeletePostWindowMs",
      // Profile interaction rate limiting
      "rateLimitProfilePostPerWindow", "rateLimitProfilePostWindowMs", "rateLimitEditProfilePostPerWindow", "rateLimitEditProfilePostWindowMs", 
      "rateLimitDeleteProfilePostPerWindow", "rateLimitDeleteProfilePostWindowMs",
      // File upload rate limiting
      "rateLimitFileUploadPerWindow", "rateLimitFileUploadWindowMs", "rateLimitAvatarUploadPerWindow", "rateLimitAvatarUploadWindowMs",
      // Verification and misc rate limiting
      "rateLimitVerifyEmailPerWindow", "rateLimitVerifyEmailWindowMs", "rateLimitPurchasePerWindow", "rateLimitPurchaseWindowMs",
      // Other numeric config
      "inviteRequestCooldownDays",
    ]);
    
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "requireEmailVerification") {
        config[row.key] = row.value === "true";
      } else if (row.key === "products") {
        try {
          config[row.key] = JSON.parse(row.value);
        } catch (e) {
          config[row.key] = {};
        }
      } else if (numericKeys.has(row.key)) {
        const value = parseInt(row.value);
        // Convert strike decay from milliseconds to seconds for API response
        if (row.key === "shoutboxRateLimitStrikeDecayMs") {
          config[row.key] = Math.round(value / 1000);
        } else {
          config[row.key] = value;
        }
      } else {
        config[row.key] = row.value;
      }
    }
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Get config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const configSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  siteDescription: z.string().max(500).optional(),
  maintenanceMode: z.boolean().optional(),
  registrationMode: z.enum(["open", "invite-only", "closed"]).optional(),
  requireEmailVerification: z.boolean().optional(),
  inviteRequestMode: z.enum(["admin", "auto"]).optional(),
  inviteRequestCooldownDays: z.number().int().nonnegative().optional(),
  products: z.any().optional(),
  // Shoutbox rate limiting config
  shoutboxRateLimitPerWindow: z.number().int().positive().optional(),
  shoutboxRateLimitWindowMs: z.number().int().positive().optional(),
  shoutboxRateLimitStrikeDecayMs: z.number().int().positive().optional(),
  shoutboxRateLimitMaxStrikes: z.number().int().positive().optional(),
  // Shoutbox message and character limits
  shoutboxMaxMessages: z.number().int().min(10).optional(),
  shoutboxMaxCharacters: z.number().int().min(50).optional(),
  // Authentication rate limiters
  rateLimitLoginPerWindow: z.number().int().positive().optional(),
  rateLimitLoginWindowMs: z.number().int().positive().optional(),
  rateLimitRegisterPerWindow: z.number().int().positive().optional(),
  rateLimitRegisterWindowMs: z.number().int().positive().optional(),
  rateLimitForgotPasswordPerWindow: z.number().int().positive().optional(),
  rateLimitForgotPasswordWindowMs: z.number().int().positive().optional(),
  rateLimitResetPasswordPerWindow: z.number().int().positive().optional(),
  rateLimitResetPasswordWindowMs: z.number().int().positive().optional(),
  rateLimitSsoLinkPerWindow: z.number().int().positive().optional(),
  rateLimitSsoLinkWindowMs: z.number().int().positive().optional(),
  rateLimitInviteRequestPerWindow: z.number().int().positive().optional(),
  rateLimitInviteRequestWindowMs: z.number().int().positive().optional(),
  rateLimitApiPerWindow: z.number().int().positive().optional(),
  rateLimitApiWindowMs: z.number().int().positive().optional(),
  // Forum interaction rate limiters
  rateLimitCreateThreadPerWindow: z.number().int().positive().optional(),
  rateLimitCreateThreadWindowMs: z.number().int().positive().optional(),
  rateLimitCreatePostPerWindow: z.number().int().positive().optional(),
  rateLimitCreatePostWindowMs: z.number().int().positive().optional(),
  rateLimitEditPostPerWindow: z.number().int().positive().optional(),
  rateLimitEditPostWindowMs: z.number().int().positive().optional(),
  rateLimitDeletePostPerWindow: z.number().int().positive().optional(),
  rateLimitDeletePostWindowMs: z.number().int().positive().optional(),
  // Profile interaction rate limiters
  rateLimitProfilePostPerWindow: z.number().int().positive().optional(),
  rateLimitProfilePostWindowMs: z.number().int().positive().optional(),
  rateLimitEditProfilePostPerWindow: z.number().int().positive().optional(),
  rateLimitEditProfilePostWindowMs: z.number().int().positive().optional(),
  rateLimitDeleteProfilePostPerWindow: z.number().int().positive().optional(),
  rateLimitDeleteProfilePostWindowMs: z.number().int().positive().optional(),
  // File upload rate limiters
  rateLimitFileUploadPerWindow: z.number().int().positive().optional(),
  rateLimitFileUploadWindowMs: z.number().int().positive().optional(),
  rateLimitAvatarUploadPerWindow: z.number().int().positive().optional(),
  rateLimitAvatarUploadWindowMs: z.number().int().positive().optional(),
  // Verification and misc rate limiters
  rateLimitVerifyEmailPerWindow: z.number().int().positive().optional(),
  rateLimitVerifyEmailWindowMs: z.number().int().positive().optional(),
  rateLimitPurchasePerWindow: z.number().int().positive().optional(),
  rateLimitPurchaseWindowMs: z.number().int().positive().optional(),
}).passthrough(); // Allow additional properties instead of using .strict()

router.post("/config-debug", async (req: Request, res: Response) => {
  // Diagnostic endpoint to show exactly what we're receiving
  res.json({
    message: "Diagnostic - showing exact request data",
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    body: req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    rawBody: (req as any).rawBody ? (req as any).rawBody.toString('utf-8') : 'no rawBody',
    bodyString: JSON.stringify(req.body, null, 2)
  });
});

router.patch("/config", async (req: Request, res: Response) => {
  // Ensure req.body is parsed
  if (!req.body || typeof req.body !== 'object') {
    req.log?.error({ body: req.body, contentType: req.get('content-type') }, "No body or invalid body type");
    return res.status(400).json({ error: "Request body must be JSON object", received: typeof req.body });
  }
  
  req.log?.info({ bodyKeys: Object.keys(req.body) }, "Received PATCH /config request");
  
  const parse = configSchema.safeParse(req.body);
  if (!parse.success) {
    req.log?.warn({ errors: parse.error.issues }, "Config validation failed");
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error", issues: parse.error.issues });
    return;
  }

  try {
    req.log?.info({ configKeys: Object.keys(parse.data) }, "Starting config update");
    
    for (const [key, value] of Object.entries(parse.data)) {
      if (value === undefined) continue;
      // Convert strike decay from seconds to milliseconds for storage
      let storeValue: string;
      if (key === "shoutboxRateLimitStrikeDecayMs" && typeof value === "number") {
        storeValue = String(value * 1000); // Convert seconds to milliseconds
      } else if (key === "products" && typeof value === "object") {
        storeValue = JSON.stringify(value);
      } else {
        storeValue = String(value);
      }
      
      req.log?.debug({ key, originalValue: value, storedValue: storeValue }, "Upserting config key");
      
      await db.insert(siteConfigTable)
        .values({ key, value: storeValue })
        .onConflictDoUpdate({ target: siteConfigTable.key, set: { value: storeValue } });
    }

    // Return updated config
    const rows = await db.select().from(siteConfigTable);
    const config: any = {
      siteName: "Scootware Forum",
      siteDescription: "The official Scootware gaming products and tools",
      maintenanceMode: false,
      registrationMode: "open",
      requireEmailVerification: true,
      inviteRequestMode: "admin",
      inviteRequestCooldownDays: 7,
      // Shoutbox
      shoutboxRateLimitPerWindow: 5,
      shoutboxRateLimitWindowMs: 10000,
      shoutboxRateLimitStrikeDecayMs: 3600,
      shoutboxRateLimitMaxStrikes: 3,
      shoutboxMaxMessages: 50,
      shoutboxMaxCharacters: 500,
      // Authentication
      rateLimitLoginPerWindow: 5,
      rateLimitLoginWindowMs: 900000,
      rateLimitRegisterPerWindow: 3,
      rateLimitRegisterWindowMs: 3600000,
      rateLimitForgotPasswordPerWindow: 3,
      rateLimitForgotPasswordWindowMs: 3600000,
      rateLimitResetPasswordPerWindow: 5,
      rateLimitResetPasswordWindowMs: 3600000,
      rateLimitSsoLinkPerWindow: 10,
      rateLimitSsoLinkWindowMs: 900000,
      rateLimitInviteRequestPerWindow: 3,
      rateLimitInviteRequestWindowMs: 86400000,
      rateLimitApiPerWindow: 500,
      rateLimitApiWindowMs: 60000,
      // Forum interactions
      rateLimitCreateThreadPerWindow: 5,
      rateLimitCreateThreadWindowMs: 3600000,
      rateLimitCreatePostPerWindow: 10,
      rateLimitCreatePostWindowMs: 300000,
      rateLimitEditPostPerWindow: 20,
      rateLimitEditPostWindowMs: 3600000,
      rateLimitDeletePostPerWindow: 10,
      rateLimitDeletePostWindowMs: 3600000,
      // Profile interactions
      rateLimitProfilePostPerWindow: 5,
      rateLimitProfilePostWindowMs: 600000,
      rateLimitEditProfilePostPerWindow: 10,
      rateLimitEditProfilePostWindowMs: 3600000,
      rateLimitDeleteProfilePostPerWindow: 10,
      rateLimitDeleteProfilePostWindowMs: 3600000,
      // File uploads
      rateLimitFileUploadPerWindow: 5,
      rateLimitFileUploadWindowMs: 600000,
      rateLimitAvatarUploadPerWindow: 3,
      rateLimitAvatarUploadWindowMs: 3600000,
      // Verification and misc
      rateLimitVerifyEmailPerWindow: 3,
      rateLimitVerifyEmailWindowMs: 3600000,
      rateLimitPurchasePerWindow: 10,
      rateLimitPurchaseWindowMs: 3600000,
    };
    const rateLimitKeys = [
      "shoutboxRateLimitPerWindow", "shoutboxRateLimitWindowMs", "shoutboxRateLimitStrikeDecayMs", "shoutboxRateLimitMaxStrikes", "shoutboxMaxMessages", "shoutboxMaxCharacters",
      "rateLimitLoginPerWindow", "rateLimitLoginWindowMs", "rateLimitRegisterPerWindow", "rateLimitRegisterWindowMs", "rateLimitForgotPasswordPerWindow", "rateLimitForgotPasswordWindowMs",
      "rateLimitResetPasswordPerWindow", "rateLimitResetPasswordWindowMs", "rateLimitSsoLinkPerWindow", "rateLimitSsoLinkWindowMs", "rateLimitInviteRequestPerWindow", "rateLimitInviteRequestWindowMs",
      "rateLimitApiPerWindow", "rateLimitApiWindowMs", "rateLimitCreateThreadPerWindow", "rateLimitCreateThreadWindowMs", "rateLimitCreatePostPerWindow", "rateLimitCreatePostWindowMs",
      "rateLimitEditPostPerWindow", "rateLimitEditPostWindowMs", "rateLimitDeletePostPerWindow", "rateLimitDeletePostWindowMs", "rateLimitProfilePostPerWindow", "rateLimitProfilePostWindowMs",
      "rateLimitEditProfilePostPerWindow", "rateLimitEditProfilePostWindowMs", "rateLimitDeleteProfilePostPerWindow", "rateLimitDeleteProfilePostWindowMs", "rateLimitFileUploadPerWindow", "rateLimitFileUploadWindowMs",
      "rateLimitAvatarUploadPerWindow", "rateLimitAvatarUploadWindowMs", "rateLimitVerifyEmailPerWindow", "rateLimitVerifyEmailWindowMs", "rateLimitPurchasePerWindow", "rateLimitPurchaseWindowMs",
    ];
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "requireEmailVerification") {
        config[row.key] = row.value === "true";
      } else if (rateLimitKeys.includes(row.key)) {
        const numValue = parseInt(row.value);
        // Convert strike decay from milliseconds to seconds for API response
        if (row.key === "shoutboxRateLimitStrikeDecayMs") {
          config[row.key] = Math.round(numValue / 1000);
        } else {
          config[row.key] = numValue;
        }
      } else {
        config[row.key] = row.value;
      }
    }
    res.json(config);
  } catch (err) {
    req.log?.error({ err, errorMessage: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined }, "Update config error");
    res.status(500).json({ error: "Internal server error", details: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/login-events", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1")));
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginEventsTable as any);

    const events = await db.select({
      id: loginEventsTable.id,
      userId: loginEventsTable.userId,
      ip: loginEventsTable.ip,
      userAgent: loginEventsTable.userAgent,
      eventType: loginEventsTable.eventType,
      createdAt: loginEventsTable.createdAt,
      username: usersTable.username,
    }).from(loginEventsTable as any).leftJoin(usersTable, eq(loginEventsTable.userId, usersTable.id)).orderBy(desc(loginEventsTable.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE as number);

    res.json({ events, total: count, page, totalPages: Math.ceil(count / PAGE_SIZE) });
  } catch (err) {
    req.log.error({ err }, "Admin get login events error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Extend subscription endpoint
const extendSubscriptionSchema = z.object({
  productIds: z.array(z.string()).optional().default([]),
  extensionDays: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

router.post("/users/:userId/extend-subscription", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentAdmin = req.user as any;
  
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parse = extendSubscriptionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    const { productIds, extensionDays, reason } = parse.data;
    const now = new Date();

    // Fetch active product access for this user
    const activeAccess = await db
      .select()
      .from(productAccessTable)
      .where(and(eq(productAccessTable.userId, userId), gt(productAccessTable.expiresAt, now)));

    if (activeAccess.length === 0) {
      res.status(404).json({ error: "User has no active subscriptions to extend" });
      return;
    }

    // Determine which products to extend
    const productsToExtend = productIds.length > 0 
      ? activeAccess.filter((access: any) => productIds.includes(access.productId))
      : activeAccess;

    if (productsToExtend.length === 0) {
      res.status(400).json({ error: "None of the specified products are active for this user" });
      return;
    }

    // Calculate extension timestamp
    const extensionMs = extensionDays * 24 * 60 * 60 * 1000;

    // Update product access for each product and log the extension
    for (const access of productsToExtend) {
      const newExpiresAt = new Date(access.expiresAt.getTime() + extensionMs);
      
      // Update the product access
      await db
        .update(productAccessTable)
        .set({ expiresAt: newExpiresAt })
        .where(eq(productAccessTable.id, access.id!));

      // Log the extension
      await db.insert(subscriptionExtensionsTable).values({
        userId,
        productId: access.productId,
        extensionDays,
        reason: reason || null,
        extendedBy: currentAdmin.id,
      });
    }

    // Fetch updated user data
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        upgradeType: usersTable.upgradeType,
        upgradeExpiresAt: usersTable.upgradeExpiresAt,
        avatarUrl: usersTable.avatarUrl,
        isBanned: usersTable.isBanned,
        isEmailVerified: usersTable.isEmailVerified,
        createdAt: usersTable.createdAt,
        postCount: sql<number>`(SELECT COUNT(*)::int FROM ${postsTable} p WHERE p.author_id = ${usersTable.id})`,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Update legacy fields based on first product if it was extended
    const firstExtendedProduct = productsToExtend[0];
    const updatedAccess = await db.select().from(productAccessTable)
      .where(eq(productAccessTable.id, firstExtendedProduct.id!));
    
    if (updatedAccess.length > 0) {
      await db.update(usersTable)
        .set({ upgradeExpiresAt: updatedAccess[0].expiresAt })
        .where(eq(usersTable.id, userId));
    }

    // Fetch active products for response
    const updatedActiveProds = await db
      .select()
      .from(productAccessTable)
      .where(and(eq(productAccessTable.userId, userId), gt(productAccessTable.expiresAt, now)));

    const activeProducts = updatedActiveProds.map((p: any) => {
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

    res.json({
      message: `Extended ${productsToExtend.length} subscription(s) by ${extensionDays} days`,
      extendedProducts: productsToExtend.map((p: any) => p.productId),
      user: mapUser(user, activeProducts),
    });
  } catch (err) {
    req.log.error({ err }, "Admin extend subscription error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============== INVITE CODES MANAGEMENT ==============

router.get("/invites", async (req: Request, res: Response) => {
  try {
    const invites = await db
      .select({
        id: inviteCodesTable.id,
        code: inviteCodesTable.code,
        productId: inviteCodesTable.productId,
        expiresAt: inviteCodesTable.expiresAt,
        isBanned: inviteCodesTable.isBanned,
        isUsed: inviteCodesTable.isUsed,
        usedBy: inviteCodesTable.usedBy,
        usedAt: inviteCodesTable.usedAt,
        createdAt: inviteCodesTable.createdAt,
        createdByUsername: usersTable.username,
      })
      .from(inviteCodesTable)
      .leftJoin(usersTable, eq(inviteCodesTable.createdBy, usersTable.id))
      .orderBy(desc(inviteCodesTable.createdAt));

    res.json({ invites });
  } catch (err) {
    req.log.error({ err }, "Admin get invites error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createInviteSchema = z.object({
  code: z.string().min(3).max(50).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  productId: z.string().optional().nullable(),
});

router.post("/invites", async (req: Request, res: Response) => {
  const currentAdmin = req.user as any;
  
  const parse = createInviteSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    let code = parse.data.code;
    
    // Auto-generate code if not provided
    if (!code) {
      let isUnique = false;
      while (!isUnique) {
        code = crypto.randomBytes(4).toString("hex").toUpperCase();
        const existing = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, code)).limit(1);
        isUnique = existing.length === 0;
      }
    } else {
      // Check if code already exists
      const existing = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, code)).limit(1);
      if (existing.length > 0) {
        res.status(400).json({ error: "Invite code already exists" });
        return;
      }
    }

    const [newInvite] = await db.insert(inviteCodesTable).values({
      code,
      createdBy: currentAdmin.id,
      expiresAt: parse.data.expiresAt ? new Date(parse.data.expiresAt) : null,
      productId: parse.data.productId || null,
    }).returning();

    res.json({
      message: "Invite created successfully",
      invite: {
        id: newInvite.id,
        code: newInvite.code,
        productId: newInvite.productId,
        expiresAt: newInvite.expiresAt,
        isBanned: newInvite.isBanned,
        isUsed: newInvite.isUsed,
        createdAt: newInvite.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Admin create invite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/invites/:id", async (req: Request, res: Response) => {
  const inviteId = parseInt(req.params.id as any);
  if (isNaN(inviteId)) {
    res.status(400).json({ error: "Invalid invite ID" });
    return;
  }

  try {
    const [deletedInvite] = await db.delete(inviteCodesTable).where(eq(inviteCodesTable.id, inviteId)).returning();
    
    if (!deletedInvite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.json({ message: `Invite code ${deletedInvite.code} has been deleted` });
  } catch (err) {
    req.log.error({ err }, "Admin delete invite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invites/:id/ban", async (req: Request, res: Response) => {
  const inviteId = parseInt(req.params.id as any);
  if (isNaN(inviteId)) {
    res.status(400).json({ error: "Invalid invite ID" });
    return;
  }

  try {
    const [bannedInvite] = await db
      .update(inviteCodesTable)
      .set({ isBanned: true })
      .where(eq(inviteCodesTable.id, inviteId))
      .returning();

    if (!bannedInvite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.json({ message: `Invite code ${bannedInvite.code} has been closed` });
  } catch (err) {
    req.log.error({ err }, "Admin ban invite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invites/:id/unban", async (req: Request, res: Response) => {
  const inviteId = parseInt(req.params.id as any);
  if (isNaN(inviteId)) {
    res.status(400).json({ error: "Invalid invite ID" });
    return;
  }

  try {
    const [unbannedInvite] = await db
      .update(inviteCodesTable)
      .set({ isBanned: false })
      .where(eq(inviteCodesTable.id, inviteId))
      .returning();

    if (!unbannedInvite) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.json({ message: `Invite code ${unbannedInvite.code} has been reopened` });
  } catch (err) {
    req.log.error({ err }, "Admin unban invite error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============== INVITE REQUESTS MANAGEMENT ==============

router.get("/invite-requests", async (req: Request, res: Response) => {
  try {
    const requests = await db
      .select({
        id: inviteRequestsTable.id,
        email: inviteRequestsTable.email,
        username: inviteRequestsTable.username,
        reason: inviteRequestsTable.reason,
        status: inviteRequestsTable.status,
        createdAt: inviteRequestsTable.createdAt,
        processedAt: inviteRequestsTable.processedAt,
        processedByUsername: usersTable.username,
      })
      .from(inviteRequestsTable)
      .leftJoin(usersTable, eq(inviteRequestsTable.processedBy, usersTable.id))
      .orderBy(desc(inviteRequestsTable.createdAt));

    res.json({ requests });
  } catch (err) {
    req.log.error({ err }, "Admin get invite requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite-requests/:id/approve", async (req: Request, res: Response) => {
  const requestId = parseInt(req.params.id as any);
  const currentAdmin = req.user as any;
  
  if (isNaN(requestId)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    const [inviteRequest] = await db
      .select()
      .from(inviteRequestsTable)
      .where(eq(inviteRequestsTable.id, requestId));

    if (!inviteRequest) {
      res.status(404).json({ error: "Invite request not found" });
      return;
    }

    // Generate a unique invite code
    let code = "";
    let isUnique = false;
    while (!isUnique) {
      code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const existing = await db.select().from(inviteCodesTable).where(eq(inviteCodesTable.code, code)).limit(1);
      isUnique = existing.length === 0;
    }

    // Create invite code for the approved request
    const [newInvite] = await db.insert(inviteCodesTable).values({
      code,
      createdBy: currentAdmin.id,
    }).returning();

    // Update the request status
    const [updatedRequest] = await db
      .update(inviteRequestsTable)
      .set({
        status: "approved",
        processedAt: new Date(),
        processedBy: currentAdmin.id,
      })
      .where(eq(inviteRequestsTable.id, requestId))
      .returning();

    res.json({
      message: `Invite request from ${inviteRequest.email} has been approved`,
      inviteCode: newInvite.code,
      request: updatedRequest,
    });
  } catch (err) {
    req.log.error({ err }, "Admin approve invite request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invite-requests/:id/reject", async (req: Request, res: Response) => {
  const requestId = parseInt(req.params.id as any);
  const currentAdmin = req.user as any;
  
  if (isNaN(requestId)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    const [inviteRequest] = await db
      .select()
      .from(inviteRequestsTable)
      .where(eq(inviteRequestsTable.id, requestId));

    if (!inviteRequest) {
      res.status(404).json({ error: "Invite request not found" });
      return;
    }

    // Update the request status
    const [updatedRequest] = await db
      .update(inviteRequestsTable)
      .set({
        status: "rejected",
        processedAt: new Date(),
        processedBy: currentAdmin.id,
      })
      .where(eq(inviteRequestsTable.id, requestId))
      .returning();

    res.json({
      message: `Invite request from ${inviteRequest.email} has been rejected`,
      request: updatedRequest,
    });
  } catch (err) {
    req.log.error({ err }, "Admin reject invite request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

function mapUser(user: any, activeProducts: any[] = []) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    upgradeType: user.upgradeType ?? null,
    upgradeExpiresAt: user.upgradeExpiresAt ?? null,
    activeProducts,
    avatarUrl: user.avatarUrl ?? null,
    isBanned: user.isBanned,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    postCount: user.postCount,
  };
}

export default router;
