-- Create post attachments table for forum posts
CREATE TABLE "post_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"filesize" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

-- Create post attachments table for profile posts
CREATE TABLE "profile_post_attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_post_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"filesize" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"file_path" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "post_attachments" ADD CONSTRAINT "post_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "profile_post_attachments" ADD CONSTRAINT "profile_post_attachments_profile_post_id_profile_posts_id_fk" FOREIGN KEY ("profile_post_id") REFERENCES "profile_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "profile_post_attachments" ADD CONSTRAINT "profile_post_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
