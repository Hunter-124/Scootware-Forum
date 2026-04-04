import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { shoutboxTable, usersTable, shoutboxRateLimitTable, siteConfigTable } from "@workspace/db";
import { eq, desc, and, gt, lt, or, isNull } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// Dynamic schema - will be updated with configurable max length from config
let messageSchema = z.object({
  content: z.string().min(1).max(500),
});

// Create message schema with configurable max length
function createMessageSchema(maxLength: number) {
  return z.object({
    content: z.string().min(1).max(maxLength),
  });
}

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

// Get rate limiting config with defaults
async function getRateLimitConfig() {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(
        or(
          eq(siteConfigTable.key, "shoutboxRateLimitPerWindow"),
          eq(siteConfigTable.key, "shoutboxRateLimitWindowMs"),
          eq(siteConfigTable.key, "shoutboxRateLimitStrikeDecayMs"),
          eq(siteConfigTable.key, "shoutboxRateLimitMaxStrikes")
        )
      );

    const config: any = {
      messagesPerWindow: 5,
      windowMs: 10000,
      strikeDecayMs: 3600000, // 1 hour in milliseconds
      maxStrikes: 3,
    };

    for (const row of rows) {
      if (row.key === "shoutboxRateLimitPerWindow") config.messagesPerWindow = parseInt(row.value);
      else if (row.key === "shoutboxRateLimitWindowMs") config.windowMs = parseInt(row.value);
      else if (row.key === "shoutboxRateLimitStrikeDecayMs") config.strikeDecayMs = parseInt(row.value);
      else if (row.key === "shoutboxRateLimitMaxStrikes") config.maxStrikes = parseInt(row.value);
    }

    return config;
  } catch (e) {
    return {
      messagesPerWindow: 5,
      windowMs: 10000,
      strikeDecayMs: 3600000, // 1 hour in milliseconds
      maxStrikes: 3,
    };
  }
}

// Get shoutbox-specific config (max messages, max character length)
async function getShoutboxConfig() {
  try {
    const rows = await db
      .select()
      .from(siteConfigTable)
      .where(
        or(
          eq(siteConfigTable.key, "shoutboxMaxMessages"),
          eq(siteConfigTable.key, "shoutboxMaxCharacters")
        )
      );

    const config: any = {
      maxMessages: 50,
      maxCharacters: 500,
    };

    for (const row of rows) {
      if (row.key === "shoutboxMaxMessages") config.maxMessages = parseInt(row.value);
      else if (row.key === "shoutboxMaxCharacters") config.maxCharacters = parseInt(row.value);
    }

    return config;
  } catch (e) {
    return {
      maxMessages: 50,
      maxCharacters: 500,
    };
  }
}

