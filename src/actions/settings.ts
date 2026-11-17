"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface DataDeletionResult {
  success: boolean;
  error?: string;
}

export async function requestDataDeletionAction(
  reason?: string
): Promise<DataDeletionResult> {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    // Check if an existing pending deletion request exists
    const existing = await db.dataDeletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
      },
    });

    if (existing) {
      return {
        success: false,
        error: "A data deletion request is already pending for your account.",
      };
    }

    await db.dataDeletionRequest.create({
      data: {
        userId: session.user.id,
        userEmail: session.user.email.toLowerCase().trim(),
        reason: reason?.trim() || "Candidate requested full account & interview data erasure under GDPR/CCPA.",
        status: "PENDING",
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("requestDataDeletionAction error:", error);
    return {
      success: false,
      error: "Failed to submit data deletion request. Please try again.",
    };
  }
}
