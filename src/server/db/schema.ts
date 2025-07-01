// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  pgTableCreator,
  timestamp,
  uuid,
  varchar,
  pgEnum,
  text,
  decimal,
  index,
  integer,
  boolean,
  json,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `ai_interview_${name}`);

// Reference to the main database's user table
export const mainUserReference = {
  mainUserId: uuid("main_user_id").notNull(),
  mainUserEmail: text("main_user_email"),
  mainUserPhone: text("main_user_phone"),
};

export const userTable = createTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").default("candidate"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const sessionsTable = createTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => userTable.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

// Enum for interview status
export const interviewStatusEnum = pgEnum("interview_status", [
  "not_started",
  "in_progress",
  "completed",
  "failed",
  "expired"
]);

export const aiInterviews = createTable("ai_interview_interviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: uuid("candidate_id").notNull().references(() => userTable.id),
  jobId: text("job_id").notNull(), // References the main application's job ID
  status: interviewStatusEnum("status").default("not_started"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  score: decimal("score"),
  confidence: decimal("confidence"),
  recordingUrl: text("recording_url"),
  transcriptUrl: text("transcript_url"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const aiQuestions = createTable("questions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  interviewId: uuid("interview_id").notNull().references(() => aiInterviews.id),
  questionText: text("question_text").notNull(),
  answer: text("answer"),
  score: decimal("score"),
  feedback: text("feedback"),
  audioUrl: text("audio_url"),
  transcriptUrl: text("transcript_url"),
  aiAnalysis: json("ai_analysis"), // Stores detailed AI analysis of the answer
  askedAt: timestamp("asked_at", { withTimezone: true }),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const studentInterviewSubmission = createTable(
	"student_interview_submission",
	{
	  id: uuid("id")
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	  studentId: uuid("student_id")
		.notNull()
		.references(() => userTable.id),
	  interviewId: uuid("interview_id").references(() => interviews.id),
	  score: decimal("score").default("0"),
	  percentage: integer("percentage").default(0),
	  status: text("status").notNull().default("not_started"),
	  reportLink: text("report_link"),
	  errorDetails: text("error_details"),
	  interViewLink: text("interview_link"),
	  courseImpact: text("courseImpact"),
	  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	  sessionId: text("session_id"),
	  nextAttemptTime: timestamp("next_attempt_time", { withTimezone: true }),
	  previousQuestions: text("previous_questions"),
  
	  JD_text: text("JD_text"),
	  resumeText: text("resume_text"),
	  JD_topics: text("JD_topics"),
	},
  );
  
  export const interviewOneQuestion = createTable("interview_one_question", {
	id: uuid("id")
	  .primaryKey()
	  .default(sql`gen_random_uuid()`),
	question: text("question").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  });
  
  export const interviewTwoQuestion = createTable("interview_two_question", {
	id: uuid("id")
	  .primaryKey()
	  .default(sql`gen_random_uuid()`),
	question: text("question").notNull(),
  
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  });
  
  export const interviewThreeQuestion = createTable("interview_three_question", {
	id: uuid("id")
	  .primaryKey()
	  .default(sql`gen_random_uuid()`),
	question: text("question").notNull(),
  
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  });
  

  export const studentResume = createTable(
	"student_resume",
	{
	  id: uuid("id")
		.primaryKey()
		.default(sql`gen_random_uuid()`),
	  userId: uuid("user_id")
		.notNull()
		.references(() => userTable.id)
		.unique(),
	  resume: text("resume"),
	  video: text("video"),
	},
	(example) => ({
	  resumeIndex: index("resume_idx").on(example.resume),
	  resumeUserIdIndex: index("resume_user_id_idx").on(example.userId),
	}),
  );


  export const interviews = createTable("interviews", {
	id: uuid("id")
	  .primaryKey()
	  .default(sql`gen_random_uuid()`),
	name: text("name").notNull(),
	link: text("link").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  });

  
  export const studentDetails = createTable("student_details", {
	id: uuid("id")
	  .primaryKey()
	  .default(sql`gen_random_uuid()`),
	userId: uuid("user_id")
	  .notNull()
	  .unique()
	  .references(() => userTable.id),
	isSkillUniversity: text("is_Skill_University"),
	universityName: text("university_Name"),
	equipppId: text("equippp_id"),
	photo: text("photo"),
	otherSurvey: text("other_survey"),
	coverPhoto: text("cover_photo"),
	rollno: text("rollno").notNull(),
	admissionYear: text("admission_year"),
	firstName: text("first_name"),
	hobbies: text("hobbies"),
	survey: text("survey"),
	lastName: text("last_name"),
	currentCountry: text("current_country"),
	college: text("college"),
	stream: text("stream"),
	courseImpact: text("course_impact"),
	primarySpecialization: text("primary_specialization"),
	gender: text("gender"),
	collegeType: text("college_type"),
	yearOfPassing: text("year_of_passing"),
	dob: text("dob"),
	languagesProficient: text("languages_proficient"),
	email: text("email"),
	secondaryEmail: text("secondary_email"),
	phoneNumber: text("phone_number"),
	secondaryPhoneNumber: text("secondary_phone_number"),
	aadharCard: text("aadhar_card"),
	panCard: text("pan_card"),
	fatherName: text("father_name"),
	motherName: text("mother_name"),
	fatherOccupation: text("father_occupation"),
	motherOccupation: text("mother_occupation"),
	annualIncome: text("annual_income"),
	linkedin: text("linkedin"),
	facebook: text("facebook"),
	twitter: text("twitter"),
	currentAddressLine1: text("current_address__line_1"),
	currentAddressLine2: text("current_address_line_2"),
	currentAddressLine3: text("current_address_line_3"),
	collegeState: text("college_state"),
	collegeCity: text("college_city"),
	currentState: text("current_state"),
	currentCity: text("current_city"),
	areaType: text("area_type").default(""),
	areaName: text("area_name").default(""),
	emailAttempts: integer("email_attempts").default(0),
	lastEmailSent: timestamp("last_email_sent").defaultNow(),
	currentPostalcode: text("current_postalcode"),
	collegeLocationCoordinates: text("college_location_coordinates"),
	collegeLocationTitle: text("college_location_title"),
	currentLocationCoordinates: text("current_location_coordinates"),
	currentLocationTitle: text("current_location_title"),
	permanentLocationCoordinates: text("permanent_location_coordinates"),
	permanentLocationTitle: text("permanent_location_title"),
	permanentAddressLine1: text("permanent_address_line_1"),
	permanentAddressLine2: text("permanent_address_line_2"),
	permanentAddressLine3: text("permanent_address_line_3"),
	permanentState: text("permanent_state"),
	permanentCity: text("permanent_city"),
	batch: text("batch"),
	permanentPostalcode: text("permanent_postalcode"),
	primaryEducation: text("primary_education"),
	secondaryEducation: text("secondary_education"),
	primaryEducationBoard: text("primary_education_board"),
	degree: text("degree"),
	course: text("course"),
	secondaryEducationBoard: text("secondary_education_board"),
	primaryEducationCGPA: decimal("primary_education_cgpa"),
	secondaryEducationCGPA: decimal("secondary_education_cgpa"),
	degreeCGPA: decimal("degree_cgpa"),
	primaryEducationMarkSheet: text("primary_education_marksheet"),
	yearOfPassingPrimaryEducation: text("year_of_passing_primary_education"),
	yearOfPassingSecondaryEducation: text("year_of_passing_secondary_education"),
	secondaryEducationMarkSheet: text("secondary_education_marksheet"),
	degreeMarkSheet: text("degree_marksheet"),
	additionalCertifications: text("additional_certifications"),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
  
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  });

  