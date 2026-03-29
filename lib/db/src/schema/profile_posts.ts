import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const profilePostsTable = pgTable("profile_posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  profileUserId: integer("profile_user_id").notNull().references(() => usersTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProfilePost = typeof profilePostsTable.$inferSelect;
