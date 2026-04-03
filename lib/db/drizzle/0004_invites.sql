CREATE TABLE "invite_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "created_by" integer,
  "product_id" text,
  "expires_at" timestamp,
  "is_banned" boolean NOT NULL DEFAULT false,
  "is_used" boolean NOT NULL DEFAULT false,
  "used_by" integer,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "invite_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "username" text NOT NULL,
  "reason" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "processed_at" timestamp,
  "processed_by" integer
);
--> statement-breakpoint
ALTER TABLE "invite_requests" ADD CONSTRAINT "invite_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
