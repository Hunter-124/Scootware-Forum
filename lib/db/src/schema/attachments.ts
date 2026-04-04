import { pgTable, text, serial, timestamp, integer, bigint, index } from "drizzle-orm/pg-core";
import { postsTable } from "./forum";
import { usersTable } from "./users";
import { profilePostsTable } from "./profile_posts";

export const postAttachmentsTable = pgTable("post_attachments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => postsTable.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filesize: bigint("filesize", { mode: "number" }).notNull(),
  mimeType: text("mime_type").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => [
  // For fetching attachments for a specific post
  index("idx_post_attachments_post_id").on(table.postId),
  // For user upload history
  index("idx_post_attachments_uploaded_by").on(table.uploadedBy),
]);

export const profilePostAttachmentsTable = pgTable("profile_post_attachments", {
  id: serial("id").primaryKey(),
  profilePostId: integer("profile_post_id").notNull().references(() => profilePostsTable.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filesize: bigint("filesize", { mode: "number" }).notNull(),
  mimeType: text("mime_type").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
}, (table) => [
  // For fetching attachments for a profile post
  index("idx_profile_post_attachments_profile_post_id").on(table.profilePostId),
  // For user upload history
  index("idx_profile_post_attachments_uploaded_by").on(table.uploadedBy),
]);

export type PostAttachment = typeof postAttachmentsTable.$inferSelect;
export type ProfilePostAttachment = typeof profilePostAttachmentsTable.$inferSelect;
