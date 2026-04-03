import { pgTable, text, serial, integer, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cryptoCoinEnum = pgEnum("crypto_coin", ["BTC", "ETH", "LTC", "USDT_ERC20", "USDC_ERC20", "SOL"]);
export const cryptoPaymentStatusEnum = pgEnum("crypto_payment_status", [
  "pending",
  "confirmed",
  "expired",
  "failed",
]);

/**
 * Each row represents one pending crypto payment request.
 *
 * The unique-amount trick: we add a random micro-offset (0–1.99 cents worth)
 * to the base USD amount, then convert to the target coin price. This means
 * two simultaneous requests for the same wallet can be distinguished purely
 * by the exact on-chain amount received.
 */
export const cryptoPaymentRequestsTable = pgTable("crypto_payment_requests", {
  id: serial("id").primaryKey(),

  /** User who initiated the payment */
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  /** JSON array of driver IDs being purchased, e.g. ["BC1482","RU1823"] */
  upgradeIds: text("upgrade_ids").notNull(),

  /** Which coin the user chose */
  coin: cryptoCoinEnum("coin").notNull(),

  /** Wallet address funds should arrive at */
  walletAddress: text("wallet_address").notNull(),

  /** Exact amount (in the chosen coin) the user MUST send, including micro-offset */
  expectedAmount: numeric("expected_amount", { precision: 18, scale: 8 }).notNull(),

  /** Base USD total (before conversion, for record-keeping) */
  usdAmount: numeric("usd_amount", { precision: 10, scale: 4 }).notNull(),

  /** Micro-offset applied in USD cents so we can explain it to the user */
  microOffsetCents: numeric("micro_offset_cents", { precision: 6, scale: 4 }).notNull(),

  /** Current monitoring status */
  status: cryptoPaymentStatusEnum("status").notNull().default("pending"),

  /** On-chain tx id once detected */
  txHash: text("tx_hash"),

  /** Confirmed block height (on-chain) */
  confirmedBlock: integer("confirmed_block"),

  /** Payment expires at (default 30 minutes) */
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CryptoPaymentRequest = typeof cryptoPaymentRequestsTable.$inferSelect;
