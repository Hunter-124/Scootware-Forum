import { pgTable, text, serial, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const upgradeTypeEnum = pgEnum("upgrade_type", ["basic", "premium", "lifetime"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("user"),
  upgradeType: upgradeTypeEnum("upgrade_type"),
  upgradeExpiresAt: timestamp("upgrade_expires_at"),
  avatarUrl: text("avatar_url"),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  googleId: text("google_id"),
  discordId: text("discord_id"),
  steamId: text("steam_id"),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  postCount: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
