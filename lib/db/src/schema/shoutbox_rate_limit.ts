import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const shoutboxRateLimitTable = pgTable("shoutbox_rate_limit", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  strikes: integer("strikes").notNull().default(0),
  lastViolationAt: timestamp("last_violation_at"),
  blockedUntil: timestamp("blocked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // For quick user lookups
  index("idx_shoutbox_rate_limit_user_id").on(table.userId),
  // For finding expired blocks
  index("idx_shoutbox_rate_limit_blocked_until").on(table.blockedUntil),
]);

export type ShoutboxRateLimit = typeof shoutboxRateLimitTable.$inferSelect;
