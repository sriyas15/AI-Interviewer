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
