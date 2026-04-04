import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const profilePostsTable = pgTable("profile_posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  profileUserId: integer("profile_user_id").notNull().references(() => usersTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  // For fetching wall posts for a user profile
  index("idx_profile_posts_profile_user_created").on(table.profileUserId, table.createdAt),
  // For finding user's own posts
  index("idx_profile_posts_author_id").on(table.authorId),
]);

export type ProfilePost = typeof profilePostsTable.$inferSelect;
