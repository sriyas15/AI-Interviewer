import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { db } from "./db";
import { generateFinalInterviewReport } from "./ai/service";
import { logger } from "./logger";
import { sendCandidateCompletionEmail, sendRecruiterCompletionEmail } from "./email";
import { generateReportPdfBuffer } from "./pdf";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
let redisConnection: Redis | null = null;
let reportQueue: Queue | null = null;

try {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 1000)),
  });

  redisConnection.on("error", (err) => {
    logger.warn({ event: "redis_connection_warning", message: "Redis unavailable; fallback queue will process jobs in-process.", error: err.message });
  });

  reportQueue = new Queue("interview-jobs", { connection: redisConnection });
} catch (err: any) {
  logger.warn({ event: "queue_init_fallback", message: "BullMQ queue initialized with in-process runner fallback." });
}

/**
 * Core asynchronous task that executes the report generation, PDF creation, and email notifications.
 */
export async function processInterviewCompletion(interviewId: string) {
  logger.info({ event: "job_start_report_generation", interviewId });

  try {
    // 1. Mark report status as GENERATING
    await db.interview.update({
      where: { id: interviewId },
      data: {
        reportStatus: "GENERATING",
      },
    });

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      include: {
        user: true,
        template: true,
        invitations: {
          include: {
            invitedBy: true,
          },
        },
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

    if (!interview) {
      throw new Error(`Interview ${interviewId} not found`);
    }

    // 2. Generate comprehensive final report
    const finalReport = await generateFinalInterviewReport({
      interview: {
        jobRole: interview.jobRole,
        difficulty: interview.difficulty,
        topics: interview.topics,
        rubricWeights: interview.template?.rubricWeights as Record<string, number> | null | undefined,
      },
      questionsWithResponses: interview.questions.map((q) => ({
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

    // 3. Persist Report in database
    await db.$transaction([
      db.report.upsert({
        where: { interviewId },
        create: {
          interviewId,
          overallScore: finalReport.overallScore,
          summary: finalReport.summary,
          technicalScore: finalReport.technicalScore,
          communicationScore: finalReport.communicationScore,
          problemSolvingScore: finalReport.problemSolvingScore,
          codeQualityScore: finalReport.codeQualityScore ?? null,
          strengths: finalReport.strengths,
          weaknesses: finalReport.weaknesses,
          recommendations: finalReport.recommendations,
          detailedFeedback: {
            categoryBreakdown: {
              technical: finalReport.technicalScore,
              communication: finalReport.communicationScore,
              problemSolving: finalReport.problemSolvingScore,
              codeQuality: finalReport.codeQualityScore,
            },
            modelName: finalReport.modelName,
            promptVersion: finalReport.promptVersion,
          },
          modelName: finalReport.modelName,
          promptVersion: finalReport.promptVersion,
        },
        update: {
          overallScore: finalReport.overallScore,
          summary: finalReport.summary,
          technicalScore: finalReport.technicalScore,
          communicationScore: finalReport.communicationScore,
          problemSolvingScore: finalReport.problemSolvingScore,
          codeQualityScore: finalReport.codeQualityScore ?? null,
          strengths: finalReport.strengths,
          weaknesses: finalReport.weaknesses,
          recommendations: finalReport.recommendations,
          modelName: finalReport.modelName,
          promptVersion: finalReport.promptVersion,
        },
      }),
      db.interview.update({
        where: { id: interviewId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          totalScore: finalReport.overallScore,
          reportStatus: "READY",
        },
      }),
      db.interviewInvitation.updateMany({
        where: { interviewId },
        data: {
          status: "COMPLETED",
        },
      }),
    ]);

    logger.info({ event: "job_report_persisted", interviewId, overallScore: finalReport.overallScore });

    // 4. Send Recruiter and Candidate Email Notifications
    const candidateEmail = interview.user.email;
    const candidateName = interview.user.name || "Candidate";
    const recruiterEmail = interview.invitations[0]?.invitedBy?.email || process.env.RECRUITER_NOTIFICATION_EMAIL;

    await sendCandidateCompletionEmail({
      candidateName,
      candidateEmail,
      jobRole: interview.jobRole,
    }).catch((e) => logger.warn({ event: "email_candidate_fail", error: e.message }));

    if (recruiterEmail) {
      await sendRecruiterCompletionEmail({
        interviewId,
        candidateName,
        candidateEmail,
        jobRole: interview.jobRole,
        overallScore: finalReport.overallScore,
        recruiterEmail,
      }).catch((e) => logger.warn({ event: "email_recruiter_fail", error: e.message }));
    }

    return { success: true, overallScore: finalReport.overallScore };
  } catch (err: any) {
    logger.error({ event: "job_report_failed", interviewId, error: err.message });
    await db.interview.update({
      where: { id: interviewId },
      data: { reportStatus: "FAILED" },
    }).catch(() => {});
    throw err;
  }
}

/**
 * Enqueues an interview completion job onto BullMQ with exponential backoff and retries,
 * falling back to non-blocking setImmediate if Redis is unavailable.
 */
export async function enqueueReportGeneration(interviewId: string) {
  if (reportQueue && redisConnection && redisConnection.status === "ready") {
    try {
      await reportQueue.add(
        "generate-report",
        { interviewId },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      return;
    } catch (e: any) {
      logger.warn({ event: "redis_enqueue_failed_falling_back_to_async", error: e.message });
    }
  }

  // Resilient non-blocking fallback
  setImmediate(async () => {
    try {
      await processInterviewCompletion(interviewId);
    } catch (err: any) {
      logger.error({ event: "async_completion_error", interviewId, error: err.message });
    }
  });
}
