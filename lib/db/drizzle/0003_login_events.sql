CREATE TABLE "login_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer,
  "ip" text NOT NULL,
  "user_agent" text,
  "event_type" text DEFAULT 'login' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
