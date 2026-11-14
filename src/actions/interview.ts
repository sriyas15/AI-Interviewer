"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createInterviewSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import type { CreateInterviewInput } from "@/lib/validations";

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


