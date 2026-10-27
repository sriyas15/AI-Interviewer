// ─────────────────────────────────────────────────────────────
// Shared TypeScript types for the AI Interviewer
// ─────────────────────────────────────────────────────────────
// These types are used across the frontend and backend.
// They mirror the Prisma schema but are decoupled so the
// frontend never imports Prisma directly.
// ─────────────────────────────────────────────────────────────

// ─── Enums ───────────────────────────────────────────────────

export type UserRole = "CANDIDATE" | "ADMIN";

export type InterviewStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type QuestionType =
  | "BEHAVIORAL"
  | "TECHNICAL"
  | "CODING"
  | "SYSTEM_DESIGN";

export type ActivityType =
  | "TAB_SWITCH"
  | "COPY"
  | "PASTE"
  | "FULLSCREEN_EXIT"
  | "WINDOW_BLUR"
  | "SUSPICIOUS_TYPING";

// ─── Core Types ──────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Interview {
  id: string;
  title: string;
  jobRole: string;
  difficulty: Difficulty;
  topics: string[];
  status: InterviewStatus;
  totalScore: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface Question {
  id: string;
  orderIndex: number;
  type: QuestionType;
  content: string;
  context: string | null;
  expectedTopics: string[];
  createdAt: Date;
  interviewId: string;
}

export interface Response {
  id: string;
  content: string;
  code: string | null;
  language: string | null;
  durationMs: number | null;
  createdAt: Date;
  questionId: string;
}

export interface Evaluation {
  id: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  followUpAsked: boolean;
  codeCorrectness: number | null;
  codeEfficiency: number | null;
  codeReadability: number | null;
  testCasesPassed: number | null;
  testCasesTotal: number | null;
  createdAt: Date;
  responseId: string;
}

export interface Report {
  id: string;
  overallScore: number;
  summary: string;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  codeQualityScore: number | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  detailedFeedback: Record<string, unknown>;
  createdAt: Date;
  interviewId: string;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  description: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
  interviewId: string;
}

// ─── Form / API Types ────────────────────────────────────────

export interface CreateInterviewInput {
  title: string;
  jobRole: string;
  difficulty: Difficulty;
  topics: string[];
}

export interface InterviewWithDetails extends Interview {
  questions: (Question & {
    response:
      | (Response & {
          evaluation: Evaluation | null;
        })
      | null;
  })[];
  report: Report | null;
  activities: ActivityEvent[];
}

// ─── API Response Types ──────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
