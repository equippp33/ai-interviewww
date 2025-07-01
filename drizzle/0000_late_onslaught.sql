CREATE TABLE "ai-interviewww_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai-interviewww_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"hashed_password" text,
	"category" text DEFAULT 'user',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai-interviewww_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai-interviewww_sessions" ADD CONSTRAINT "ai-interviewww_sessions_user_id_ai-interviewww_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-interviewww_users"("id") ON DELETE no action ON UPDATE no action;