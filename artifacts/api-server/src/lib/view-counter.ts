/**
 * view-counter.ts
 * ===============
 * Batches thread view count increments to reduce database write load.
 * 
 * Instead of writing to the database on every single view, we accumulate
 * view increments in memory and flush them in batches every 5 seconds.
 * This dramatically reduces write contention and CPU usage.
 */

import { db, threadsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

const VIEW_COUNTER_BATCH_INTERVAL_MS = Number(
  process.env.VIEW_COUNTER_BATCH_INTERVAL_MS || "5000"
); // 5 seconds
const VIEW_COUNTER_ENABLED = process.env.VIEW_COUNTER_BATCHING_ENABLED !== "false";

// Map: threadId -> increment count
const viewCounts = new Map<number, number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Record a view for a thread without immediately writing to DB
 */
export function recordThreadView(threadId: number): void {
  if (!VIEW_COUNTER_ENABLED) {
    // Fallback: if batching is disabled, write directly (legacy behavior)
    recordThreadViewDirect(threadId).catch((err) => {
      logger.error({ err, threadId }, "Error recording thread view directly");
    });
    return;
  }

  viewCounts.set(threadId, (viewCounts.get(threadId) || 0) + 1);

  // Start flush timer if not already running
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushViewCounts().catch((err) => {
        logger.error({ err }, "Error flushing view counts");
      });
    }, VIEW_COUNTER_BATCH_INTERVAL_MS);
  }
}

/**
 * Flush all accumulated view counts to the database in a batch
 */
async function flushViewCounts(): Promise<void> {
  if (viewCounts.size === 0) {
    flushTimer = null;
    return;
  }

  const batch = Array.from(viewCounts.entries());
  viewCounts.clear();
  flushTimer = null;

  try {
    // Execute updates in parallel for better performance
    await Promise.all(
      batch.map(([threadId, increment]) =>
        db
          .update(threadsTable)
          .set({ viewCount: sql`${threadsTable.viewCount} + ${increment}` })
          .where(eq(threadsTable.id, threadId))
      )
    );

    logger.debug(
      { threadCount: batch.length, totalViews: batch.reduce((sum, [_, inc]) => sum + inc, 0) },
      "Flushed batched view counts"
    );
  } catch (err) {
    logger.error({ err }, "Failed to flush view counts");

    // Put counts back for retry next tick
    batch.forEach(([threadId, increment]) => {
      viewCounts.set(threadId, (viewCounts.get(threadId) || 0) + increment);
    });

    // Reschedule flush
    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushViewCounts().catch((err) => {
          logger.error({ err }, "Error flushing view counts (retry)");
        });
      }, VIEW_COUNTER_BATCH_INTERVAL_MS);
    }
  }
}

/**
 * Direct database update (fallback or legacy behavior)
 */
async function recordThreadViewDirect(threadId: number): Promise<void> {
  await db
    .update(threadsTable)
    .set({ viewCount: sql`${threadsTable.viewCount} + 1` })
    .where(eq(threadsTable.id, threadId));
}

/**
 * Force a flush of all pending view counts
 * Useful for graceful shutdown
 */
export async function flushPendingViews(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushViewCounts();
}
