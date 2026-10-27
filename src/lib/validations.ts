// ─────────────────────────────────────────────────────────────
// Zod Validation Schemas
// ─────────────────────────────────────────────────────────────
// Zod schemas validate data at RUNTIME (TypeScript only
// checks at compile time). This prevents bad data from
// reaching the database.
//
// Used in: API routes, form validation, LLM output parsing
// ─────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────

export const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

export const questionTypeSchema = z.enum([
  "BEHAVIORAL",
  "TECHNICAL",
  "CODING",
  "SYSTEM_DESIGN",
]);

export const interviewStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const activityTypeSchema = z.enum([
  "TAB_SWITCH",
  "COPY",
  "PASTE",
  "FULLSCREEN_EXIT",
  "WINDOW_BLUR",
  "SUSPICIOUS_TYPING",
]);

// ─── Input Schemas ───────────────────────────────────────────

export const createInterviewSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  jobRole: z
    .string()
    .min(2, "Job role is required")
    .max(50, "Job role must be less than 50 characters"),
  difficulty: difficultySchema,
  topics: z
    .array(z.string().min(1).max(30))
    .min(1, "Select at least one topic")
    .max(10, "Maximum 10 topics"),
});

export const submitResponseSchema = z.object({
  questionId: z.string().cuid(),
  content: z
    .string()
    .min(1, "Response cannot be empty")
    .max(10000, "Response is too long"),
  code: z.string().max(50000).optional(),
  language: z.string().max(20).optional(),
  durationMs: z.number().int().positive().optional(),
});

export const activityEventSchema = z.object({
  interviewId: z.string().cuid(),
  type: activityTypeSchema,
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── LLM Output Schemas ─────────────────────────────────────
// These schemas validate the structured JSON output from LLMs.
// Used with Vercel AI SDK's `generateObject()`.

export const questionGenerationSchema = z.object({
  content: z.string().describe("The interview question text"),
  type: questionTypeSchema.describe("The type of question"),
  context: z
    .string()
    .optional()
    .describe("Additional context or code snippet"),
  expectedTopics: z
    .array(z.string())
    .describe("Topics the answer should ideally cover"),
});

export const evaluationSchema = z.object({
  score: z.number().min(0).max(10).describe("Score from 0-10"),
  feedback: z.string().describe("Detailed feedback on the response"),
  strengths: z
    .array(z.string())
    .describe("What the candidate did well"),
  weaknesses: z
    .array(z.string())
    .describe("Areas for improvement"),
  shouldFollowUp: z
    .boolean()
    .describe("Whether a follow-up question is needed"),
  followUpQuestion: z
    .string()
    .optional()
    .describe("Follow-up question if needed"),
});

export const reportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  summary: z.string().describe("Executive summary of the interview"),
  technicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  problemSolvingScore: z.number().min(0).max(100),
  codeQualityScore: z.number().min(0).max(100).optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z
    .array(z.string())
    .describe("Actionable suggestions for improvement"),
});

// ─── Inferred Types ──────────────────────────────────────────
// These types are auto-generated from the Zod schemas above.

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
export type ActivityEventInput = z.infer<typeof activityEventSchema>;
export type QuestionGeneration = z.infer<typeof questionGenerationSchema>;
export type EvaluationOutput = z.infer<typeof evaluationSchema>;
export type ReportOutput = z.infer<typeof reportSchema>;
