import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createLiveKitToken } from "@/lib/livekit";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limiter = await rateLimit(`livekit:${session.user.id}:${ip}`, { limit: 20, windowMs: 60000 });
    if (!limiter.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait a moment." }, { status: 429 });
    }

    const { interviewId } = await req.json();
    if (!interviewId || typeof interviewId !== "string") {
      return NextResponse.json({ error: "Invalid interview ID" }, { status: 400 });
    }

    const interview = await db.interview.findUnique({
      where: { id: interviewId },
      select: { id: true, userId: true, status: true },
    });

    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (interview.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Not your interview session" }, { status: 403 });
    }

    const roomName = `interview-${interview.id}`;
    const participantIdentity = `candidate-${session.user.id}`;
    const participantName = session.user.name || "Candidate";

    const token = await createLiveKitToken({
      roomName,
      participantIdentity,
      participantName,
      isAiAgent: false,
    });

    const livekitUrl = process.env.LIVEKIT_URL || "wss://demo.livekit.cloud";

    return NextResponse.json({
      success: true,
      token,
      url: livekitUrl,
      roomName,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to issue token" }, { status: 500 });
  }
}
