import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, siteConfigTable } from "@workspace/db";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
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
  upgradeType: z.enum(["basic", "premium", "lifetime"]).nullable().optional(),
  upgradeExpiresAt: z.string().datetime().nullable().optional(),
}).strict();

router.patch("/users/:userId", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
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
  const userId = parseInt(req.params.userId);
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
  const userId = parseInt(req.params.userId);
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

const CONFIG_KEYS = ["siteName", "siteDescription", "maintenanceMode", "allowRegistration", "requireEmailVerification"];

router.get("/config", async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(siteConfigTable);
    const config: any = {
      siteName: "Scootware Forum",
      siteDescription: "The official Scootware driver tools community",
      maintenanceMode: false,
      allowRegistration: true,
      requireEmailVerification: true,
    };
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "allowRegistration" || row.key === "requireEmailVerification") {
        config[row.key] = row.value === "true";
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
      await db.insert(siteConfigTable)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: siteConfigTable.key, set: { value: String(value) } });
    }

    // Return updated config
    const rows = await db.select().from(siteConfigTable);
    const config: any = {
      siteName: "Scootware Forum",
      siteDescription: "The official Scootware driver tools community",
      maintenanceMode: false,
      allowRegistration: true,
      requireEmailVerification: true,
    };
    for (const row of rows) {
      if (row.key === "maintenanceMode" || row.key === "allowRegistration" || row.key === "requireEmailVerification") {
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
