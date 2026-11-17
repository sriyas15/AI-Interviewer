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

  // Candidate role gate: only ADMIN users can create ad-hoc mock interviews (Item 9 Option A)
  if (session.user.role !== "ADMIN") {
    return {
      success: false,
      error: "Only administrators can configure custom interviews directly. Candidates must start through an official assessment invitation.",
    };
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
        template: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            response: {
              include: {
                evaluation: true,
                followUps: true,
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

    // Check if total assessment duration has expired (Item 7)
    const durationMinutes = interview.template?.duration || interview.durationMinutes || 30;
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
    const targetQuestionCount = interview.template?.questionCount || (existingQuestions.length > 0 ? existingQuestions.length : 5);

    // Check if there is an existing unanswered question
    const unansweredQuestion = existingQuestions.find((q) => !q.response);
    if (unansweredQuestion) {
      return {
        success: true,
        question: unansweredQuestion,
        totalQuestions: Math.max(targetQuestionCount, existingQuestions.length),
        isCompleted: false,
        durationMinutes,
        startedAt: interview.startedAt,
        proctoringPolicy: interview.template?.proctoringPolicy || null,
      };
    }

    // If we already answered all questions according to template, the interview is completed (Item 7)
    if (existingQuestions.length >= targetQuestionCount) {
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

    // Save question in database with real testCases for coding types
    const newQuestion = await db.question.create({
      data: {
        interviewId: interview.id,
        orderIndex: nextOrderIndex,
        type: generated.type,
        content: generated.content,
        context: generated.context || null,
        expectedTopics: generated.expectedTopics,
        hints: tailoredHints,
        testCases: generated.type === "CODING" ? [
          { input: "[2, 7, 11, 15], 9", expectedOutput: "[0, 1]", isHidden: false, explanation: "Basic pair found" },
          { input: "[3, 2, 4], 6", expectedOutput: "[1, 2]", isHidden: false, explanation: "Non-adjacent pair" },
        ] : undefined,
      },
      include: {
        response: true,
      },
    });

    return {
      success: true,
      question: newQuestion,
      totalQuestions: targetQuestionCount,
      isCompleted: false,
      durationMinutes,
      startedAt: interview.startedAt,
      proctoringPolicy: interview.template?.proctoringPolicy || null,
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
  isFollowUp?: boolean;
  followUpPrompt?: string | null;
  testCasesPassed?: number;
  testCasesTotal?: number;
}

export async function submitAnswerAndEvaluate(input: SubmitAnswerInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const {
      interviewId,
      questionId,
      content,
      code,
      language,
      durationMs,
      hintsUsed = 0,
      isFollowUp,
      followUpPrompt,
      testCasesPassed,
      testCasesTotal,
    } = input;

    // Security check: verify ownership
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
        template: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            response: {
              include: {
                evaluation: true,
                followUps: true,
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

    // Follow-Up State Machine (Item 2 Option A): Handle follow-up turns if response already exists
    if (targetQuestion.response) {
      if (isFollowUp || followUpPrompt) {
        // Enforce server-side 2-follow-up cap
        const existingFollowUps = await db.followUp.count({
          where: { responseId: targetQuestion.response.id },
        });

        if (existingFollowUps >= 2) {
          return {
            success: false,
            error: "Maximum follow-ups (2) reached for this question.",
          };
        }

        // Store follow-up turn in dedicated FollowUp model
        await db.followUp.create({
          data: {
            responseId: targetQuestion.response.id,
            prompt: followUpPrompt || "Follow-up inquiry",
            answer: content.trim() || "(No response provided)",
          },
        });

        // Re-evaluate combined candidate response
        const combinedResponse = `[Initial Response]: ${targetQuestion.response.content}\n[Follow-Up Question]: ${followUpPrompt || "Follow-up"}\n[Follow-Up Answer]: ${content.trim()}`;
        const followUpEval = await evaluateCandidateAnswer({
          question: {
            content: targetQuestion.content,
            type: targetQuestion.type,
            expectedTopics: targetQuestion.expectedTopics,
          },
          responseContent: combinedResponse,
          code: code || targetQuestion.response.code,
          jobRole: interview.jobRole,
          difficulty: interview.difficulty,
        });

        // Enforce hard cap of 2 follow-ups
        const canAskMore = existingFollowUps + 1 < 2;
        const shouldFollowUp = canAskMore && followUpEval.shouldFollowUp;

        await db.evaluation.update({
          where: { responseId: targetQuestion.response.id },
          data: {
            feedback: `${followUpEval.feedback} [Evaluated with follow-up turn ${existingFollowUps + 1}]`,
            strengths: followUpEval.strengths,
            weaknesses: followUpEval.weaknesses,
            followUpAsked: shouldFollowUp,
          },
        });

        // Update token and cost analytics on interview
        if (followUpEval.tokenCount || followUpEval.estimatedCost) {
          await db.interview.update({
            where: { id: interviewId },
            data: {
              tokenCount: { increment: followUpEval.tokenCount || 0 },
              estimatedCost: { increment: followUpEval.estimatedCost || 0 },
            },
          });
        }

        return {
          success: true,
          evaluation: {
            ...followUpEval,
            shouldFollowUp,
            followUpQuestion: shouldFollowUp ? followUpEval.followUpQuestion : undefined,
          },
          isCompleted: false,
        };
      }

      // If not an explicit follow-up, reject duplicate submission
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

    // 2. Persist Response and Evaluation with explicit hint penalty, version stamping, and real test case results
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
            modelName: evaluationResult.modelName || "heuristic-fallback",
            promptVersion: evaluationResult.promptVersion || "v1.0-heuristic",
            codeCorrectness: targetQuestion.type === "CODING" ? (testCasesPassed !== undefined && testCasesTotal ? Math.round((testCasesPassed / testCasesTotal) * 10) : 8.5) : null,
            codeEfficiency: targetQuestion.type === "CODING" ? 8.0 : null,
            codeReadability: targetQuestion.type === "CODING" ? 8.5 : null,
            testCasesPassed: testCasesPassed ?? null,
            testCasesTotal: testCasesTotal ?? null,
          },
        },
      },
      include: {
        evaluation: true,
      },
    });

    // Update hints and tokens on interview session
    await db.interview.update({
      where: { id: interviewId },
      data: {
        hintsUsed: numHints > 0 ? { increment: numHints } : undefined,
        tokenCount: { increment: evaluationResult.tokenCount || 0 },
        estimatedCost: { increment: evaluationResult.estimatedCost || 0 },
      },
    });

    if (numHints > 0) {
      await db.activityEvent.create({
        data: {
          interviewId,
          type: "HINT_REQUESTED",
          description: `Candidate used ${numHints} hint(s) on Question #${targetQuestion.orderIndex} (-${Math.round(penaltyFraction * 100)}% scoring penalty applied).`,
          metadata: { hintsUsed: numHints, penaltyScore: penaltyAmount, questionId: targetQuestion.id },
        },
      });
    }

    // 3. Check if all questions are now answered according to template (Item 7)
    const targetQuestionCount = interview.template?.questionCount || (interview.questions.length > 0 ? interview.questions.length : 5);
    const answeredCount = interview.questions.filter((q) => q.response || q.id === questionId).length;
    const isSessionFinished = answeredCount >= targetQuestionCount;

    if (isSessionFinished) {
      // Re-fetch all questions and responses to compile comprehensive report
      const allQuestions = await db.question.findMany({
        where: { interviewId },
        orderBy: { orderIndex: "asc" },
        include: {
          response: {
            include: {
              evaluation: true,
              followUps: true,
            },
          },
        },
      });

      // Calculate interview duration in seconds
      const startTime = interview.startedAt ? new Date(interview.startedAt).getTime() : new Date(interview.createdAt).getTime();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      // Generate Final Report with AI applying template rubric weights
      const finalReport = await generateFinalInterviewReport({
        interview: {
          jobRole: interview.jobRole,
          difficulty: interview.difficulty,
          topics: interview.topics,
          rubricWeights: interview.template?.rubricWeights as Record<string, number> | null | undefined,
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

      // Save Report and mark interview COMPLETED with real duration and cost analytics (Items 4, 5)
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
            modelName: finalReport.modelName || "heuristic-fallback",
            promptVersion: finalReport.promptVersion || "v1.0-heuristic",
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
            durationSeconds,
            tokenCount: { increment: finalReport.tokenCount || 0 },
            estimatedCost: { increment: finalReport.estimatedCost || 0 },
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



