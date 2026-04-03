import { pgTable, text, serial, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("user_role", ["user", "admin"]);

export const PRODUCT_IDS = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "SPOOFER"] as const;
export type ProductId = typeof PRODUCT_IDS[number];
export const SPOOFER_PRODUCT: ProductId = "SPOOFER";

export const SUBSCRIPTION_TIERS = ["premium", "lifetime"] as const;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[number];

// Generate product-specific subscription types
export const SUBSCRIPTION_TYPES = [
  ...PRODUCT_IDS.flatMap(product =>
    SUBSCRIPTION_TIERS.map(tier => `${product}_${tier.toUpperCase()}`)
  )
] as const;
export type UpgradeType = typeof SUBSCRIPTION_TYPES[number];

export const upgradeTypeEnum = pgEnum("upgrade_type", SUBSCRIPTION_TYPES as [string, ...string[]]);

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
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  googleId: text("google_id"),
  discordId: text("discord_id"),
  steamId: text("steam_id"),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productAccessTable = pgTable("product_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  paymentRef: text("payment_ref"),
});

export const inviteCodesTable = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  productId: text("product_id"),
  expiresAt: timestamp("expires_at"),
  isBanned: boolean("is_banned").notNull().default(false),
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: integer("used_by").references(() => usersTable.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inviteRequestsTable = pgTable("invite_requests", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  postCount: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type ProductAccess = typeof productAccessTable.$inferSelect;
