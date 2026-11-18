import Redis from "ioredis";

/**
 * Distributed rate limiter with Redis backend and in-memory fallback.
 * Uses atomic multi-INCR and TTL for distributed deployments.
 */
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryMap = new Map<string, RateLimitRecord>();

let redisClient: Redis | null = null;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    retryStrategy: (times) => (times > 2 ? null : 200),
  });
  redisClient.on("error", () => {});
} catch {
  redisClient = null;
}

// Periodic cleanup for in-memory fallback
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryMap.entries()) {
      if (now > record.resetAt) {
        memoryMap.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function rateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60000 }
): Promise<RateLimitResult> {
  const { limit, windowMs } = options;
  const key = `ratelimit:${identifier}`;

  // 1. Redis Distributed Limiting
  if (redisClient && redisClient.status === "ready") {
    try {
      const windowSec = Math.ceil(windowMs / 1000);
      const multi = redisClient.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();

      if (results && results[0] && results[1]) {
        const count = Number(results[0][1]);
        let ttl = Number(results[1][1]);

        if (ttl === -1 || ttl <= 0) {
          await redisClient.expire(key, windowSec);
          ttl = windowSec;
        }

        const remaining = Math.max(0, limit - count);
        return {
          success: count <= limit,
          remaining,
          reset: ttl > 0 ? ttl : windowSec,
        };
      }
    } catch {
      // Fall through to memoryMap fallback
    }
  }

  // 2. In-Memory Resilient Fallback
  const now = Date.now();
  const record = memoryMap.get(identifier);

  if (!record || now > record.resetAt) {
    memoryMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: limit - 1,
      reset: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: limit - record.count,
    reset: Math.ceil((record.resetAt - now) / 1000),
  };
}
