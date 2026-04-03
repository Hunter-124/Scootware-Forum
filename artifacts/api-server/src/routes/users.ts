import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, profilePostsTable, inviteCodesTable, inviteRequestsTable, siteConfigTable } from "@workspace/db";
import { eq, desc, and, gt } from "drizzle-orm";
import { avatarUpload, processAndSaveAvatar } from "../lib/upload";
import { z } from "zod";
import crypto from "crypto";

const router: IRouter = Router();

const profilePostSchema = z.object({
  content: z.string().min(1).max(2000),
});

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/:userId", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const recentPosts = await db
      .select({
        id: profilePostsTable.id,
        content: profilePostsTable.content,
        authorId: profilePostsTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        createdAt: profilePostsTable.createdAt,
      })
      .from(profilePostsTable)
      .leftJoin(usersTable, eq(profilePostsTable.authorId, usersTable.id))
      .where(eq(profilePostsTable.profileUserId, userId))
      .orderBy(desc(profilePostsTable.createdAt))
      .limit(20);

    res.json({
      user: mapUser(user),
      recentPosts: recentPosts.map((p: any) => ({
        ...p,
        authorUsername: p.authorUsername || "Unknown",
        authorAvatarUrl: p.authorAvatarUrl ?? null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get user profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:userId/avatar", requireAuth, avatarUpload.single("avatar"), async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentUser = req.user as any;

  if (currentUser.id !== userId && currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const avatarUrl = await processAndSaveAvatar(req.file.buffer, userId);
    await db.update(usersTable).set({ avatarUrl }).where(eq(usersTable.id, userId));
    res.json({ message: "Avatar updated", avatarUrl });
  } catch (err) {
    req.log.error({ err }, "Avatar upload error");
    res.status(400).json({ error: "Failed to process image" });
  }
});

router.get("/:userId/posts", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const posts = await db
      .select({
        id: profilePostsTable.id,
        content: profilePostsTable.content,
        authorId: profilePostsTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        createdAt: profilePostsTable.createdAt,
      })
      .from(profilePostsTable)
      .leftJoin(usersTable, eq(profilePostsTable.authorId, usersTable.id))
      .where(eq(profilePostsTable.profileUserId, userId))
      .orderBy(desc(profilePostsTable.createdAt))
      .limit(50);

    res.json(posts.map((p: any) => ({
      ...p,
      authorUsername: p.authorUsername || "Unknown",
      authorAvatarUrl: p.authorAvatarUrl ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Get profile posts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:userId/posts", requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string);
  const currentUser = req.user as any;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const parse = profilePostSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [post] = await db.insert(profilePostsTable).values({
      content: parse.data.content,
      profileUserId: userId,
      authorId: currentUser.id,
    }).returning();

    res.status(201).json({
      id: post.id,
      content: post.content,
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorAvatarUrl: currentUser.avatarUrl ?? null,
      createdAt: post.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Create profile post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me/invites", requireAuth, async (req: Request, res: Response) => {
  const currentUser = req.user as any;

  try {
    // Get all invites created by the current user
    const invites = await db
      .select({
        id: inviteCodesTable.id,
        code: inviteCodesTable.code,
        productId: inviteCodesTable.productId,
        createdAt: inviteCodesTable.createdAt,
        expiresAt: inviteCodesTable.expiresAt,
        isUsed: inviteCodesTable.isUsed,
        usedBy: inviteCodesTable.usedBy,
        usedAt: inviteCodesTable.usedAt,
        isBanned: inviteCodesTable.isBanned,
        usedByUsername: usersTable.username,
        usedByAvatarUrl: usersTable.avatarUrl,
      })
      .from(inviteCodesTable)
      .leftJoin(usersTable, eq(inviteCodesTable.usedBy, usersTable.id))
      .where(eq(inviteCodesTable.createdBy, currentUser.id))
      .orderBy(desc(inviteCodesTable.createdAt));

    res.json({
      invites: invites.map((inv: any) => ({
        id: inv.id,
        code: inv.code,
        productId: inv.productId ?? null,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt ?? null,
        isUsed: inv.isUsed,
        usedBy: inv.usedBy ?? null,
        usedByUsername: inv.usedByUsername ?? null,
        usedByAvatarUrl: inv.usedByAvatarUrl ?? null,
        usedAt: inv.usedAt ?? null,
        isBanned: inv.isBanned,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get user invites error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/me/request-invite", requireAuth, async (req: Request, res: Response): Promise<any> => {
  const currentUser = req.user as any;
  const { reason } = req.body;

  if (typeof reason !== "undefined" && typeof reason !== "string") {
    res.status(400).json({ error: "Reason must be a string" });
    return;
  }

  try {
    // Get site config to check cooldown
    const configRows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "inviteRequestCooldownDays"));
    const cooldown = configRows.length > 0 ? Number(configRows[0].value) || 7 : 7;

    // Check if user has requested recently
    const fromTime = new Date(Date.now() - cooldown * 24 * 60 * 60 * 1000);
    const recent = await db.select().from(inviteRequestsTable)
      .where(and(
        eq(inviteRequestsTable.email, currentUser.email.toLowerCase()),
        gt(inviteRequestsTable.createdAt, fromTime)
      ));

    if (recent.length > 0) {
      res.status(429).json({ error: `Please wait ${cooldown} days between invite requests.` });
      return;
    }

    // Create invite request
    const [newReq] = await db.insert(inviteRequestsTable).values({
      email: currentUser.email.toLowerCase(),
      username: currentUser.username,
      reason: reason || null,
      status: 'pending',
    }).returning();

    // Check if auto mode is enabled
    const configRows2 = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "inviteRequestMode"));
    const inviteRequestMode = configRows2.length > 0 ? configRows2[0].value : "admin";

    if (inviteRequestMode === 'auto') {
      // Auto-approve and generate invite code
      const code = crypto.randomBytes(12).toString('base64url').replace(/[-_]/g, '').slice(0, 16).toUpperCase();
      await db.insert(inviteCodesTable).values({ code, createdBy: currentUser.id });
      await db.update(inviteRequestsTable).set({ status: 'approved', processedAt: new Date() }).where(eq(inviteRequestsTable.id, newReq.id));
      res.json({ message: 'Invite automatically granted. Check your profile for your invite code.' });
      return;
    }

    res.json({ message: 'Invite request received and pending admin approval' });
  } catch (err) {
    req.log.error({ err }, "Request invite error");
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
