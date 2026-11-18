import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  browser: {
    asObject: true,
  },
  base: {
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Creates a scoped logger with a unique request ID and contextual metadata.
 */
export function createScopedLogger(requestId: string, context?: Record<string, any>) {
  return logger.child({
    requestId,
    ...context,
  });
}

/**
 * Logs LLM telemetry including latency, token usage, and estimated cost.
 */
export function logLLMTelemetry(params: {
  action: string;
  model: string;
  promptVersion?: string;
  durationMs: number;
  tokens: { prompt: number; completion: number; total: number };
  estimatedCost: number;
  success: boolean;
  error?: string;
}) {
  logger.info({
    event: "llm_call",
    ...params,
  });
}
