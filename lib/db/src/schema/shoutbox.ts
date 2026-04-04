import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const shoutboxTable = pgTable("shoutbox", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // For fetching recent shoutbox messages
  index("idx_shoutbox_created_at_desc").on(table.createdAt),
  // For user message history
  index("idx_shoutbox_author_id").on(table.authorId),
]);

export type ShoutboxMessage = typeof shoutboxTable.$inferSelect;
