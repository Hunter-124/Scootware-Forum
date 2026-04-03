"use server";

import { db, threadsTable, postsTable, subforumsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createThreadAction(prevState: any, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const subforumIdStr = formData.get("subforumId") as string;
  const subforumId = parseInt(subforumIdStr);

  if (!title || !content || isNaN(subforumId)) {
    return { error: "All fields are required" };
  }

  try {
    const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, subforumId)).limit(1);
    if (!subforum) return { error: "Subforum not found" };
    
    if (subforum.isReadOnly && user.role !== "admin") {
      return { error: "This subforum is read-only" };
    }

    if (subforum.requiresUpgrade && user.role !== "admin") {
      if (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date())) {
        return { error: "Upgrade required to access this section" };
      }
    }

    const [thread] = await db.insert(threadsTable).values({
      title,
      subforumId,
      authorId: user.id,
      lastPostAt: new Date(),
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

    revalidatePath(`/f/${subforumId}`);
    return { success: true, threadId: thread.id };
  } catch (err) {
    console.error("Create thread error:", err);
    return { error: "Internal server error" };
  }
}

export async function createPostAction(prevState: any, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const threadIdStr = formData.get("threadId") as string;
  const threadId = parseInt(threadIdStr);

  if (!content || isNaN(threadId)) {
    return { error: "Content is required" };
  }

  try {
    const [thread] = await db.select().from(threadsTable).where(eq(threadsTable.id, threadId)).limit(1);
    if (!thread) return { error: "Thread not found" };
    
    if (thread.isLocked && user.role !== "admin") {
      return { error: "This thread is locked" };
    }

    await db.insert(postsTable).values({
      content,
      threadId,
      authorId: user.id,
    });

    await db.update(threadsTable).set({
      replyCount: sql`${threadsTable.replyCount} + 1`,
      lastPostAt: new Date(),
    }).where(eq(threadsTable.id, threadId));

    await db.update(subforumsTable).set({
      postCount: sql`${subforumsTable.postCount} + 1`,
    }).where(eq(subforumsTable.id, thread.subforumId));

    await db.update(usersTable).set({
      postCount: sql`${usersTable.postCount} + 1`,
    }).where(eq(usersTable.id, user.id));

    revalidatePath(`/t/${threadId}`);
    return { success: true };
  } catch (err) {
    console.error("Create post error:", err);
    return { error: "Internal server error" };
  }
}
