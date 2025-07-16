import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import { createClient } from "@deepgram/sdk";
import {
  Configuration,
  OpenAIApi,
} from "openai-edge";
import { studentResume, interviews, studentDetails, studentInterviewSubmission, interviewOneQuestion, interviewTwoQuestion, interviewThreeQuestion, candidateApplications } from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import { eq, and, notInArray, asc, sql, count, desc } from "drizzle-orm";
import { retry } from "ts-retry-promise";
import { RateLimiterMemory } from "rate-limiter-flexible";

const deepgram = createClient(env.DEEPGRAM_API_KEY);
const config = new Configuration({ apiKey: env.OPENAI_API_KEY });
const openai = new OpenAIApi(config);

const MAX_QUESTIONS = 20; // Match Interview 1's limit
const CONVERSATION_END_MARKERS = ["that's all", "that's it", "thank you", "yeah that's it", "so yeah", "that would be all", "that's about it"].map((marker) => marker.toLowerCase());

interface ProcessStreamResponse {
  isComplete: boolean;
  nextQuestion: string;
  topic?: string;
  shouldContinueRecording: boolean;
  transcript: string;
  questionCount: number;
  audio?: string;
  questionId?: string;
  remainingQuestionIds?: string[];
  previousQuestions?: { question: string; topic: string; answer: string }[];
}

// Rate limiting middleware
const rateLimiter = new RateLimiterMemory({
  points: 100, // 100 requests per hour
  duration: 3600,
});

const rateLimitMiddleware = async ({ ctx, next }: any) => {
  try {
    await rateLimiter.consume(ctx.userId || "anonymous");
    return next();
  } catch {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Please try again later.",
    });
  }
};

