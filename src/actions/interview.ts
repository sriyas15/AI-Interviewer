"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createInterviewSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import type { CreateInterviewInput } from "@/lib/validations";
import {
  generateInterviewQuestion,
  evaluateCandidateAnswer,
  generateFinalInterviewReport,
} from "@/lib/ai/service";

export interface CreateInterviewResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createInterview(
  input: CreateInterviewInput
): Promise<CreateInterviewResult> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const validated = createInterviewSchema.safeParse(input);

  if (!validated.success) {
    return {
      success: false,
      error: "Please fix the errors below.",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  const { jobRole, difficulty, topics } = validated.data;

  const interview = await db.interview.create({
    data: {
      userId: session.user.id,
      title: `${jobRole} Mock Interview`,
      jobRole,
      difficulty,
      topics,
      status: "PENDING",
    },
  });

  redirect(`/interview/${interview.id}/start`);
}

export async function startInterviewSession(
  interviewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, userId: true, status: true },
    });

    if (!interview) {
      return { success: false, error: "Interview session not found." };
    }

    if (interview.userId !== session.user.id) {
      return { success: false, error: "You are not authorized to access this interview." };
    }

    // Update status to IN_PROGRESS if pending
    if (interview.status === "PENDING") {
      await db.interview.update({
        where: { id: interviewId },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to start interview session:", error);
    return { success: false, error: "Failed to initialize interview. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────
// Get or Generate Active Question
// ─────────────────────────────────────────────────────────────

export async function getOrGenerateNextQuestion(interviewId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            response: {
              include: {
                evaluation: true,
              },
            },
          },
        },
      },
    });

    if (!interview || (interview.userId !== session.user.id && session.user.role !== "ADMIN")) {
      return { success: false, error: "Interview not found or unauthorized" };
    }

    // If interview is marked completed, return completed status immediately
    if (interview.status === "COMPLETED") {
      return {
        success: true,
        isCompleted: true,
      };
    }

    // Check if total assessment duration has expired
    const durationMinutes = interview.durationMinutes || 30;
    if (interview.startedAt) {
      const elapsedMs = Date.now() - new Date(interview.startedAt).getTime();
      const maxMs = durationMinutes * 60 * 1000;
      if (elapsedMs > maxMs) {
        await db.interview.update({
          where: { id: interview.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
        return {
          success: true,
          isCompleted: true,
          error: "Assessment time has expired.",
        };
      }
    }

    const existingQuestions = interview.questions;

    // Check if there is an existing unanswered question
    const unansweredQuestion = existingQuestions.find((q) => !q.response);
    if (unansweredQuestion) {
      return {
        success: true,
        question: unansweredQuestion,
        totalQuestions: Math.max(5, existingQuestions.length),
        isCompleted: false,
        durationMinutes,
        startedAt: interview.startedAt,
      };
    }

    const MAX_QUESTIONS = 5;

    // If we already answered all 5 questions, the interview is completed
    if (existingQuestions.length >= MAX_QUESTIONS) {
      return {
        success: true,
        isCompleted: true,
      };
    }

    // Generate the next question
    const nextOrderIndex = existingQuestions.length + 1;
    const generated = await generateInterviewQuestion({
      jobRole: interview.jobRole,
      difficulty: interview.difficulty,
      topics: interview.topics,
      orderIndex: nextOrderIndex,
      previousQuestions: existingQuestions.map((q) => ({
        content: q.content,
        response: q.response?.content,
      })),
    });

    const tailoredHints = [
      `Review key ${interview.jobRole} constraints and edge conditions.`,
      `Consider time/space complexity optimization opportunities.`,
      `Provide concrete architectural or practical implementation details.`
    ];

    // Save question in database
    const newQuestion = await db.question.create({
      data: {
        interviewId: interview.id,
        orderIndex: nextOrderIndex,
        type: generated.type,
        content: generated.content,
        context: generated.context || null,
        expectedTopics: generated.expectedTopics,
        hints: tailoredHints,
      },
      include: {
        response: true,
      },
    });

    return {
      success: true,
      question: newQuestion,
      totalQuestions: MAX_QUESTIONS,
      isCompleted: false,
      durationMinutes,
      startedAt: interview.startedAt,
    };
  } catch (error) {
    console.error("Error in getOrGenerateNextQuestion:", error);
    return { success: false, error: "Failed to retrieve next question" };
  }
}

// ─────────────────────────────────────────────────────────────
// Submit Candidate Answer & Trigger Evaluation
// ─────────────────────────────────────────────────────────────

interface SubmitAnswerInput {
  interviewId: string;
  questionId: string;
  content: string;
  code?: string | null;
  language?: string | null;
  durationMs?: number | null;
  hintsUsed?: number;
}

export async function submitAnswerAndEvaluate(input: SubmitAnswerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { interviewId, questionId, content, code, language, durationMs, hintsUsed = 0 } = input;

    // Security check: verify ownership
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            response: {
              include: {
                evaluation: true,
              },
            },
          },
        },
      },
    });

    if (!interview || (interview.userId !== session.user.id && session.user.role !== "ADMIN")) {
      return { success: false, error: "Interview not found or unauthorized" };
    }

    // Prevent submissions on already completed interviews
    if (interview.status === "COMPLETED") {
      return { success: false, error: "This interview has already been completed." };
    }

    // Input payload size constraints against DoS / memory exhaustion
    if (content && content.length > 20000) {
      return { success: false, error: "Answer text exceeds maximum limit of 20,000 characters." };
    }
    if (code && code.length > 50000) {
      return { success: false, error: "Code snippet exceeds maximum limit of 50,000 characters." };
    }

    const targetQuestion = interview.questions.find((q) => q.id === questionId);
    if (!targetQuestion) {
      return { success: false, error: "Question not found in this interview" };
    }

    // Prevent duplicate submissions and unique constraint race conditions
    if (targetQuestion.response) {
      return { success: false, error: "An answer has already been submitted for this question." };
    }

    // 1. Evaluate with AI
    const evaluationResult = await evaluateCandidateAnswer({
      question: {
        content: targetQuestion.content,
        type: targetQuestion.type,
        expectedTopics: targetQuestion.expectedTopics,
      },
      responseContent: content,
      code,
      jobRole: interview.jobRole,
      difficulty: interview.difficulty,
    });

    // 1b. Apply hint penalty: 1 hint = -5%, 2 hints = -10%, 3 hints = -15%
    const numHints = Math.max(0, Math.min(3, hintsUsed));
    const penaltyFraction = numHints === 1 ? 0.05 : numHints === 2 ? 0.10 : numHints >= 3 ? 0.15 : 0;
    const rawScore = evaluationResult.score;
    const penaltyAmount = Number((rawScore * penaltyFraction).toFixed(2));
    const finalScore = Math.max(0, Number((rawScore - penaltyAmount).toFixed(1)));

    // 2. Persist Response and Evaluation with explicit hint penalty
    const savedResponse = await db.response.create({
      data: {
        questionId: targetQuestion.id,
        content: content.trim() || "(No verbal answer provided)",
        code: code || null,
        language: language || null,
        durationMs: durationMs || null,
        hintsUsed: numHints,
        penaltyScore: penaltyAmount,
        evaluation: {
          create: {
            score: finalScore,
            feedback: numHints > 0
              ? `${evaluationResult.feedback} [Note: A ${Math.round(penaltyFraction * 100)}% hint penalty was applied to this question score (-${penaltyAmount.toFixed(1)} pts).]`
              : evaluationResult.feedback,
            strengths: evaluationResult.strengths,
            weaknesses: evaluationResult.weaknesses,
            followUpAsked: evaluationResult.shouldFollowUp,
          },
        },
      },
      include: {
        evaluation: true,
      },
    });

    // Track hints on interview session
    if (numHints > 0) {
      await db.interview.update({
        where: { id: interviewId },
        data: {
          hintsUsed: { increment: numHints },
        },
      });

      await db.activityEvent.create({
        data: {
          interviewId,
          type: "HINT_REQUESTED",
          description: `Candidate used ${numHints} hint(s) on Question #${targetQuestion.orderIndex} (-${Math.round(penaltyFraction * 100)}% scoring penalty applied).`,
          metadata: { hintsUsed: numHints, penaltyScore: penaltyAmount, questionId: targetQuestion.id },
        },
      });
    }

    // 3. Check if all questions are now answered
    const MAX_QUESTIONS = 5;
    const answeredCount = interview.questions.filter((q) => q.response || q.id === questionId).length;
    const isSessionFinished = answeredCount >= MAX_QUESTIONS;

    if (isSessionFinished) {
      // Re-fetch all questions and responses to compile comprehensive report
      const allQuestions = await db.question.findMany({
        where: { interviewId },
        orderBy: { orderIndex: "asc" },
        include: {
          response: {
            include: {
              evaluation: true,
            },
          },
        },
      });

      // Generate Final Report with AI
      const finalReport = await generateFinalInterviewReport({
        interview: {
          jobRole: interview.jobRole,
          difficulty: interview.difficulty,
          topics: interview.topics,
        },
        questionsWithResponses: allQuestions.map((q) => ({
          content: q.content,
          type: q.type,
          response: q.response
            ? {
                content: q.response.content,
                code: q.response.code,
                evaluation: q.response.evaluation
                  ? {
                      score: q.response.evaluation.score,
                      feedback: q.response.evaluation.feedback,
                      strengths: q.response.evaluation.strengths,
                      weaknesses: q.response.evaluation.weaknesses,
                    }
                  : null,
              }
            : null,
        })),
      });

      // Save Report and mark interview COMPLETED
      await db.$transaction([
        db.report.create({
          data: {
            interviewId: interview.id,
            overallScore: finalReport.overallScore,
            summary: finalReport.summary,
            technicalScore: finalReport.technicalScore,
            communicationScore: finalReport.communicationScore,
            problemSolvingScore: finalReport.problemSolvingScore,
            codeQualityScore: finalReport.codeQualityScore ?? null,
            strengths: finalReport.strengths,
            weaknesses: finalReport.weaknesses,
            recommendations: finalReport.recommendations,
            detailedFeedback: finalReport as unknown as object,
          },
        }),
        db.interview.update({
          where: { id: interview.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            totalScore: finalReport.overallScore,
          },
        }),
      ]);

      return {
        success: true,
        evaluation: evaluationResult,
        isCompleted: true,
      };
    }

    return {
      success: true,
      evaluation: evaluationResult,
      isCompleted: false,
    };
  } catch (error) {
    console.error("Error in submitAnswerAndEvaluate:", error);
    return { success: false, error: "Failed to evaluate answer and submit" };
  }
}

