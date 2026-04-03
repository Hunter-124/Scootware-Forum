import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { shoutboxTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

const messageSchema = z.object({
  content: z.string().min(1).max(500),
});

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

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"))));
    const messages = await db
      .select({
        id: shoutboxTable.id,
        content: shoutboxTable.content,
        authorId: shoutboxTable.authorId,
        authorUsername: usersTable.username,
        authorAvatarUrl: usersTable.avatarUrl,
        authorRole: usersTable.role,
        createdAt: shoutboxTable.createdAt,
      })
      .from(shoutboxTable)
      .leftJoin(usersTable, eq(shoutboxTable.authorId, usersTable.id))
      .orderBy(desc(shoutboxTable.createdAt))
      .limit(limit);

    res.json(messages.reverse().map((m: any) => ({
      ...m,
      authorUsername: m.authorUsername || "Unknown",
      authorAvatarUrl: m.authorAvatarUrl ?? null,
      authorRole: m.authorRole || "user",
    })));
  } catch (err) {
    req.log.error({ err }, "Get shoutbox error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;
  if (user.isBanned) {
    res.status(403).json({ error: "You are banned" });
    return;
  }

  const parse = messageSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  try {
    const [message] = await db.insert(shoutboxTable).values({
      content: parse.data.content,
      authorId: user.id,
    }).returning();

    res.status(201).json({
      id: message.id,
      content: message.content,
      authorId: user.id,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl ?? null,
      authorRole: user.role,
      createdAt: message.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Post shoutbox error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid message ID" });
    return;
  }

  try {
    const [deleted] = await db.delete(shoutboxTable)
      .where(eq(shoutboxTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Delete shoutbox message error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

