import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  driverId: text("driver_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subforumsTable = pgTable("subforums", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  parentId: integer("parent_id"),
  requiresUpgrade: boolean("requires_upgrade").notNull().default(false),
  isReadOnly: boolean("is_read_only").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  threadCount: integer("thread_count").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const threadsTable = pgTable("threads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subforumId: integer("subforum_id").notNull().references(() => subforumsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  isPinned: boolean("is_pinned").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  replyCount: integer("reply_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  lastPostAt: timestamp("last_post_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  threadId: integer("thread_id").notNull().references(() => threadsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  isFirstPost: boolean("is_first_post").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertThreadSchema = createInsertSchema(threadsTable).omit({
  id: true,
  replyCount: true,
  viewCount: true,
  lastPostAt: true,
  createdAt: true,
});
export type InsertThread = z.infer<typeof insertThreadSchema>;
export type Thread = typeof threadsTable.$inferSelect;

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
