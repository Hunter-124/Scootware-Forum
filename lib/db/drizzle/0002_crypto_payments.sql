CREATE TYPE "public"."crypto_coin" AS ENUM('BTC', 'ETH', 'LTC', 'USDT_ERC20');--> statement-breakpoint
CREATE TYPE "public"."crypto_payment_status" AS ENUM('pending', 'confirmed', 'expired', 'failed');--> statement-breakpoint
CREATE TABLE "crypto_payment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"upgrade_ids" text NOT NULL,
	"coin" "crypto_coin" NOT NULL,
	"wallet_address" text NOT NULL,
	"expected_amount" numeric(18, 8) NOT NULL,
	"usd_amount" numeric(10, 4) NOT NULL,
	"micro_offset_cents" numeric(6, 4) NOT NULL,
	"status" "crypto_payment_status" DEFAULT 'pending' NOT NULL,
	"tx_hash" text,
	"confirmed_block" integer,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crypto_payment_requests"
  ADD CONSTRAINT "crypto_payment_requests_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
