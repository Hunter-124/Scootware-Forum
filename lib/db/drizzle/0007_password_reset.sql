-- Add password reset token fields to users table
ALTER TABLE "users" ADD COLUMN "password_reset_token" text;
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" timestamp;
