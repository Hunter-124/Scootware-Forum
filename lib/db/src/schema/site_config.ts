import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";

export const siteConfigTable = pgTable("site_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export type SiteConfig = typeof siteConfigTable.$inferSelect;
