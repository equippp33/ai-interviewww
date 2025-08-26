CREATE TABLE "ai_interview_ai_interview_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"status" text DEFAULT 'not_started',
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"score" numeric,
	"confidence" numeric,
	"recording_url" text,
	"transcript_url" text,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"answer" text,
	"score" numeric,
	"feedback" text,
	"audio_url" text,
	"transcript_url" text,
	"ai_analysis" json,
	"asked_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_candidate_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text,
	"dob" text,
	"gender" text,
	"marital_status" text,
	"nationality" text,
	"location" text,
	"photo" text,
	"bio" text,
	"linkedin_url" text,
	"highest_degree" text,
	"university_name" text,
	"specialization" text,
	"percentage" text,
	"graduation_year" text,
	"total_experience" text,
	"current_ctc" text,
	"expected_ctc" text,
	"technical_skills" text,
	"languages" text,
	"resume" text,
	"job_title" text,
	"job_description" text,
	"job_location" text,
	"company_name" text,
	"skills_required" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_interview_one_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_interview_three_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_interview_two_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_interview_student_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"is_Skill_University" text,
	"university_Name" text,
	"equippp_id" text,
	"photo" text,
	"other_survey" text,
	"cover_photo" text,
	"rollno" text NOT NULL,
	"admission_year" text,
	"first_name" text,
	"hobbies" text,
	"survey" text,
	"last_name" text,
	"current_country" text,
	"college" text,
	"stream" text,
	"course_impact" text,
	"primary_specialization" text,
	"gender" text,
	"college_type" text,
	"year_of_passing" text,
	"dob" text,
	"languages_proficient" text,
	"email" text,
	"secondary_email" text,
	"phone_number" text,
	"secondary_phone_number" text,
	"aadhar_card" text,
	"pan_card" text,
	"father_name" text,
	"mother_name" text,
	"father_occupation" text,
	"mother_occupation" text,
	"annual_income" text,
	"linkedin" text,
	"facebook" text,
	"twitter" text,
	"current_address__line_1" text,
	"current_address_line_2" text,
	"current_address_line_3" text,
	"college_state" text,
	"college_city" text,
	"current_state" text,
	"current_city" text,
	"area_type" text DEFAULT '',
	"area_name" text DEFAULT '',
	"email_attempts" integer DEFAULT 0,
	"last_email_sent" timestamp DEFAULT now(),
	"current_postalcode" text,
	"college_location_coordinates" text,
	"college_location_title" text,
	"current_location_coordinates" text,
	"current_location_title" text,
	"permanent_location_coordinates" text,
	"permanent_location_title" text,
	"permanent_address_line_1" text,
	"permanent_address_line_2" text,
	"permanent_address_line_3" text,
	"permanent_state" text,
	"permanent_city" text,
	"batch" text,
	"permanent_postalcode" text,
	"primary_education" text,
	"secondary_education" text,
	"primary_education_board" text,
	"degree" text,
	"course" text,
	"secondary_education_board" text,
	"primary_education_cgpa" numeric,
	"secondary_education_cgpa" numeric,
	"degree_cgpa" numeric,
	"primary_education_marksheet" text,
	"year_of_passing_primary_education" text,
	"year_of_passing_secondary_education" text,
	"secondary_education_marksheet" text,
	"degree_marksheet" text,
	"additional_certifications" text,
	"updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_interview_student_details_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_interview_student_interview_mails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text,
	"student_email" text,
	"phone_number" text,
	"user_id" uuid NOT NULL,
	"college_name" text,
	"subject" text,
	"equippp_id" text,
	"email_tracking_id" text,
	"interview_id" uuid,
	"is_submitted" text DEFAULT 'false',
	"violation" text DEFAULT 'false',
	"submitted_at" timestamp with time zone,
	"is_completed" text DEFAULT 'false',
	"completed_at" timestamp with time zone,
	"is_email_sent" text DEFAULT 'pending',
	"email_sent_at" timestamp with time zone,
	"is_email_read" boolean DEFAULT false,
	"email_readed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_interview_student_interview_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"interview_id" uuid,
	"score" numeric DEFAULT '0',
	"percentage" integer DEFAULT 0,
	"status" text DEFAULT 'not_started' NOT NULL,
	"report_link" text,
	"error_details" text,
	"interview_link" text,
	"courseImpact" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"session_id" text,
	"next_attempt_time" timestamp with time zone,
	"previous_questions" text,
	"JD_text" text,
	"resume_text" text,
	"JD_topics" text
);
--> statement-breakpoint
CREATE TABLE "ai_interview_student_resume" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resume" text,
	"video" text,
	CONSTRAINT "ai_interview_student_resume_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_interview_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'candidate',
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_interview_ai_interview_interviews" ADD CONSTRAINT "ai_interview_ai_interview_interviews_candidate_id_ai_interview_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."ai_interview_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_questions" ADD CONSTRAINT "ai_interview_questions_interview_id_ai_interview_ai_interview_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."ai_interview_ai_interview_interviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_candidate_applications" ADD CONSTRAINT "ai_interview_candidate_applications_candidate_id_ai_interview_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."ai_interview_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_sessions" ADD CONSTRAINT "ai_interview_sessions_user_id_ai_interview_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai_interview_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_student_details" ADD CONSTRAINT "ai_interview_student_details_user_id_ai_interview_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai_interview_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interview_student_resume" ADD CONSTRAINT "ai_interview_student_resume_user_id_ai_interview_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai_interview_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_idx" ON "ai_interview_student_resume" USING btree ("resume");--> statement-breakpoint
CREATE INDEX "resume_user_id_idx" ON "ai_interview_student_resume" USING btree ("user_id");