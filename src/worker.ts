import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { processInterviewCompletion } from "./lib/queue";
import { logger } from "./lib/logger";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

logger.info({ event: "worker_initializing", redisUrl });

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

connection.on("connect", () => {
  logger.info({ event: "worker_redis_connected", redisUrl });
});

connection.on("error", (err) => {
  logger.error({ event: "worker_redis_error", error: err.message });
});

export const interviewWorker = new Worker(
  "interview-jobs",
  async (job: Job) => {
    logger.info({
      event: "worker_job_received",
      jobId: job.id,
      jobName: job.name,
      data: job.data,
    });

    if (job.name === "generate-report") {
      const { interviewId } = job.data;
      if (!interviewId) {
        throw new Error("Missing interviewId in job data");
      }
      return await processInterviewCompletion(interviewId);
    }

    throw new Error(`Unknown job name: ${job.name}`);
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY) || 3,
  }
);

interviewWorker.on("completed", (job: Job, result: any) => {
  logger.info({
    event: "worker_job_completed",
    jobId: job.id,
    jobName: job.name,
    result,
  });
});

interviewWorker.on("failed", (job: Job | undefined, err: Error) => {
  logger.error({
    event: "worker_job_failed",
    jobId: job?.id,
    jobName: job?.name,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
});

interviewWorker.on("error", (err: Error) => {
  logger.error({
    event: "worker_internal_error",
    error: err.message,
  });
});

async function shutdown(signal: string) {
  logger.info({ event: "worker_shutdown_initiated", signal });
  try {
    await interviewWorker.close();
    await connection.quit();
    logger.info({ event: "worker_shutdown_complete" });
    process.exit(0);
  } catch (err: any) {
    logger.error({ event: "worker_shutdown_error", error: err.message });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

logger.info({ event: "worker_ready", queue: "interview-jobs" });
