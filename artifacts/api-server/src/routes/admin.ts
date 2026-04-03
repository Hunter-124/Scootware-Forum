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
  profilePostsTable,
  cryptoPaymentRequestsTable,
  productAccessTable,
  SUBSCRIPTION_TYPES,
} from "@workspace/db";
import { eq, ilike, or, sql, desc, inArray } from "drizzle-orm";
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
      .select()
      .from(usersTable)
      .where(whereClause)
      .orderBy(desc(usersTable.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    res.json({
      users: users.map(mapUser),
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

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(mapUser(user));
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

    // Delete posts in threads owned by the user
    if (threadIds.length > 0) {
      await db.delete(postsTable).where(inArray(postsTable.threadId, threadIds));
    }

    // Clean up dependent records
    await Promise.all([
      db.delete(postsTable).where(eq(postsTable.authorId, userId)),
      db.delete(profilePostsTable).where(or(eq(profilePostsTable.authorId, userId), eq(profilePostsTable.profileUserId, userId))),
      db.delete(shoutboxTable).where(eq(shoutboxTable.authorId, userId)),
      db.delete(cryptoPaymentRequestsTable).where(eq(cryptoPaymentRequestsTable.userId, userId)),
      db.delete(productAccessTable).where(eq(productAccessTable.userId, userId)),
      db.delete(loginEventsTable).where(eq(loginEventsTable.userId, userId)),
    ]);

    // Finally delete threads and the user
    if (threadIds.length > 0) {
      await db.delete(threadsTable).where(inArray(threadsTable.id, threadIds));
    }
    
    // Fallback delete threads just in case we missed some? The 'inArray' should hit them all.
    await db.delete(threadsTable).where(eq(threadsTable.authorId, userId));

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

    // Delete posts in threads owned by the user
    if (threadIds.length > 0) {
      await db.delete(postsTable).where(inArray(postsTable.threadId, threadIds));
    }

    // Clean up dependent records
    await Promise.all([
      db.delete(postsTable).where(eq(postsTable.authorId, userId)),
      db.delete(profilePostsTable).where(or(eq(profilePostsTable.authorId, userId), eq(profilePostsTable.profileUserId, userId))),
      db.delete(shoutboxTable).where(eq(shoutboxTable.authorId, userId)),
      db.delete(cryptoPaymentRequestsTable).where(eq(cryptoPaymentRequestsTable.userId, userId)),
      db.delete(productAccessTable).where(eq(productAccessTable.userId, userId)),
      db.delete(loginEventsTable).where(eq(loginEventsTable.userId, userId)),
    ]);

    // Finally delete threads and the user
    if (threadIds.length > 0) {
      await db.delete(threadsTable).where(inArray(threadsTable.id, threadIds));
    }
    
    // Fallback delete threads just in case we missed some? The 'inArray' should hit them all.
    await db.delete(threadsTable).where(eq(threadsTable.authorId, userId));

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

const CONFIG_KEYS = ["siteName", "siteDescription", "maintenanceMode", "allowRegistration", "requireEmailVerification", "inviteOnlyMode", "inviteRequestMode", "inviteRequestCooldownDays", "products"];

router.get("/config", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    const config: any = {
      siteName: "Scootware Forum",
      siteDescription: "The official Scootware gaming products and tools",
      maintenanceMode: false,
      allowRegistration: true,
      requireEmailVerification: true,
      inviteOnlyMode: false,
      inviteRequestMode: "admin",
      inviteRequestCooldownDays: 7,
    };
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "allowRegistration" || row.key === "requireEmailVerification" || row.key === "inviteOnlyMode") {
        config[row.key] = row.value === "true";
      } else if (row.key === "products") {
        try {
          config[row.key] = JSON.parse(row.value);
        } catch (e) {
          config[row.key] = {};
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
  allowRegistration: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  inviteOnlyMode: z.boolean().optional(),
  inviteRequestMode: z.enum(["admin", "auto"]).optional(),
    inviteRequestCooldownDays: z.number().int().nonnegative().optional(),
  // products: optional mapping of productId -> { price, bulkQuantity, bulkDiscountPercent, inviteOnly }
  products: z.any().optional(),
});

router.patch("/config", async (req: Request, res: Response) => {
  const parse = configSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    for (const [key, value] of Object.entries(parse.data)) {
      if (value === undefined) continue;
      // If products object, store as JSON string so we can parse it later
      const storeValue = key === "products" && typeof value === "object" ? JSON.stringify(value) : String(value);
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
      allowRegistration: true,
      requireEmailVerification: true,
      inviteOnlyMode: false,
      inviteRequestMode: "admin",
      inviteRequestCooldownDays: 7,
    };
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "allowRegistration" || row.key === "requireEmailVerification" || row.key === "inviteOnlyMode") {
        config[row.key] = row.value === "true";
      } else {
        config[row.key] = row.value;
      }
    }
    res.json(config);
  } catch (err) {
    req.log.error({ err }, "Update config error");
    res.status(500).json({ error: "Internal server error" });
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

export default router;
