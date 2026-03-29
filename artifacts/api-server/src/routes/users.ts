import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, profilePostsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { avatarUpload, processAndSaveAvatar } from "../lib/upload";
import { z } from "zod";

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
  const userId = parseInt(req.params.userId);
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
      recentPosts: recentPosts.map(p => ({
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
  const userId = parseInt(req.params.userId);
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
  const userId = parseInt(req.params.userId);
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

    res.json(posts.map(p => ({
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
  const userId = parseInt(req.params.userId);
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
