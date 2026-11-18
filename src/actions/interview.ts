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
import { calculateHintPenalty, computeCodeCorrectnessScore } from "@/lib/scoring";
import { executeCodeOnServer } from "@/lib/judge0";
import { enqueueReportGeneration } from "@/lib/queue";

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

/**
 * Candidate self-service action to start a PRACTICE interview
 */
export async function createPracticeInterviewAction(input: {
  jobRole: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topics?: string[];
}): Promise<{ success: boolean; interviewId?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const interview = await db.interview.create({
      data: {
        userId: session.user.id,
        title: `${input.jobRole} Practice Interview`,
        jobRole: input.jobRole,
        difficulty: input.difficulty,
        topics: input.topics && input.topics.length > 0 ? input.topics : [input.jobRole, "Core Skills"],
        status: "PENDING",
        mode: "PRACTICE",
        durationMinutes: 30,
      },
    });

    return { success: true, interviewId: interview.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create practice interview" };
  }
}

/**
 * Server-authoritative action to request the next progressive hint for a question
 */
export async function requestHintAction(input: {
  interviewId: string;
  questionId: string;
}): Promise<{
  success: boolean;
  hint?: string;
  hintsRevealed?: number;
  penaltyPercent?: number;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { interviewId, questionId } = input;
    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: { questions: true },
    });

    if (!interview || (interview.userId !== session.user.id && session.user.role !== "ADMIN")) {
      return { success: false, error: "Interview not found or unauthorized" };
    }

    if (interview.status === "COMPLETED") {
      return { success: false, error: "Interview is already completed" };
    }

    const question = interview.questions.find((q) => q.id === questionId);
    if (!question) {
      return { success: false, error: "Question not found" };
    }

    const currentRevealed = question.hintsRevealed || 0;
    const totalHints = question.hints.length;

    if (currentRevealed >= Math.min(3, totalHints)) {
      return { success: false, error: "Maximum hints already revealed for this question." };
    }

    const nextIndex = currentRevealed;
    const hintText = question.hints[nextIndex];
    const newRevealedCount = currentRevealed + 1;

    // Atomically increment hintsRevealed on question and hintsUsed on interview
    await db.$transaction([
      db.question.update({
        where: { id: questionId },
        data: { hintsRevealed: { increment: 1 } },
      }),
      db.interview.update({
        where: { id: interviewId },
        data: { hintsUsed: { increment: 1 } },
      }),
      db.activityEvent.create({
        data: {
          interviewId,
          type: "HINT_REQUESTED",
          description: `Hint ${newRevealedCount} requested (-${newRevealedCount * 5}% penalty applied to question score).`,
        },
      }),
    ]);

    return {
      success: true,
      hint: hintText,
      hintsRevealed: newRevealedCount,
      penaltyPercent: newRevealedCount * 5,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to request hint" };
  }
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

    // Check if total assessment duration has expired
    const durationMinutes = (interview.template?.duration || interview.durationMinutes || 30) + (interview.extraTimeMinutes || 0);
    if (interview.startedAt) {
      const elapsedMs = Date.now() - new Date(interview.startedAt).getTime();
      const maxMs = durationMinutes * 60 * 1000;
      if (elapsedMs > maxMs) {
        await enqueueReportGeneration(interview.id);
        return {
          success: true,
          isCompleted: true,
          error: "Assessment time limit has expired. Your responses have been saved and final report is generating.",
        };
      }
    }

    const existingQuestions = interview.questions;
    const targetQuestionCount = interview.template?.questionCount || (existingQuestions.length > 0 ? existingQuestions.length : 5);

    // Check if there is an existing unanswered question
    const unansweredQuestion = existingQuestions.find((q) => !q.response);
    if (unansweredQuestion) {
      const sanitizedQuestion = {
        ...unansweredQuestion,
        hints: (unansweredQuestion.hints || []).slice(0, unansweredQuestion.hintsRevealed || 0),
        hintsCount: (unansweredQuestion.hints || []).length,
        hintsRevealed: unansweredQuestion.hintsRevealed || 0,
        testCases: ((unansweredQuestion.testCases as any[]) || []).filter((tc) => !tc.isHidden),
      };

      return {
        success: true,
        question: sanitizedQuestion,
        totalQuestions: Math.max(targetQuestionCount, existingQuestions.length),
        isCompleted: false,
        durationMinutes,
        startedAt: interview.startedAt,
        proctoringPolicy: interview.template?.proctoringPolicy || null,
        mode: interview.mode || "ASSESSMENT",
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

    const tailoredHints = generated.hints && generated.hints.length > 0 ? generated.hints : [
      `Review key ${interview.jobRole} constraints and edge conditions.`,
      `Consider time/space complexity optimization opportunities.`,
      `Provide concrete architectural or practical implementation details.`
    ];

    // Save question in database with problem-tailored test cases
    const newQuestion = await db.question.create({
      data: {
        interviewId: interview.id,
        orderIndex: nextOrderIndex,
        type: generated.type,
        content: generated.content,
        context: generated.context || null,
        expectedTopics: generated.expectedTopics,
        hints: tailoredHints,
        hintsRevealed: 0,
        starterCode: generated.starterCode ? { default: generated.starterCode } : undefined,
        testCases: generated.testCases ?? (generated.type === "CODING" ? [
          { input: "[[1,3],[2,6],[8,10],[15,18]]", expectedOutput: [[1,6],[8,10],[15,18]], isHidden: false, explanation: "Standard merge" },
          { input: "[[1,4],[4,5]]", expectedOutput: [[1,5]], isHidden: false, explanation: "Adjacent boundary" },
          { input: "[[1,4],[0,4]]", expectedOutput: [[0,4]], isHidden: true, explanation: "Enclosing interval" }
        ] : undefined),
      },
      include: {
        response: true,
      },
    });

    const sanitizedNewQuestion = {
      ...newQuestion,
      hints: (newQuestion.hints || []).slice(0, newQuestion.hintsRevealed || 0),
      hintsCount: (newQuestion.hints || []).length,
      hintsRevealed: newQuestion.hintsRevealed || 0,
      testCases: ((newQuestion.testCases as any[]) || []).filter((tc) => !tc.isHidden),
    };

    return {
      success: true,
      question: sanitizedNewQuestion,
      totalQuestions: targetQuestionCount,
      isCompleted: false,
      durationMinutes,
      startedAt: interview.startedAt,
      proctoringPolicy: interview.template?.proctoringPolicy || null,
      mode: interview.mode || "ASSESSMENT",
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

    // Check if total assessment duration has expired
    const durationMinutes = (interview.template?.duration || interview.durationMinutes || 30) + (interview.extraTimeMinutes || 0);
    if (interview.startedAt) {
      const elapsedMs = Date.now() - new Date(interview.startedAt).getTime();
      const maxMs = durationMinutes * 60 * 1000;
      if (elapsedMs > maxMs) {
        await enqueueReportGeneration(interview.id);
        return {
          success: false,
          error: "Assessment time limit has expired. Your responses have been saved.",
          isCompleted: true,
        };
      }
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

    // Authoritative hints count tracked on server
    const numHints = targetQuestion.hintsRevealed || 0;

    // Follow-Up State Machine: Handle follow-up turns if response already exists
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

        // Apply hint penalty to updated follow-up score
        const { penaltyAmount: fuPenalty, finalScore: fuFinalScore } = calculateHintPenalty(followUpEval.score, numHints);

        // Update evaluation with real recalculated score
        await db.evaluation.update({
          where: { responseId: targetQuestion.response.id },
          data: {
            score: fuFinalScore, // Score updated!
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
            score: fuFinalScore,
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
    const { penaltyAmount, finalScore, penaltyFraction } = calculateHintPenalty(evaluationResult.score, numHints);

    // 1c. Server-Side Execution of Test Cases via Judge0 / Isolated Sandbox
    let verifiedPassed: number | null = null;
    let verifiedTotal: number | null = null;
    if (targetQuestion.type === "CODING" && code) {
      const execResult = await executeCodeOnServer(
        code,
        (targetQuestion.testCases as any[]) || [],
        language || "javascript"
      );
      verifiedPassed = execResult.passed;
      verifiedTotal = execResult.total;
    }
    const codeCorrectness = computeCodeCorrectnessScore(verifiedPassed, verifiedTotal);

    // 2. Persist Response and Evaluation with explicit hint penalty, version stamping, and verified test results
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
            codeCorrectness,
            codeEfficiency: null,
            codeReadability: null,
            testCasesPassed: verifiedPassed,
            testCasesTotal: verifiedTotal,
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
        tokenCount: { increment: evaluationResult.tokenCount || 0 },
        estimatedCost: { increment: evaluationResult.estimatedCost || 0 },
      },
    });

    // 3. Check if all questions are now answered according to template
    const targetQuestionCount = interview.template?.questionCount || (interview.questions.length > 0 ? interview.questions.length : 5);
    const answeredCount = interview.questions.filter((q) => q.response || q.id === questionId).length;
    const isSessionFinished = answeredCount >= targetQuestionCount;

    if (isSessionFinished) {
      const startTime = interview.startedAt ? new Date(interview.startedAt).getTime() : new Date(interview.createdAt).getTime();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      await db.interview.update({
        where: { id: interview.id },
        data: {
          durationSeconds,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Enqueue final report compilation, PDF generation, and notifications in the background
      await enqueueReportGeneration(interview.id);

      return {
        success: true,
        evaluation: {
          ...savedResponse.evaluation,
          shouldFollowUp: evaluationResult.shouldFollowUp,
          followUpQuestion: evaluationResult.followUpQuestion,
        },
        isCompleted: true,
      };
    }

    return {
      success: true,
      evaluation: {
        ...savedResponse.evaluation,
        shouldFollowUp: evaluationResult.shouldFollowUp,
        followUpQuestion: evaluationResult.followUpQuestion,
      },
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