export const interviewRouter = createTRPCRouter({
  getInterview: publicProcedure
    .input(z.object({ interviewId: z.string(), id: z.string() }))
    .query(async ({ input }) => {
      const [interview, student, student_resume] = await Promise.all([
        db.query.interviews.findFirst({ where: eq(interviews.id, input.interviewId) }),
        db.query.studentDetails.findFirst({ where: eq(studentDetails.userId, input.id) }),
        db.query.studentResume.findFirst({ where: eq(studentResume.userId, input.id) }),
      ]);

      const fullName = student ? (student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName) : null;
      return {
        ...interview,
        fullName,
        resume: student_resume?.resume,
        primarySpecialization: student?.primarySpecialization,
        degree: student?.degree,
        email: student?.email,
        profilePicture: student?.photo,
        phoneNumber: student?.phoneNumber,
        collegeName: student?.college,
        yearOfPassing: student?.yearOfPassing,
        rollno: student?.rollno,
        stream: student?.stream,
      };
    }),

  getAudio: publicProcedure
    .use(rateLimitMiddleware)
    .input(z.object({ text: z.string(), fullName: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const response = await retry(
          () => deepgram.speak.request(
            { text: input.text },
            { model: "aura-asteria-en", encoding: "linear16", container: "wav" }
          ),
          { retries: 3, delay: 1000 }
        );

        const stream = await response.getStream();
        if (!stream) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio stream",
          });
        }

        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return {
          audio: Buffer.from(
            chunks.reduce((acc, chunk) => Uint8Array.from([...acc, ...chunk]), new Uint8Array(0))
          ).toString("base64"),
          format: "wav",
        };
      } catch (error) {
        console.error("Deepgram audio generation error:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          input: input.text,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate audio: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),

  submitInterview: publicProcedure
    .input(z.object({
      interviewId: z.string(),
      userId: z.string(),
      sessionId: z.string(),
      fullName: z.string(),
      phoneNumber: z.string(),
      collegeName: z.string(),
      yearOfPassing: z.string(),
      rollno: z.string(),
      stream: z.string(),
      videoUrl: z.string(),
      email: z.string(),
      previousQuestions: z.array(z.object({ question: z.string(), topic: z.string(), answer: z.string() })),
      JD_text: z.string(),
      resumeText: z.string(),
      JD_topics: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      try {
        await db.transaction(async (trx) => {
          // Store interview submission
          await trx.insert(studentInterviewSubmission).values({
            studentId: input.userId,
            interviewId: input.interviewId,
            sessionId: input.sessionId,
            status: "submitted",
            interViewLink: input.videoUrl,
            previousQuestions: JSON.stringify(input.previousQuestions),
            JD_text: input.JD_text,
            resumeText: input.resumeText,
            JD_topics: JSON.stringify(input.JD_topics),
          });
        });

        return { success: true };
      } catch (error) {
        console.error("Error submitting interview:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to submit interview: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),

  processStreamOld: publicProcedure
    .use(rateLimitMiddleware)
    .input(z.object({
      audio: z.string(),
      currentQuestion: z.string(),
      questionCount: z.number(),
      fullName: z.string(),
      JD_topics: z.array(z.string()).optional().default([]),
      primarySpecialization: z.string(),
      previousResponse: z.string().optional(),
      silenceDuration: z.number().optional(),
      isRepeatRequest: z.boolean().optional(),
      isNoResponse: z.boolean().optional(),
      resumeText: z.string().optional(),
      JD_text: z.string().optional(),
      topic: z.string().optional(),
      previousQuestions: z.array(z.object({ question: z.string(), topic: z.string(), answer: z.string() })).optional(),
      interviewType: z.string().default("1"), // Added to support fallback question fetching
    }))
    .mutation(async ({ input }): Promise<ProcessStreamResponse> => {
      try {
        let transcript = "";
        console.log('Starting processStreamOld');
        const start = Date.now();
        let sttStart = Date.now();

        // Transcribe audio using Deepgram
        if (input.audio) {
          const transcriptionResult = await retry(
            () => deepgram.listen.prerecorded.transcribeFile(
              Buffer.from(input.audio, "base64"),
              {
                smart_format: true,
                model: "nova-2-general",
                language: "en",
                detect_language: false,
                punctuate: true,
                utterances: true,
                sample_rate: 16000,
              }
            ),
            { retries: 3, delay: 1000 }
          );
          transcript = transcriptionResult.result?.results?.channels[0]?.alternatives[0]?.transcript?.toLowerCase() ?? "";
          console.log("STT time:", Date.now() - sttStart);
        }

        // Check for completion (20 questions or topic coverage)
        if (input.questionCount >= MAX_QUESTIONS) {
          return {
            isComplete: true,
            nextQuestion: "",
            shouldContinueRecording: false,
            transcript,
            questionCount: input.questionCount,
            previousQuestions: [
              ...(input.previousQuestions ?? []),
              {
                question: input.currentQuestion,
                topic: input.topic ?? "Unknown",
                answer: transcript || "No response",
              },
            ],
          };
        }

        // Check topic coverage
        const topicCounts = (input.previousQuestions ?? []).reduce(
          (acc, q) => {
            acc[q.topic] = (acc[q.topic] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        const allTopicsCovered = input.JD_topics.every(
          (topic) => (topicCounts[`Role Knowledge: ${topic}`] || 0) >= 2
        );
        if (allTopicsCovered && input.questionCount >= 10) {
          return {
            isComplete: true,
            nextQuestion: "",
            shouldContinueRecording: false,
            transcript,
            questionCount: input.questionCount,
            previousQuestions: [
              ...(input.previousQuestions ?? []),
              {
                question: input.currentQuestion,
                topic: input.topic ?? "Unknown",
                answer: transcript || "No response",
              },
            ],
          };
        }

        const formattedHistory =
          input.previousQuestions
            ?.map((q, i) => `${i + 1}. Topic: ${q.topic}\n   Question: ${q.question}`)
            .join("\n") ?? "None so far";

        let gptStart = Date.now();
        const systemPrompt = input.isNoResponse
          ? `You are conducting a basic interview with ${input.fullName}, specializing in ${input.primarySpecialization}.
             Previous question: ${input.currentQuestion}
             Their response: No response received
             Question count: ${input.questionCount}
             Here is the resume of the individual: ${input.resumeText}
             Previous Questions and Topics History:
             ${formattedHistory}
             Rules:
             1. Acknowledge that they didn't respond and move on politely (e.g., "That's okay, let's try another question").
             2. Then ask the next question naturally.
             3. Keep the entire response under 3 sentences.
             4. Ask basic, easy-to-answer questions.
             5. Maintain a friendly, encouraging tone.
             6. If a follow-up is necessary due to an unclear or incomplete response, you may ask one follow-up question—but only once per original question.
             Output strictly in this JSON format:
             {
               "topic": "One of 5 core areas",
               "question": "Next interview question or follow-up (max 3 lines)"
             }
             keep in mind if it is in Role Knowledge, keep it Role Knowledge: <One of the 5 topics from JD_topic>`
          : `You are interviewing ${input.fullName} for a role in ${input.primarySpecialization}.  
             Resume: ${input.resumeText}  
             Job Description: ${input.JD_text}  
             The interview evaluates the candidate across 5 core areas:
             1. Role Knowledge (30%) - Ask questions strictly based on the following 5 topics extracted from the job description: ${input.JD_topics?.join(", ") || "None provided"} and Distribute questions evenly across these topics throughout the interview.
             2. Project & Experience (20%) - Ask about past work or academic projects from the resume to assess relevance and depth.
             3. Problem-Solving & System Design (30%) - Focus on how they approach challenges or design scalable systems, based on the JD requirements.
             4. Soft Skills (10%) - Gauge communication, collaboration, and leadership through behavior and tone in responses.
             5. Culture Fit (10%) - Consider alignment with company values, adaptability, and overall attitude based on both the resume and responses.
             Previous Questions and Topics History:
             ${formattedHistory}
             Current Question: ${input.currentQuestion}  
             Candidate Response: ${transcript || "No clear response detected"}  
             Guidance:
             - If the response to the current question is incomplete or unclear, ask one concise follow-up question (limit 1 per question).
             - If no follow-up is needed, proceed to the next question.
             - When asking the next question, select the topic based on the 5 core areas and their respective weightage.
             - Refer to the previous history above to:
               - Avoid repeating or rephrasing previously asked questions.
               - Track which topics have been covered and balance coverage based on the weightage.
             Rules:
             - Keep the tone professional, conversational, and concise (max 3 lines).
             - Do not repeat or closely mimic earlier questions.
             - Prioritize underrepresented topics based on the previous history.
             - Make sure to acknowledge their response and then ask the next question
             - Output strictly in valid JSON format, wrapped in markdown code block with json language identifier:
             \`\`\`json
             {
               "topic": "One of 5 core areas",
               "question": "Next interview question or follow-up (max 3 lines)"
             }
             \`\`\`
             keep in mind if it is in Role Knowledge, keep it Role Knowledge: <One of the 5 topics from JD_topic>`;

        const completionResult = await retry(
          () => openai.createChatCompletion({
            model: "gpt-4o-2024-08-06",
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.7,
            max_tokens: 150,
            presence_penalty: 0.6,
            frequency_penalty: 0.5,
          }),
          { retries: 3, delay: 1000 }
        );

        const result = (await completionResult.json()) as { choices: Array<{ message: { content: string } }> };
        console.log("GPT time:", Date.now() - gptStart);
        console.log("Raw GPT response:", result.choices[0]?.message?.content);

        const content = result.choices[0]?.message?.content ?? "";
        let nextQuestion = "";
        let topic = "Unknown";

        // Improved JSON parsing
        let jsonContent = content.trim();
        const markdownMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        jsonContent = markdownMatch?.[1]?.trim() ?? jsonContent;

        try {
          const parsed = JSON.parse(jsonContent) as { question: string; topic: string };
          if (!parsed.question || !parsed.topic) {
            throw new Error("Missing question or topic in parsed response");
          }
          nextQuestion = parsed.question;
          topic = parsed.topic;
        } catch (err) {
          console.warn("Failed to parse GPT response:", err, "Raw content:", jsonContent);
          // Fallback to a default question from interviewTwoQuestion (or interviewOneQuestion for Interview 1)
          const table = input.interviewType === "1" ? interviewOneQuestion : interviewTwoQuestion;
          const askedQuestionIds = (input.previousQuestions ?? []).map(q => q.question);
          const fallbackQuestion = await db
            .select()
            .from(table)
            .where(
              askedQuestionIds.length
                ? notInArray(table.question, askedQuestionIds)
                : undefined
            )
            .orderBy(sql`RANDOM()`)
            .limit(1)
            .then((results) => results[0]);

          if (!fallbackQuestion) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "No fallback questions available",
            });
          }

          nextQuestion = fallbackQuestion.question;
          topic = "Fallback";
          console.log("Using fallback question:", nextQuestion);
        }

        let ttsStart = Date.now();
        const audioResponse = await retry(
          () => deepgram.speak.request(
            { text: nextQuestion },
            { model: "aura-asteria-en", encoding: "linear16", container: "wav" }
          ),
          { retries: 3, delay: 1000 }
        );

        const stream = await audioResponse.getStream();
        if (!stream) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio stream",
          });
        }

        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const audioBase64 = Buffer.from(
          chunks.reduce((acc, chunk) => {
            const tmp = new Uint8Array(acc.length + chunk.length);
            tmp.set(acc, 0);
            tmp.set(chunk, acc.length);
            return tmp;
          }, new Uint8Array(0))
        ).toString("base64");
        console.log("TTS time:", Date.now() - ttsStart);
        console.log("Total time:", Date.now() - start);

        const updatedPreviousQuestions = [
          ...(input.previousQuestions ?? []),
          {
            question: input.currentQuestion,
            topic: input.topic ?? "Unknown",
            answer: transcript || "No response",
          },
        ];

        return {
          isComplete: false,
          nextQuestion,
          topic,
          shouldContinueRecording: false,
          transcript,
          questionCount: input.questionCount + 1,
          audio: audioBase64,
          previousQuestions: updatedPreviousQuestions,
        };
      } catch (error) {
        console.error("Error processing stream:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to process audio stream: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),

  extractTopicsFromJD: publicProcedure
    .input(z.object({ JD_text: z.string() }))
    .mutation(async ({ input }) => {
      const systemPrompt = `
        You are a hiring expert analyzing a Job Description to extract the 5 most relevant topics to assess a candidate during an interview.
        Job Description: ${input.JD_text}
        Your task:
        - Analyze the JD.
        - Identify and name 5 key interview topics based on the role's technical, functional, and soft skill requirements.
        - Use domain-relevant topic names (e.g., "Data Structures", "Customer Success", "DevOps", "API Security", "Team Leadership").
        - Topics should be broad enough to cover follow-up questions, but specific to the JD.
        Output strictly in this JSON format:
        \`\`\`json
        {
          "topics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
        }
        \`\`\`
      `;

      const completion = await retry(
        () => openai.createChatCompletion({
          model: "gpt-4o-2024-08-06",
          messages: [{ role: "system", content: systemPrompt }],
          temperature: 0.7,
          max_tokens: 150,
          presence_penalty: 0.6,
          frequency_penalty: 0.5,
        }),
        { retries: 3, delay: 1000 }
      );

      const result = (await completion.json()) as { choices?: Array<{ message: { content: string } }> };
      const rawContent = result.choices?.[0]?.message?.content ?? "{}";

      let parsed: { topics: string[] } = { topics: [] };
      try {
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ?? rawContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch?.[1] || jsonMatch?.[0]) {
          parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]) as { topics: string[] };
        }
      } catch (e) {
        console.error("Failed to parse GPT response as JSON:", rawContent);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse JD topics",
        });
      }
      return parsed;
    }),

  extractSummary: publicProcedure
    .input(z.object({ parsed_text: z.string() }))
    .mutation(async ({ input }) => {
      const systemPrompt = `
        You are a professional summarizer. Your task is to condense the provided text into crisp, clean summary points that capture all important highlights.
        Instructions:
        - Analyze the entire text.
        - Summarize the essential details into 1 concise paragraph.
        - Use clear and minimal language to ensure the summary is prompt-friendly.
        Text: ${input.parsed_text}
        Output strictly in this JSON format:
        \`\`\`json
        {
          "summary": "Paragraph 1"
        }
        \`\`\`
      `;

      const completion = await retry(
        () => openai.createChatCompletion({
          model: "gpt-4o-2024-08-06",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.parsed_text },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          presence_penalty: 0.6,
          frequency_penalty: 0.5,
        }),
        { retries: 3, delay: 1000 }
      );

      const result = (await completion.json()) as { choices?: Array<{ message: { content: string } }> };
      const rawContent = result.choices?.[0]?.message?.content ?? "{}";

      let parsed: { summary: string } = { summary: "" };
      try {
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/) ?? rawContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch?.[1] || jsonMatch?.[0]) {
          parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]) as { summary: string };
        }
      } catch (e) {
        console.error("Failed to parse GPT response as JSON:", rawContent);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to parse summary",
        });
      }
      return parsed;
    }),

  getThankYouMessage: publicProcedure
    .use(rateLimitMiddleware)
    .input(z.object({ fullName: z.string() }))
    .mutation(async ({ input }): Promise<{ audio: string; message: string }> => {
      try {
        const thankYouMessage = `Thank you ${input.fullName}, your session for this interview is now over. Your responses have been recorded. Please submit your responses to complete the process. We appreciate your participation.`;

        const audioResponse = await retry(
          () => deepgram.speak.request(
            { text: thankYouMessage },
            { model: "aura-asteria-en", encoding: "linear16", container: "wav" }
          ),
          { retries: 3, delay: 1000 }
        );

        const stream = await audioResponse.getStream();
        if (!stream) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio stream",
          });
        }

        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        const audioBase64 = Buffer.from(
          chunks.reduce((acc, chunk) => {
            const tmp = new Uint8Array(acc.length + chunk.length);
            tmp.set(acc, 0);
            tmp.set(chunk, acc.length);
            return tmp;
          }, new Uint8Array(0))
        ).toString("base64");

        return { audio: audioBase64, message: thankYouMessage };
      } catch (error) {
        console.error("Error generating thank you message:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate thank you message: ${error instanceof Error ? error.message : "Unknown error"}`,
          cause: error,
        });
      }
    }),

  getQuestions: publicProcedure
    .input(z.object({ interviewType: z.enum(["1", "2", "3"]), limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const table = input.interviewType === "1" ? interviewOneQuestion : input.interviewType === "2" ? interviewTwoQuestion : interviewThreeQuestion;
      const totalCount = await db.select({ count: count() }).from(table).execute().then((res) => res[0]?.count ?? 0);
      const questions = await db.select().from(table).orderBy(asc(table.createdAt)).limit(input.limit + 1).offset(input.offset);
      let hasNext = false;
      if (questions.length > input.limit) {
        questions.pop();
        hasNext = true;
      }
      return { questions, totalCount, hasNext };
    }),

  uploadQuestions: publicProcedure
    .input(z.object({ questions: z.array(z.string()), interviewType: z.enum(["1", "2", "3"]), uploadType: z.enum(["append", "replace"]) }))
    .mutation(async ({ input }) => {
      try {
        const table = input.interviewType === "1" ? interviewOneQuestion : input.interviewType === "2" ? interviewTwoQuestion : interviewThreeQuestion;
        const newQuestions = input.questions.filter((q) => q.trim()).map((question) => ({ question, createdAt: new Date() }));
        if (newQuestions.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No valid questions found in file" });
        }
        await db.transaction(async (tx) => {
          if (input.uploadType === "replace") {
            await tx.delete(table).where(sql`1=1`).execute();
          }
          await tx.insert(table).values(newQuestions).execute();
        });
        console.log("Upload completed:", { type: input.uploadType, addedCount: newQuestions.length });
        return { success: true, count: newQuestions.length };
      } catch (error) {
        console.error("Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to upload questions",
          cause: error,
        });
      }
    }),

  getNextQuestion: publicProcedure
    .input(
      z.object({
        askedQuestions: z.array(z.string()),
        interviewType: z.string().default("1"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table =
        input.interviewType === "1"
          ? interviewOneQuestion
          : input.interviewType === "2"
            ? interviewTwoQuestion
            : interviewThreeQuestion;

      const nextQuestion = await ctx.db
        .select()
        .from(table)
        .where(
          input.askedQuestions.length
            ? notInArray(table.id, input.askedQuestions)
            : undefined,
        )
        .orderBy(sql`RANDOM()`)
        .limit(1)
        .then((results) => results[0]);

      return nextQuestion;
    }),

  getSubmissionStatus: publicProcedure
    .input(z.object({ userId: z.string(), interviewId: z.string() }))
    .query(async ({ input }) => {
      const submission = await db.query.studentInterviewSubmission.findFirst({
        where: and(
          eq(studentInterviewSubmission.studentId, input.userId),
          eq(studentInterviewSubmission.interviewId, input.interviewId)
        ),
        orderBy: [desc(studentInterviewSubmission.createdAt)],
      });
      return submission ? { status: submission.status, nextAttemptTime: submission.nextAttemptTime } : null;
    }),

  getCandidateApplicationsByUser: publicProcedure
    .input(z.object({ candidateId: z.string() }))
    .query(async ({ input }) => {
      const applications = await db.query.candidateApplications.findMany({
        where: eq(candidateApplications.candidateId, input.candidateId),
      });
      return applications;
    }),

  getCandidateApplication: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const application = await db.query.candidateApplications.findFirst({
        where: eq(candidateApplications.id, input.id),
      });
      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      }
      return application;
    }),
});