// Check and apply rate limiting
async function checkRateLimit(userId: number): Promise<{ allowed: boolean; reason?: string; retryAfter?: number }> {
  try {
    const config = await getRateLimitConfig();

    // Get or create rate limit record
    let rateLimitRecord = await db
      .select()
      .from(shoutboxRateLimitTable)
      .where(eq(shoutboxRateLimitTable.userId, userId));

    let record = rateLimitRecord[0];

    if (!record) {
      // Create new record
      const [newRecord] = await db
        .insert(shoutboxRateLimitTable)
        .values({ userId, strikes: 0 })
        .returning();
      record = newRecord;
    }

    // Check if currently blocked
    if (record.blockedUntil && record.blockedUntil > new Date()) {
      const retryAfter = Math.ceil((record.blockedUntil.getTime() - Date.now()) / 1000);
      return {
        allowed: false,
        reason: `Rate limited. Try again in ${retryAfter}s.`,
        retryAfter,
      };
    }

    // Decay old strikes
    if (record.lastViolationAt) {
      const timeSinceLastViolation = Date.now() - record.lastViolationAt.getTime();
      if (timeSinceLastViolation > config.strikeDecayMs) {
        // Strikes have decayed, reset
        if (record.strikes > 0) {
          await db
            .update(shoutboxRateLimitTable)
            .set({ strikes: 0, lastViolationAt: null })
            .where(eq(shoutboxRateLimitTable.id, record.id!));
          record.strikes = 0;
        }
      }
    }

    // Count recent messages in current window
    const windowStart = new Date(Date.now() - config.windowMs);
    const recentMessages = await db
      .select()
      .from(shoutboxTable)
      .where(and(eq(shoutboxTable.authorId, userId), gt(shoutboxTable.createdAt, windowStart)));

    if (recentMessages.length >= config.messagesPerWindow) {
      // Rate limit violated
      const newStrikes = record.strikes + 1;
      const blockedUntil = newStrikes >= config.maxStrikes ? new Date(Date.now() + config.windowMs * 5) : null;

      await db
        .update(shoutboxRateLimitTable)
        .set({
          strikes: newStrikes,
          lastViolationAt: new Date(),
          blockedUntil,
        })
        .where(eq(shoutboxRateLimitTable.id, record.id!));

      if (blockedUntil) {
        return {
          allowed: false,
          reason: `Too many messages. Blocked for 5 windows (${Math.ceil((config.windowMs * 5) / 1000)}s).`,
          retryAfter: Math.ceil((config.windowMs * 5) / 1000),
        };
      }

      return {
        allowed: false,
        reason: `Too many messages (${config.messagesPerWindow} per ${Math.ceil(config.windowMs / 1000)}s). Strike ${newStrikes}/${config.maxStrikes}.`,
      };
    }

    // Clear block if expired and reset strikes if enough time passed
    if (record.blockedUntil && record.blockedUntil <= new Date()) {
      await db
        .update(shoutboxRateLimitTable)
        .set({
          blockedUntil: null,
          strikes: 0,
          lastViolationAt: null,
        })
        .where(eq(shoutboxRateLimitTable.id, record.id!));
    }

    return { allowed: true };
  } catch (error) {
    // Log error but allow request (fail open)
    console.error("Rate limit check error:", error);
    return { allowed: true }; // Fail open
  }
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

  // Get shoutbox config
  const shoutboxConfig = await getShoutboxConfig();
  
  // Create schema with configurable max length
  const schema = createMessageSchema(shoutboxConfig.maxCharacters);
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }

  let content = parse.data.content;
    let authorId = user.id;

  try {
    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(user.id);
    if (!rateLimitCheck.allowed) {
      res.status(429).json({
        error: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
      });
      return;
    }

    // Handle /roll command
    if (content.toLowerCase() === "/roll") {
      const total = Math.floor(Math.random() * 12) + 2;
      content = `🎲 ${total}`;
      
      // Get or create Scoot-bot user for roll messages
      let scootBot = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, "Scoot-bot"))
        .limit(1);
      
      if (!scootBot || scootBot.length === 0) {
        // Create Scoot-bot user if it doesn't exist
        const [newBot] = await db
          .insert(usersTable)
          .values({
            username: "Scoot-bot",
            email: "scoot-bot@scootware.local",
            passwordHash: "",
            role: "user",
            isEmailVerified: true,
          })
          .returning();
        scootBot = [newBot];
      }
      
      authorId = scootBot[0].id;
    }

    // Handle /clear command
    if (content.toLowerCase() === "/clear") {
      if (user.role !== "admin") {
        res.status(403).json({ error: "Only admins can use /clear command" });
        return;
      }
      // Delete all messages
      await db.delete(shoutboxTable);
      res.status(200).json({ message: "Shoutbox cleared" });
      return;
    }

    const [message] = await db
      .insert(shoutboxTable)
      .values({
        content,
        authorId,
      })
      .returning();

    // Prune old messages if exceeding max
    const totalMessages = await db.select().from(shoutboxTable);
    if (totalMessages.length > shoutboxConfig.maxMessages) {
      const messagesToDelete = totalMessages.length - shoutboxConfig.maxMessages;
      const oldestMessages = await db
        .select()
        .from(shoutboxTable)
        .orderBy(shoutboxTable.createdAt)
        .limit(messagesToDelete);

      if (oldestMessages.length > 0) {
        const idsToDelete = oldestMessages.map((m: any) => m.id);
        await db
          .delete(shoutboxTable)
          .where(shoutboxTable.id.inArray(idsToDelete));
      }
    }

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