// ─────────────────────────────────────────────────────────────
// Anti-Cheat / Activity Monitoring Logger
// ─────────────────────────────────────────────────────────────

interface LogActivityInput {
  interviewId: string;
  type: "TAB_SWITCH" | "COPY" | "PASTE" | "FULLSCREEN_EXIT" | "WINDOW_BLUR" | "SUSPICIOUS_TYPING" | "HINT_REQUESTED";
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivityEvent(input: LogActivityInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    const { interviewId, type, description, metadata } = input;

    const ALLOWED_TYPES = [
      "TAB_SWITCH",
      "COPY",
      "PASTE",
      "FULLSCREEN_EXIT",
      "WINDOW_BLUR",
      "SUSPICIOUS_TYPING",
      "HINT_REQUESTED",
    ] as const;

    if (!ALLOWED_TYPES.includes(type)) {
      return { success: false };
    }

    // Verify interview ownership
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      select: { userId: true },
    });

    if (!interview || (interview.userId !== session.user.id && session.user.role !== "ADMIN")) {
      return { success: false };
    }

    const safeDescription = (description || `Candidate triggered ${type}`).slice(0, 500);

    await db.activityEvent.create({
      data: {
        interviewId,
        type,
        description: safeDescription,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    return { success: true };
  } catch (e) {
    console.warn("Failed to log activity event:", e);
    return { success: false };
  }
}

// ─────────────────────────────────────────────────────────────
// Recruiter Feedback Release Control
// ─────────────────────────────────────────────────────────────

export async function toggleReleaseFeedbackAction(interviewId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return { success: false, error: "Unauthorized. Admin role required to release feedback." };
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, feedbackReleased: true },
    });

    if (!interview) {
      return { success: false, error: "Interview session not found." };
    }

    const updated = await db.interview.update({
      where: { id: interviewId },
      data: {
        feedbackReleased: !interview.feedbackReleased,
      },
    });

    return {
      success: true,
      feedbackReleased: updated.feedbackReleased,
    };
  } catch (err) {
    console.error("toggleReleaseFeedbackAction error:", err);
    return { success: false, error: "Failed to update feedback release setting." };
  }
}



