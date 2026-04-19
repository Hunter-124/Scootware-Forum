import { pgTable, serial, integer, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const hwidResetStatusEnum = pgEnum("hwid_reset_status", ["pending", "approved", "denied"]);

export const hwidResetRequestsTable = pgTable("hwid_reset_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),

  // Currently bound HWID (the one on the account before reset)
  oldHwid: text("old_hwid"),
  // Hardware snapshot of the old machine: { cpu: string, gpu: string, ramGb: number }
  oldHwidDetails: jsonb("old_hwid_details"),
  // Locations the old HWID was seen at: [{ ip, city, country, lat, lon, seenAt }]
  oldHwidLocations: jsonb("old_hwid_locations"),

  // New HWID from the failed stream attempt
  newHwid: text("new_hwid").notNull(),
  // Hardware snapshot of the new machine
  newHwidDetails: jsonb("new_hwid_details"),

  // IP / geo of the failed attempt
  requestIp: text("request_ip"),
  requestLocation: jsonb("request_location"), // { city, country, lat, lon }

  status: hwidResetStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
}, (table) => [
  index("idx_hwid_reset_user_status").on(table.userId, table.status),
  index("idx_hwid_reset_status_requested").on(table.status, table.requestedAt),
]);

export type HwidResetRequest = typeof hwidResetRequestsTable.$inferSelect;
