import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { db } from "@/server/db";
import { createClient } from "@deepgram/sdk";
import {
  Configuration,
  OpenAIApi,
  type ChatCompletionRequestMessage,
} from "openai-edge";

import { studentResume } from "@/server/db/schema";
import {
  interviews,
  studentDetails,
  studentInterviewSubmission,
  interviewOneQuestion,
  interviewTwoQuestion,
  interviewThreeQuestion,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { env } from "@/env";
import { eq, and, notInArray, asc, sql, count, desc } from "drizzle-orm";

import { observable } from "@trpc/server/observable";

import { addHours, addMinutes } from "date-fns";

const deepgram = createClient(env.DEEPGRAM_API_KEY);

const config = new Configuration({
  apiKey: env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

type Question = {
  text: string;
  order: number;
};

// Constants
const CONVERSATION_END_MARKERS = [
  "that's all",
  "that's it",
  "thank you",
  "yeah that's it",
  "so yeah",
  "that would be all",
  "that's about it",
].map((marker) => marker.toLowerCase());

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
  previousQuestions?: {
    question: string;
    topic: string;
    answer: string;
  }[];
}

interface AskedQuestion {
  id: string;
  question: string;
}

export const interviewRouter = createTRPCRouter({
  getInterview: publicProcedure
    .input(
      z.object({
        interviewId: z.string(),
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const [interview, student, student_resume] = await Promise.all([
        db.query.interviews.findFirst({
          where: eq(interviews.id, input.interviewId),
        }),
        db.query.studentDetails.findFirst({
          where: eq(studentDetails.userId, input.id),
        }),
        db.query.studentResume.findFirst({
          where: eq(studentResume.userId, input.id),
        }),
      ]);

      const fullName = student
        ? student.lastName
          ? `${student.firstName} ${student.lastName}`
          : student.firstName
        : null;

      const email = student?.email;
      const phoneNumber = student?.phoneNumber;
      const collegeName = student?.college;
      const yearOfPassing = student?.yearOfPassing;
      const rollno = student?.rollno;
      const stream = student?.stream;

      return {
        ...interview,
        fullName,
        resume: student_resume?.resume,
        primarySpecialization: student?.primarySpecialization,
        degree: student?.degree,
        email,
        profilePicture: student?.photo,
        phoneNumber,
        collegeName,
        yearOfPassing,
        rollno,
        stream,
      };
    }),

  // Uses deepgram to get audio for a text
  getAudio: publicProcedure
    .input(
      z.object({
        text: z.string(),
        fullName: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const response = await deepgram.speak.request(
          {
            text: input.text,
          },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            container: "wav",
          },
        );

        const stream = await response.getStream();
        if (!stream) {
          console.error("Stream generation failed:", { response });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio stream",
          });
        }

        const reader = stream.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return {
          audio: Buffer.from(
            chunks.reduce(
              (acc, chunk) => Uint8Array.from([...acc, ...chunk]),
              new Uint8Array(0),
            ).buffer,
          ).toString("base64"),
          format: "wav",
        };
      } catch (error) {
        // Detailed error logging
        console.error("Deepgram audio generation error:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          input: input.text,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to generate audio: ${error instanceof Error ? error.message : String(error)}`,
          cause: error,
        });
      }
    }),

  submitInterview: publicProcedure
    .input(
      z.object({
        interviewId: z.string(),
        email: z.string(),
        userId: z.string(),
        sessionId: z.string(),
        fullName: z.string(),
        phoneNumber: z.string(),
        collegeName: z.string(),
        yearOfPassing: z.string(),
        rollno: z.string(),
        stream: z.string(),
        videoUrl: z.string(),
        previousQuestions: z.array(
          z.object({
            question: z.string(),
            topic: z.string(),
            answer: z.string(),
          }),
        ),
        JD_text: z.string(),
        resumeText: z.string(),
        JD_topics: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        // Execute database operations and job creation in parallel
        const [_, jobResult] = await Promise.all([
          // Database transaction
          db.transaction(async (trx) => {
            await trx.insert(studentInterviewSubmission).values({
              studentId: input.userId,
              interviewId: input.interviewId,
              sessionId: input.sessionId,
              status: "submitted",
              interViewLink: input.videoUrl,
              previousQuestions: JSON.stringify(input.previousQuestions),
              JD_text: input.JD_text,
              JD_topics: JSON.stringify(input.JD_topics),
              resumeText: input.resumeText,
            });
          }),

          // Job creation and email sending in parallel
          Promise.all([
            boss.insert([
              {
                name: "process-interview",
                data: {
                  interviewId: input.interviewId,
                  userId: input.userId,
                  sessionId: input.sessionId,
                  videoUrl: input.videoUrl,
                  fullName: input.fullName,
                  email: input.email,
                  phoneNumber: input.phoneNumber,
                  collegeName: input.collegeName,
                  yearOfPassing: input.yearOfPassing,
                  rollno: input.rollno,
                  stream: input.stream,
                  previousQuestions: JSON.stringify(input.previousQuestions),
                  JD_text: input.JD_text,
                  resumeText: input.resumeText,
                },
                expireInSeconds: 300,
              },
            ]),

            sendSubmitInterviewEmail({
              fullName: input.fullName,
              phoneNumber: input.phoneNumber,
              email: input.email,
              interviewId: input.interviewId,
              studentId: input.userId,
              collegeName: input.collegeName,
              yearOfPassing: input.yearOfPassing,
              rollno: input.rollno,
              stream: input.stream,
            }),
          ]),
        ]);

        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to submit interview",
          cause: error,
        });
      }
    }),
  processStream: publicProcedure
    .input(
      z.object({
        currentQuestion: z.string(),
        questionCount: z.number(),
        fullName: z.string(),
        primarySpecialization: z.string(),
        interviewId: z.string(),
        askedQuestions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }): Promise<ProcessStreamResponse> => {
      try {
        console.time("processStream:start");
        console.log("Processing stream with:", {
          askedQuestionsCount: input.askedQuestions?.length ?? 0,
          currentQuestionCount: input.questionCount,
          askedQuestionIds: input.askedQuestions,
        });

        console.time("processStream:dbQueries");
        // Get total questions count and next question in parallel
        const [totalQuestions, nextInterviewQuestion] = await Promise.all([
          db.query.interviewOneQuestion.findMany().then((q) => q.length),
          db.query.interviewOneQuestion.findFirst({
            where: input.askedQuestions?.length
              ? notInArray(interviewOneQuestion.id, input.askedQuestions)
              : undefined,
            orderBy: sql`RANDOM()`,
          }),
        ]);
        console.timeEnd("processStream:dbQueries");

        if (
          (input.askedQuestions?.length ?? 0) >= totalQuestions ||
          !nextInterviewQuestion
        ) {
          return {
            isComplete: true,
            nextQuestion: "",
            shouldContinueRecording: false,
            transcript: "",
            questionCount: (input.askedQuestions?.length ?? 0) + 1,
          };
        }

        console.time("processStream:audioGeneration");
        const audioResponse = await deepgram.speak.request(
          {
            text: nextInterviewQuestion.question,
          },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            container: "wav",
          },
        );
        console.timeEnd("processStream:audioGeneration");

        console.time("processStream:audioProcessing");
        const stream = await audioResponse.getStream();
        if (!stream) {
          throw new Error("Failed to generate audio stream");
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
          }, new Uint8Array(0)),
        ).toString("base64");
        console.timeEnd("processStream:audioProcessing");

        console.timeEnd("processStream:start");
        return {
          isComplete: false,
          nextQuestion: nextInterviewQuestion.question,
          shouldContinueRecording: false,
          transcript: "",
          questionCount: (input.askedQuestions?.length ?? 0) + 1,
          audio: audioBase64,
          questionId: nextInterviewQuestion.id,
        };
      } catch (error) {
        console.error("Process stream error:", error);
        throw error;
      }
    }),

  extractTopicsFromJD: publicProcedure
    .input(
      z.object({
        JD_text: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `
    You are a hiring expert analyzing a Job Description to extract the 5 most relevant topics to assess a candidate during an interview.

    Job Description:
    ${input.JD_text}

    Your task:
    - Analyze the JD.
    - Identify and name 5 key interview topics based on the role's technical, functional, and soft skill requirements.
    - Use domain-relevant topic names (e.g., "Data Structures", "Customer Success", "DevOps", "API Security", "Team Leadership").
    - Topics should be broad enough to cover follow-up questions, but specific to the JD.

    Output strictly in this JSON format:
    {
      "topics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5"]
    }
    `;

      const [completion] = await Promise.all([
        // Next question generation with response
        openai.createChatCompletion({
          model: "gpt-4o-2024-08-06",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
          presence_penalty: 0.6,
          frequency_penalty: 0.5,
        }),
      ]);

      const result = (await completion.json()) as {
        choices?: Array<{ message: { content: string } }>;
      };
      console.log("here is the result: ", result);
      const rawContent = result.choices?.[0]?.message?.content ?? "{}";

      let parsed: { topics: string[] } = { topics: [] };

      try {
        // Match JSON block inside backticks (e.g. ```json { ... } ```)
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);

        if (jsonMatch?.[1]) {
          parsed = JSON.parse(jsonMatch[1]) as { topics: string[] };
        } else {
          // Fallback: Try matching any JSON object in the response
          const fallbackMatch = rawContent.match(/\{[\s\S]*?\}/);
          if (fallbackMatch?.[0]) {
            parsed = JSON.parse(fallbackMatch[0]) as { topics: string[] };
          } else {
            console.error("No JSON object found in response:", rawContent);
          }
        }
      } catch (e) {
        console.error("Failed to parse GPT response as JSON:", rawContent);
      }

      return parsed;
    }),

  extractSummary: publicProcedure
    .input(
      z.object({
        parsed_text: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `
You are a professional summarizer. Your task is to condense the provided text into crisp, clean summary points that capture all important highlights.

Instructions:
- Analyze the entire text.
- Summarize the essential details into 1 concise paragraph.
- Use clear and minimal language to ensure the summary is prompt-friendly.

Text:
${input.parsed_text}

Output ONLY a valid JSON object, with no explanation or commentary. Do not use markdown or code blocks.
Format:
{
  "summary": "Paragraph 1"
}
`;

      const [completion] = await Promise.all([
        openai.createChatCompletion({
          model: "gpt-4o-2024-08-06",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: input.parsed_text,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          presence_penalty: 0.6,
          frequency_penalty: 0.5,
        }),
      ]);

      const result = (await completion.json()) as {
        choices?: Array<{ message: { content: string } }>;
      };

      const rawContent = result.choices?.[0]?.message?.content ?? "{}";
      console.log("🔍 Raw GPT content:", rawContent);

      let parsed: { summary: string } = { summary: "" };

      try {
        // Match JSON block inside triple backticks (if any)
        const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);

        let jsonString = "";
        if (jsonMatch?.[1]) {
          jsonString = jsonMatch[1]; // Cleaned from markdown
        } else {
          // Try to find any JSON object
          const fallbackMatch = rawContent.match(/\{[\s\S]*?\}/);
          if (fallbackMatch?.[0]) {
            jsonString = fallbackMatch[0];
          } else {
            console.warn("⚠️ No JSON found in GPT response:", rawContent);
          }
        }

        if (jsonString) {
          parsed = JSON.parse(jsonString) as { summary: string };
        }
      } catch (e) {
        console.error("❌ Failed to parse GPT response as JSON:", rawContent);
      }

      return parsed;
    }),

  processStreamOld: publicProcedure
    .input(
      z.object({
        audio: z.string(),
        currentQuestion: z.string(),
        questionCount: z.number(),
        fullName: z.string(),
        JD_topics: z.array(z.string()),
        primarySpecialization: z.string(),
        previousResponse: z.string().optional(),
        silenceDuration: z.number().optional(),
        isRepeatRequest: z.boolean().optional(),
        isNoResponse: z.boolean().optional(),
        resumeText: z.string().optional(),
        JD_text: z.string().optional(),
        topic: z.string().optional(),
        previousQuestions: z
          .array(
            z.object({
              question: z.string(),
              topic: z.string(),
              answer: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input }): Promise<ProcessStreamResponse> => {
      try {
        // This area begins the start of the Process Stream Old code
        let transcript = "";
        console.log('1) starting process stream old')
        const start = Date.now();
        let sttStart = Date.now();

        // Only attempt transcription if there's audio data
        if (input.audio) {
          // const transcriptionResult =
          //   await deepgram.listen.prerecorded.transcribeFile(
          //     Buffer.from(input.audio, "base64"),
          //     {
          //       smart_format: true,
          //       model: "nova-2-general",
          //       language: "en",
          //       detect_language: false,
          //       punctuate: true,
          //       utterances: true,
          //       sample_rate: 16000,
          //     },
          //   );

          // transcript =
          //   transcriptionResult.result?.results?.channels[0]?.alternatives[0]?.transcript?.toLowerCase() ??
          //   "";
          transcript = input.audio;
          console.log("STT time:", Date.now() - sttStart);
        }

        const formattedHistory =
          input.previousQuestions
            ?.map(
              (q, i) =>
                `${i + 1}. Topic: ${q.topic}\n   Question: ${q.question}`,
            )
            .join("\n") ?? "None so far";

        let gptStart = Date.now();
            // Modify the system prompt based on whether there was a response
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
      
            Format of your response (strict JSON format only): Please respond ONLY with valid JSON as per the format. No natural language or extra explanation.
           {
             "topic": "One of 5 core areas",
             "question": "Next interview question or follow-up (max 3 lines)"
             keep in mind if it is in Role Knowledge, keep it Role Knowledge : <One of the 5 topics from JD_topic>
           }`
          : `You are interviewing ${input.fullName} for a role in ${input.primarySpecialization}.  
           Resume: ${input.resumeText}  
           Job Description: ${input.JD_text}  
      
           The interview evaluates the candidate across 5 core areas:
           1. Role Knowledge (30%) - Ask questions strictly based on the following 5 topics extracted from the job description: ${input.JD_topics?.join(", ")} and Distribute questions evenly across these topics throughout the interview.
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
      
           Format of your response (strict JSON format only). Please respond ONLY with valid JSON as per the format. No natural language or extra explanation.
           {
             "topic": "One of 5 core areas",
             "question": "Next interview question or follow-up (max 3 lines)"
             keep in mind if it is in Role Knowledge, keep it Role Knowledge : <One of the 5 topics from JD_topic>
           }`;

        const [completionResult] = await Promise.all([
          // Next question generation with response
          openai.createChatCompletion({
            model: "gpt-4o-2024-08-06",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
            presence_penalty: 0.6,
            frequency_penalty: 0.5,
          }),
        ]);

        const result = (await completionResult.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        console.log("GPT time:", Date.now() - gptStart);

        // const nextQuestion =
        //   result.choices[0]?.message?.content ?? "Could you elaborate on that?";

        const content = result.choices[0]?.message?.content ?? "";
        let nextQuestion = "";
        let topic = "Unknown";

        // Safely extract JSON from raw GPT content (in case it includes markdown backticks)
        let jsonContent = content.trim();
        const markdownMatch = jsonContent.match(
          /```(?:json)?\s*([\s\S]*?)\s*```/i,
        );
        jsonContent = markdownMatch?.[1]?.trim() ?? jsonContent;

        try {
          const parsed = JSON.parse(jsonContent) as {
            question: string;
            topic: string;
          };
          nextQuestion = parsed.question ?? "";
          topic = parsed.topic ?? "Unknown";
        } catch (err) {
          console.warn("Failed to parse structured GPT response:", err);
          console.warn("Raw content received:", content);
        }

        let ttsStart = Date.now();
        // Generate audio for next question
        const audioResponse = await deepgram.speak.request(
          {
            text: nextQuestion,
          },
          {
            model: "aura-asteria-en",
            encoding: "linear16",
            container: "wav",
          },
        );

        const stream = await audioResponse.getStream();
        if (!stream) {
          throw new Error("Failed to generate audio stream");
        }
        console.log("🕒 TTS time:", Date.now() - ttsStart, "ms");
        console.log("🕒 Total time:", Date.now() - start, "ms");


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
          }, new Uint8Array(0)),
        ).toString("base64");

        const updatedPreviousQuestions = [
          ...(input.previousQuestions ?? []),
          {
            question: input.currentQuestion,
            topic: topic ?? "Unknown",
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
          message: "Failed to process audio stream",
          cause: error,
        });
      }
    }),

  getThankYouMessage: publicProcedure
    .input(
      z.object({
        fullName: z.string(),
      }),
    )
    .mutation(
      async ({ input }): Promise<{ audio: string; message: string }> => {
        try {
          // Use a fixed thank you message instead of generating one
          const thankYouMessage = `Thank you ${input.fullName}, your session for this interview is now over. Your responses have been recorded. Please submit your responses to complete the process. We appreciate your participation.`;

          // Generate audio for the thank you message
          const audioResponse = await deepgram.speak.request(
            {
              text: thankYouMessage,
            },
            {
              model: "aura-asteria-en",
              encoding: "linear16",
              container: "wav",
            },
          );

          const stream = await audioResponse.getStream();
          if (!stream) {
            throw new Error("Failed to generate audio stream");
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
            }, new Uint8Array(0)),
          ).toString("base64");

          return {
            audio: audioBase64,
            message: thankYouMessage,
          };
        } catch (error) {
          console.error("Error generating thank you message:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate thank you message",
            cause: error,
          });
        }
      },
    ),

  updateViolation: publicProcedure
    .input(
      z.object({
        interviewId: z.string(),
        userId: z.string(),
        sessionId: z.string(),
        phoneNumber: z.string(),
        collegeName: z.string(),
        yearOfPassing: z.string(),
        rollno: z.string(),
        stream: z.string(),
        email: z.string(),
        fullName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nextAttemptTime = addHours(new Date(), 2);

      // Insert new row with violation status
      await ctx.db.insert(studentInterviewSubmission).values({
        studentId: input.userId,
        interviewId: input.interviewId,
        sessionId: input.sessionId,
        status: "violated",
        nextAttemptTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send violation email
      await sendInterviewViolatedEmail({
        email: input.email,
        studentId: input.userId,
        fullName: input.fullName,
        interviewId: input.interviewId,
        phoneNumber: input.phoneNumber,
        collegeName: input.collegeName,
        yearOfPassing: input.yearOfPassing,
        rollno: input.rollno,
        stream: input.stream,
        nextAttemptTime,
      });

      return { success: true };
    }),

  getQuestions: publicProcedure
    .input(
      z.object({
        interviewType: z.enum(["1", "2", "3"]),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const table =
        input.interviewType === "1"
          ? interviewOneQuestion
          : input.interviewType === "2"
            ? interviewTwoQuestion
            : interviewThreeQuestion;

      // Get total count
      const totalCount = await ctx.db
        .select({ count: count() })
        .from(table)
        .execute()
        .then((res) => res[0]?.count ?? 0);

      // Get paginated questions with proper typing
      const questions = await ctx.db
        .select()
        .from(table)
        .orderBy(asc(table.createdAt))
        .limit(input.limit + 1)
        .offset(input.offset);

      let hasNext = false;
      if (questions.length > input.limit) {
        questions.pop(); // Remove the extra item
        hasNext = true;
      }

      return {
        questions,
        totalCount,
        hasNext,
      };
    }),

  uploadQuestions: publicProcedure
    .input(
      z.object({
        questions: z.array(z.string()),
        interviewType: z.enum(["1", "2", "3"]),
        uploadType: z.enum(["append", "replace"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const table =
          input.interviewType === "1"
            ? interviewOneQuestion
            : input.interviewType === "2"
              ? interviewTwoQuestion
              : interviewThreeQuestion;

        // Filter out empty questions
        const newQuestions = input.questions
          .filter((q) => q.trim())
          .map((question) => ({
            question,
            createdAt: new Date(),
          }));

        if (newQuestions.length === 0) {
          throw new Error("No valid questions found in file");
        }

        // Use transaction to ensure data consistency
        await ctx.db.transaction(async (tx) => {
          if (input.uploadType === "replace") {
            // For replace: First delete all existing
            await tx
              .delete(table)
              .where(sql`1=1`)
              .execute();
          }

          // For both append and replace: Insert new questions
          await tx.insert(table).values(newQuestions).execute();
        });

        console.log("Upload completed:", {
          type: input.uploadType,
          addedCount: newQuestions.length,
        });

        return {
          success: true,
          count: newQuestions.length,
        };
      } catch (error) {
        console.error("Upload error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to upload questions",
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

      // Fixed: Use proper query syntax
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
    .input(
      z.object({
        userId: z.string(),
        interviewId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const submission =
        await ctx.db.query.studentInterviewSubmission.findFirst({
          where: and(
            eq(studentInterviewSubmission.studentId, input.userId),
            eq(studentInterviewSubmission.interviewId, input.interviewId),
          ),
          orderBy: [desc(studentInterviewSubmission.createdAt)],
        });

      return submission
        ? {
            status: submission.status,
            nextAttemptTime: submission.nextAttemptTime,
          }
        : null;
    }),
});

