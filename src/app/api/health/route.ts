import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "connected";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    console.error("[HEALTHCHECK] Database ping failed:", error);
    dbStatus = "disconnected";
  }

  const isHealthy = dbStatus === "connected";
  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime ? Math.floor(process.uptime()) : 0,
      responseTimeMs: Date.now() - startTime,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        memory: process.memoryUsage
          ? {
              heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            }
          : undefined,
      },
    },
    { status: statusCode }
  );
}
