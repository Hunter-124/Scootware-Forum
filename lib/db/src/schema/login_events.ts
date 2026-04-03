import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const loginEventsTable = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  ip: text("ip").notNull(),
  userAgent: text("user_agent"),
  eventType: text("event_type").notNull().default("login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLoginEventSchema = createInsertSchema(loginEventsTable).omit({ id: true, createdAt: true });
export type InsertLoginEvent = any; // Type inference issue with drizzle-zod, using any as temporary fix
export type LoginEvent = typeof loginEventsTable.$inferSelect;
