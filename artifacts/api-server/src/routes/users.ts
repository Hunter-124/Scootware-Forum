import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, profilePostsTable, inviteCodesTable, inviteRequestsTable, siteConfigTable, productAccessTable, profilePostAttachmentsTable, postsTable, accountChangesTable } from "@workspace/db";
import { eq, desc, and, gt, sql } from "drizzle-orm";
import { avatarUpload, processAndSaveAvatar, postAttachmentUpload, savePostAttachment } from "../lib/upload";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcrypt";

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
    const [user] = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        upgradeType: usersTable.upgradeType,
        upgradeExpiresAt: usersTable.upgradeExpiresAt,
        avatarUrl: usersTable.avatarUrl,
        aboutMe: usersTable.aboutMe,
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

    const activeProducts = await getUserActiveProducts(userId);

    // Check if invite mode is enabled to determine if we should count invites
    const siteConfigRows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "inviteRequestMode"));
    const inviteMode = siteConfigRows.length > 0 ? siteConfigRows[0].value : "admin";
    
    let inviteCount = 0;
    if (inviteMode === "invite") {
      // Count invites created by this user
      const inviteCountResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(inviteCodesTable)
        .where(eq(inviteCodesTable.createdBy, userId));
      inviteCount = inviteCountResult[0]?.count || 0;
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
      user: mapUser(user, activeProducts, inviteCount),
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

router.patch("/:userId/about-me", requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as any);
  const currentUser = req.user as any;
  const { aboutMe } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  if (currentUser.id !== userId && currentUser.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (typeof aboutMe !== "string") {
    res.status(400).json({ error: "About me must be a string" });
    return;
  }

  if (aboutMe.length > 2000) {
    res.status(400).json({ error: "About me must be 2000 characters or less" });
    return;
  }

  // Validate that aboutMe doesn't contain script tags or dangerous HTML
  const dangerousPatterns = /<script|javascript:|on\w+\s*=|iframe|embed|object/gi;
  if (dangerousPatterns.test(aboutMe)) {
    res.status(400).json({ error: "About me contains invalid content" });
    return;
  }

  try {
    await db.update(usersTable).set({ aboutMe: aboutMe || null }).where(eq(usersTable.id, userId));
    res.json({ message: "About me updated", aboutMe: aboutMe || null });
  } catch (err) {
    req.log.error({ err }, "Update about me error");
    res.status(500).json({ error: "Failed to update about me" });
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
      // Auto-approve and generate invite code with strong entropy
      const code = crypto.randomBytes(32).toString('hex').toUpperCase().slice(0, 32);
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

const updateProfilePostSchema = z.object({
  content: z.string().min(1).max(2000),
});

router.put("/:userId/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string);
  const postId = parseInt(req.params.postId as string);
  const currentUser = req.user as any;
  const parse = updateProfilePostSchema.safeParse(req.body);

  if (isNaN(userId) || isNaN(postId)) {
    res.status(400).json({ error: "Invalid user ID or post ID" });
    return;
  }

  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    const [post] = await db
      .select()
      .from(profilePostsTable)
      .where(eq(profilePostsTable.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Only the author or admin can edit a profile post
    if (post.authorId !== currentUser.id && currentUser.role !== "admin") {
      res.status(403).json({ error: "You can only edit your own posts" });
      return;
    }

    const now = new Date();
    const [updatedPost] = await db
      .update(profilePostsTable)
      .set({
        content: parse.data.content,
        updatedAt: now,
      })
      .where(eq(profilePostsTable.id, postId))
      .returning();

    res.status(200).json({
      id: updatedPost.id,
      content: updatedPost.content,
      authorId: updatedPost.authorId,
      profileUserId: updatedPost.profileUserId,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Update profile post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get attachments for a profile post
router.get("/:userId/posts/:postId/attachments", async (req: Request, res: Response) => {
  const postId = parseInt(req.params.postId as string);
  const userId = parseInt(req.params.userId as string);

  if (isNaN(postId) || isNaN(userId)) {
    res.status(400).json({ error: "Invalid post ID or user ID" });
    return;
  }

  try {
    const [post] = await db
      .select()
      .from(profilePostsTable)
      .where(eq(profilePostsTable.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Verify the post belongs to the requested user
    if (post.profileUserId !== userId) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const attachments = await db
      .select({
        id: profilePostAttachmentsTable.id,
        filename: profilePostAttachmentsTable.filename,
        originalFilename: profilePostAttachmentsTable.originalFilename,
        filesize: profilePostAttachmentsTable.filesize,
        mimeType: profilePostAttachmentsTable.mimeType,
        filePath: profilePostAttachmentsTable.filePath,
        uploadedBy: profilePostAttachmentsTable.uploadedBy,
        uploadedByUsername: usersTable.username,
        uploadedAt: profilePostAttachmentsTable.uploadedAt,
      })
      .from(profilePostAttachmentsTable)
      .leftJoin(usersTable, eq(profilePostAttachmentsTable.uploadedBy, usersTable.id))
      .where(eq(profilePostAttachmentsTable.profilePostId, postId))
      .orderBy(desc(profilePostAttachmentsTable.uploadedAt));

    res.json(attachments.map((a: any) => ({
      ...a,
      uploadedByUsername: a.uploadedByUsername || "Unknown",
    })));
  } catch (err) {
    req.log.error({ err }, "Get profile post attachments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload attachment to a profile post
router.post("/:userId/posts/:postId/attachments", requireAuth, postAttachmentUpload.array("files", 5), async (req: Request, res: Response) => {
  const currentUser = req.user as any;
  const postId = parseInt(req.params.postId as string);

  if (isNaN(postId)) {
    res.status(400).json({ error: "Invalid post ID" });
    return;
  }

  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  try {
    const [post] = await db
      .select()
      .from(profilePostsTable)
      .where(eq(profilePostsTable.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    // Only the post author or admin can add attachments
    if (post.authorId !== currentUser.id && currentUser.role !== "admin") {
      res.status(403).json({ error: "You can only add attachments to your own posts" });
      return;
    }

    const uploadedAttachments = [];
    for (const file of req.files) {
      const { filename, filePath } = await savePostAttachment(file.buffer, file.originalname);
      const [attachment] = await db
        .insert(profilePostAttachmentsTable)
        .values({
          profilePostId: postId,
          filename,
          originalFilename: file.originalname,
          filesize: file.size,
          mimeType: file.mimetype,
          filePath,
          uploadedBy: currentUser.id,
        })
        .returning();

      uploadedAttachments.push({
        id: attachment.id,
        filename: attachment.filename,
        originalFilename: attachment.originalFilename,
        filesize: attachment.filesize,
        mimeType: attachment.mimeType,
        filePath: attachment.filePath,
        uploadedBy: currentUser.id,
        uploadedByUsername: currentUser.username,
        uploadedAt: attachment.uploadedAt,
      });
    }

    res.status(201).json(uploadedAttachments);
  } catch (err) {
    req.log.error({ err }, "Upload profile post attachment error");
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// Delete an attachment from a profile post
router.delete("/:userId/posts/attachments/:attachmentId", requireAuth, async (req: Request, res: Response) => {
  const currentUser = req.user as any;
  const attachmentId = parseInt(req.params.attachmentId as string);

  if (isNaN(attachmentId)) {
    res.status(400).json({ error: "Invalid attachment ID" });
    return;
  }

  try {
    const [attachment] = await db
      .select()
      .from(profilePostAttachmentsTable)
      .where(eq(profilePostAttachmentsTable.id, attachmentId))
      .limit(1);

    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    const [post] = await db
      .select()
      .from(profilePostsTable)
      .where(eq(profilePostsTable.id, attachment.profilePostId))
      .limit(1);

    // Only the uploader, post author, or admin can delete
    if (attachment.uploadedBy !== currentUser.id && post.authorId !== currentUser.id && currentUser.role !== "admin") {
      res.status(403).json({ error: "You don't have permission to delete this attachment" });
      return;
    }

    await db.delete(profilePostAttachmentsTable).where(eq(profilePostAttachmentsTable.id, attachmentId));

    res.json({ message: "Attachment deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete profile post attachment error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user account
router.delete("/:userId/delete", requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string);
  const currentUser = req.user as any;
  const { password } = req.body;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Only allow users to delete their own account (unless admin)
  if (currentUser.id !== userId && currentUser.role !== "admin") {
    res.status(403).json({ error: "You can only delete your own account" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // If user has a password (not SSO-only), require password verification
    if (user.passwordHash) {
      if (!password || typeof password !== "string") {
        res.status(400).json({ error: "Password required for account deletion" });
        return;
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        res.status(401).json({ error: "Invalid password" });
        return;
      }
    }

    // Delete the user (cascade delete will handle related data)
    await db.delete(usersTable).where(eq(usersTable.id, userId));

    // If the current user is deleting their own account, log them out
    if (currentUser.id === userId) {
      req.logout((err) => {
        if (err) {
          req.log.error({ err }, "Logout after account deletion error");
        }
        res.json({ message: "Account deleted successfully" });
      });
    } else {
      // Admin deleting another user
      res.json({ message: "Account deleted successfully" });
    }
  } catch (err) {
    req.log.error({ err }, "Delete account error");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// Change username for authenticated user (requires current password if account has one, or new password for SSO-only accounts)
const changeUsernameSchema = z.object({
  newUsername: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

router.patch("/:userId/username", requireAuth, async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string);
  const currentUser = req.user as any;

  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  // Only allow users to change their own username (unless admin)
  if (currentUser.id !== userId && currentUser.role !== "admin") {
    res.status(403).json({ error: "You can only change your own username" });
    return;
  }

  const parse = changeUsernameSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { newUsername, currentPassword, newPassword } = parse.data;

  try {
    // Get site config for rate limiting
    const configRows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "rateLimitChangeUsernamePerWindow"));
    const maxAttempts = configRows.length > 0 ? Number(configRows[0].value) : 3;
    
    const windowMsRows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.key, "rateLimitChangeUsernameWindowMs"));
    const windowMs = windowMsRows.length > 0 ? Number(windowMsRows[0].value) : 86400000;

    // Check rate limiting
    const fromTime = new Date(Date.now() - windowMs);
    const recentChanges = await db
      .select()
      .from(accountChangesTable)
      .where(
        and(
          eq(accountChangesTable.userId, userId),
          eq(accountChangesTable.changeType, "username"),
          gt(accountChangesTable.changedAt, fromTime)
        )
      );

    if (recentChanges.length >= maxAttempts) {
      const remaining = Math.ceil((recentChanges[0].changedAt.getTime() + windowMs - Date.now()) / 1000 / 3600);
      res.status(429).json({ 
        error: `Too many username changes. Please try again in ${remaining} hour${remaining === 1 ? "" : "s"}.`,
        retryAfter: remaining * 3600
      });
      return;
    }

    // Fetch current user from DB
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Verify current password if user has one
    if (user.passwordHash) {
      // User has password - require current password verification
      if (!currentPassword) {
        res.status(400).json({ error: "Current password is required" });
        return;
      }
      const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!passwordValid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }
    } else {
      // SSO-only user - require them to create a password first before changing username
      res.status(403).json({ 
        error: "You must create a password before changing your username.",
        requiresPassword: true 
      });
      return;
    }

    // Check if username is already taken
    if (newUsername !== user.username) {
      const [existing] = await db.select().from(usersTable)
        .where(eq(usersTable.username, newUsername)).limit(1);
      if (existing) {
        res.status(400).json({ error: "Username already taken" });
        return;
      }
    } else {
      res.status(400).json({ error: "New username must be different from current username" });
      return;
    }

    const oldUsername = user.username;

    // Update username
    const [updated] = await db.update(usersTable).set({ username: newUsername })
      .where(eq(usersTable.id, userId)).returning();

    // Track the change
    await db.insert(accountChangesTable).values({
      userId: userId,
      changeType: "username",
      oldValue: oldUsername,
      newValue: newUsername,
    });

    res.json({ message: "Username changed successfully.", username: newUsername });
  } catch (err) {
    req.log.error({ err }, "Change username error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

async function getUserActiveProducts(userId: number) {
  const now = new Date();
  const activeProducts = await db
    .select()
    .from(productAccessTable)
    .where(and(eq(productAccessTable.userId, userId), gt(productAccessTable.expiresAt, now)));
  
  return activeProducts.map((p: any) => {
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

function mapUser(user: any, activeProducts: any[] = [], inviteCount: number = 0) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    upgradeType: user.upgradeType ?? null,
    upgradeExpiresAt: user.upgradeExpiresAt ?? null,
    activeProducts,
    avatarUrl: user.avatarUrl ?? null,
    aboutMe: user.aboutMe ?? null,
    isBanned: user.isBanned,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    postCount: user.postCount,
    inviteCount,
  };
}
