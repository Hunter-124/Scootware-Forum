import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  categoriesTable, subforumsTable, threadsTable, postsTable, usersTable, productAccessTable,
} from "@workspace/db";
import { eq, desc, sql, and, asc, gt } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const PAGE_SIZE = 20;

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

function requireUpgrade(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (user.role === "admin") return next();
  if (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date())) {
    res.status(403).json({ error: "This section requires an account upgrade" });
    return;
  }
  next();
}

// Helper function to check if user has active product subscription
async function checkProductAccess(userId: number, productId: string | null): Promise<boolean> {
  if (!productId) return true; // No product restriction
  
  const now = new Date();
  const [access] = await db.select()
    .from(productAccessTable)
    .where(and(
      eq(productAccessTable.userId, userId),
      eq(productAccessTable.productId, productId),
      gt(productAccessTable.expiresAt, now)
    ))
    .limit(1);
  
  return !!access;
}

router.get("/categories", async (req: Request, res: Response) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder));
    const subforums = await db.select().from(subforumsTable).orderBy(asc(subforumsTable.sortOrder));

    // Get last post info per subforum
    const lastPosts = await db.execute(sql`
      SELECT DISTINCT ON (t.subforum_id) t.subforum_id, t.title as thread_title, u.username, t.last_post_at as created_at
      FROM threads t
      JOIN users u ON t.author_id = u.id
      ORDER BY t.subforum_id, t.last_post_at DESC NULLS LAST
    `);

    const lastPostMap = new Map<number, any>();
    for (const row of lastPosts.rows as any[]) {
      lastPostMap.set(row.subforum_id, {
        threadTitle: row.thread_title,
        username: row.username,
        createdAt: row.created_at,
      });
    }

    const result = categories.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? null,
      productId: cat.productId ?? null,
      subforums: subforums
        .filter((sf: any) => sf.categoryId === cat.id)
        .map((sf: any) => ({
          id: sf.id,
          name: sf.name,
          description: sf.description ?? null,
          threadCount: sf.threadCount,
          postCount: sf.postCount,
          requiresUpgrade: sf.requiresUpgrade,
          parentId: sf.parentId ?? null,
          lastPost: lastPostMap.get(sf.id) ?? null,
        })),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Get categories error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/threads", async (req: Request, res: Response) => {
  const subforumId = parseInt(String(req.query.subforumId || ""));
  const page = Math.max(1, parseInt(String(req.query.page || "1")));

  if (isNaN(subforumId)) {
    res.status(400).json({ error: "Invalid subforum ID" });
    return;
  }

  try {
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, subforumId)).limit(1);
    if (!subforum) {
      res.status(404).json({ error: "Subforum not found" });
      return;
    }

    // Check access
    if (subforum.requiresUpgrade) {
      const user = req.user as any;
      if (!user) {
        res.status(401).json({ error: "Login required" });
        return;
      }
      if (user.role !== "admin" && (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date()))) {
        res.status(403).json({ error: "Upgrade required to access this section" });
        return;
      }
    }

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(threadsTable).where(eq(threadsTable.subforumId, subforumId));
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const threads = await db
      .select({
        id: threadsTable.id,
        title: threadsTable.title,
        subforumId: threadsTable.subforumId,
        authorId: threadsTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        replyCount: threadsTable.replyCount,
        viewCount: threadsTable.viewCount,
        isPinned: threadsTable.isPinned,
        isLocked: threadsTable.isLocked,
        createdAt: threadsTable.createdAt,
        lastPostAt: threadsTable.lastPostAt,
      })
      .from(threadsTable)
      .leftJoin(usersTable, eq(threadsTable.authorId, usersTable.id))
      .where(eq(threadsTable.subforumId, subforumId))
      .orderBy(desc(threadsTable.isPinned), desc(threadsTable.lastPostAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    res.json({
      threads: threads.map((t: any) => ({
        ...t,
        authorUsername: t.authorUsername || "Unknown",
        authorAvatarUrl: t.authorAvatarUrl ?? null,
        lastPostAt: t.lastPostAt ?? null,
      })),
      total: count,
      page,
      totalPages,
    });
  } catch (err) {
    req.log.error({ err }, "Get threads error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createThreadSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(50000),
  subforumId: z.number().int(),
});

router.post("/threads", requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  const parse = createThreadSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { title, content, subforumId } = parse.data;

  try {
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, subforumId)).limit(1);
    if (!subforum) {
      res.status(404).json({ error: "Subforum not found" });
      return;
    }
    if (subforum.isReadOnly && user.role !== "admin") {
      res.status(403).json({ error: "This subforum is read-only" });
      return;
    }
    if (subforum.requiresUpgrade && user.role !== "admin") {
      if (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date())) {
        res.status(403).json({ error: "Upgrade required" });
        return;
      }
    }

    // Get the category to check posting permissions
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, subforum.categoryId)).limit(1);
    
    if (user.role !== "admin") {
      // Only admins can post in categories that don't allow user posting
      if (!category?.allowUserPosting) {
        res.status(403).json({ error: "Only administrators can post in this category" });
        return;
      }
      
      // Check if user has active subscription to the product
      if (category?.productId) {
        const hasAccess = await checkProductAccess(user.id, category.productId);
        if (!hasAccess) {
          res.status(403).json({ error: "You must have an active subscription to this product to post here" });
          return;
        }
      }
    }

    const now = new Date();
    const [thread] = await db.insert(threadsTable).values({
      title,
      subforumId,
      authorId: user.id,
      lastPostAt: now,
    }).returning();

    await db.insert(postsTable).values({
      content,
      threadId: thread.id,
      authorId: user.id,
      isFirstPost: true,
    });

    await db.update(subforumsTable).set({
      threadCount: sql`${subforumsTable.threadCount} + 1`,
      postCount: sql`${subforumsTable.postCount} + 1`,
    }).where(eq(subforumsTable.id, subforumId));

    await db.update(usersTable).set({
      postCount: sql`${usersTable.postCount} + 1`,
    }).where(eq(usersTable.id, user.id));

    res.status(201).json({
      id: thread.id,
      title: thread.title,
      subforumId: thread.subforumId,
      authorId: thread.authorId,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl ?? null,
      replyCount: 0,
      viewCount: 0,
      isPinned: thread.isPinned,
      isLocked: thread.isLocked,
      createdAt: thread.createdAt,
      lastPostAt: thread.lastPostAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Create thread error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/threads/:threadId", async (req: Request, res: Response) => {
  const threadId = parseInt(req.params.threadId as string);
  const page = Math.max(1, parseInt(String(req.query.page || "1")));

  if (isNaN(threadId)) {
    res.status(400).json({ error: "Invalid thread ID" });
    return;
  }

  try {
    const [threadRow] = await db
      .select({
        id: threadsTable.id,
        title: threadsTable.title,
        subforumId: threadsTable.subforumId,
        authorId: threadsTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        replyCount: threadsTable.replyCount,
        viewCount: threadsTable.viewCount,
        isPinned: threadsTable.isPinned,
        isLocked: threadsTable.isLocked,
        createdAt: threadsTable.createdAt,
        lastPostAt: threadsTable.lastPostAt,
      })
      .from(threadsTable)
      .leftJoin(usersTable, eq(threadsTable.authorId, usersTable.id))
      .where(eq(threadsTable.id, threadId))
      .limit(1);

    if (!threadRow) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    // Check subforum access
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, threadRow.subforumId)).limit(1);
    if (subforum?.requiresUpgrade) {
      const user = req.user as any;
      if (!user) { res.status(401).json({ error: "Login required" }); return; }
      if (user.role !== "admin" && (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date()))) {
        res.status(403).json({ error: "Upgrade required" }); return;
      }
    }

    // Increment view count
    await db.update(threadsTable).set({ viewCount: sql`${threadsTable.viewCount} + 1` }).where(eq(threadsTable.id, threadId));

    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(eq(postsTable.threadId, threadId));
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const author1Table = usersTable;
    const posts = await db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        threadId: postsTable.threadId,
        authorId: postsTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        authorRole: usersTable.role,
        authorUpgradeType: usersTable.upgradeType,
        authorPostCount: usersTable.postCount,
        authorJoinedAt: usersTable.createdAt,
        createdAt: postsTable.createdAt,
        updatedAt: postsTable.updatedAt,
      })
      .from(postsTable)
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(eq(postsTable.threadId, threadId))
      .orderBy(asc(postsTable.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    res.json({
      thread: {
        ...threadRow,
        authorUsername: threadRow.authorUsername || "Unknown",
        authorAvatarUrl: threadRow.authorAvatarUrl ?? null,
        lastPostAt: threadRow.lastPostAt ?? null,
      },
      posts: posts.map((p: any) => ({
        ...p,
        authorUsername: p.authorUsername || "Unknown",
        authorAvatarUrl: p.authorAvatarUrl ?? null,
        authorRole: p.authorRole || "user",
        authorUpgradeType: p.authorUpgradeType ?? null,
        authorPostCount: p.authorPostCount || 0,
        authorJoinedAt: p.authorJoinedAt || new Date(),
        updatedAt: p.updatedAt ?? null,
      })),
      total: count,
      page,
      totalPages,
    });
  } catch (err) {
    req.log.error({ err }, "Get thread error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const createPostSchema = z.object({
  content: z.string().min(1).max(50000),
  threadId: z.number().int(),
});

router.post("/posts", requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  const parse = createPostSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  const { content, threadId } = parse.data;

  try {
    const [thread] = await db.select().from(threadsTable).where(eq(threadsTable.id, threadId)).limit(1);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    if (thread.isLocked && user.role !== "admin") {
      res.status(403).json({ error: "Thread is locked" });
      return;
    }

    // Get subforum and category to check posting permissions
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, thread.subforumId)).limit(1);
    
    if (subforum) {
      const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, subforum.categoryId)).limit(1);
      
      if (user.role !== "admin") {
        // Only admins can post in categories that don't allow user posting
        if (!category?.allowUserPosting) {
          res.status(403).json({ error: "Only administrators can post in this category" });
          return;
        }
        
        // Check if user has active subscription to the product
        if (category?.productId) {
          const hasAccess = await checkProductAccess(user.id, category.productId);
          if (!hasAccess) {
            res.status(403).json({ error: "You must have an active subscription to this product to post here" });
            return;
          }
        }
      }
    }

    const now = new Date();
    const [post] = await db.insert(postsTable).values({
      content,
      threadId,
      authorId: user.id,
    }).returning();

    await db.update(threadsTable).set({
      replyCount: sql`${threadsTable.replyCount} + 1`,
      lastPostAt: now,
    }).where(eq(threadsTable.id, threadId));

    await db.update(subforumsTable).set({
      postCount: sql`${subforumsTable.postCount} + 1`,
    }).where(eq(subforumsTable.id, thread.subforumId));

    await db.update(usersTable).set({
      postCount: sql`${usersTable.postCount} + 1`,
    }).where(eq(usersTable.id, user.id));

    res.status(201).json({
      id: post.id,
      content: post.content,
      threadId: post.threadId,
      authorId: user.id,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl ?? null,
      authorRole: user.role,
      authorUpgradeType: user.upgradeType ?? null,
      authorPostCount: user.postCount + 1,
      authorJoinedAt: user.createdAt,
      createdAt: post.createdAt,
      updatedAt: null,
    });
  } catch (err) {
    req.log.error({ err }, "Create post error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subforums/:subforumId", async (req: Request, res: Response) => {
  const subforumId = parseInt(req.params.subforumId as string);

  if (isNaN(subforumId)) {
    res.status(400).json({ error: "Invalid subforum ID" });
    return;
  }

  try {
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, subforumId)).limit(1);
    if (!subforum) {
      res.status(404).json({ error: "Subforum not found" });
      return;
    }

    // Get the parent category
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, subforum.categoryId)).limit(1);

    // Get last post info
    const lastPosts = await db.execute(sql`
      SELECT DISTINCT ON (t.subforum_id) t.subforum_id, t.title as thread_title, u.username, t.last_post_at as created_at
      FROM threads t
      JOIN users u ON t.author_id = u.id
      WHERE t.subforum_id = ${subforumId}
      ORDER BY t.subforum_id, t.last_post_at DESC NULLS LAST
      LIMIT 1
    `);

    const lastPost = lastPosts.rows && lastPosts.rows.length > 0 ? (lastPosts.rows[0] as any) : null;

    res.json({
      id: subforum.id,
      name: subforum.name,
      description: subforum.description ?? null,
      threadCount: subforum.threadCount,
      postCount: subforum.postCount,
      requiresUpgrade: subforum.requiresUpgrade,
      parentId: subforum.parentId ?? null,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      productId: category?.productId ?? null,
      lastPost: lastPost ? {
        threadTitle: (lastPost as any).thread_title,
        username: (lastPost as any).username,
        createdAt: (lastPost as any).created_at,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "Get subforum error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
