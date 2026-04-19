import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const loaderEventsTable = pgTable("loader_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  hwid: text("hwid"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  // Event type: 'load_attempt', 'load_success', 'load_failed', 'vm_detected', 'debugger_detected', 'anti_cheat_detected'
  eventType: text("event_type").notNull().default("load_attempt"),
  // Detection flags
  vmDetected: boolean("vm_detected").notNull().default(false),
  debuggerDetected: boolean("debugger_detected").notNull().default(false),
  // Extra details / detection reason (e.g., "VMware registry key found", "IsDebuggerPresent returned true")
  details: text("details"),
  // Product the loader was used for
  productId: text("product_id"),
  // Loader version
  loaderVersion: text("loader_version"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_loader_events_user_id_created").on(table.userId, table.createdAt),
  index("idx_loader_events_created_at").on(table.createdAt),
  index("idx_loader_events_event_type").on(table.eventType),
]);

export type LoaderEvent = typeof loaderEventsTable.$inferSelect;
