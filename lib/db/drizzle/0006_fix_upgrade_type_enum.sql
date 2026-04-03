-- Fix enum mismatch: drop old upgrade_type enum and recreate with PRODUCT_SUBSCRIPTION types
-- First, set all upgrade_type values to NULL to allow enum modification
UPDATE "users" SET "upgrade_type" = NULL, "upgrade_expires_at" = NULL WHERE "upgrade_type" IS NOT NULL;
--> statement-breakpoint

-- Drop the old enum that uses 'basic', 'premium', 'lifetime'
DROP TYPE "public"."upgrade_type" CASCADE;
--> statement-breakpoint

-- Recreate the enum with the new product-specific subscription types
CREATE TYPE "public"."upgrade_type" AS ENUM(
  -- BODYCAM subscriptions
  'BODYCAM_PREMIUM',
  'BODYCAM_LIFETIME',
  -- RUST subscriptions
  'RUST_PREMIUM',
  'RUST_LIFETIME',
  -- DAYZ subscriptions
  'DAYZ_PREMIUM',
  'DAYZ_LIFETIME',
  -- TARKOV subscriptions
  'TARKOV_PREMIUM',
  'TARKOV_LIFETIME',
  -- SPOOFER subscriptions
  'SPOOFER_PREMIUM',
  'SPOOFER_LIFETIME'
);
--> statement-breakpoint

-- Re-add the constraint to the users table
ALTER TABLE "users" ADD COLUMN "upgrade_type" "upgrade_type";
