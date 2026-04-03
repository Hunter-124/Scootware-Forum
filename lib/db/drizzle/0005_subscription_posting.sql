-- Clean up corrupted subscription data
UPDATE "users" SET "upgrade_type" = NULL, "upgrade_expires_at" = NULL;
--> statement-breakpoint
DELETE FROM "product_access";
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "allow_user_posting" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
UPDATE "categories" SET "allow_user_posting" = true WHERE LOWER("name") IN ('general chat', 'support tickets', 'community configs');
