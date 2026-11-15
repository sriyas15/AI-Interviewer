"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { InvitationStatus, InterviewStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";

export async function getInvitationData(token: string) {
  const invitation = await db.interviewInvitation.findUnique({
    where: { token },
    include: {
      template: true,
      invitedBy: {
        select: { name: true, email: true },
      },
    },
  });

  if (!invitation) {
    return { error: "INVITATION_NOT_FOUND" };
  }

  // Check if expired
  if (invitation.status === InvitationStatus.INVITED && new Date() > invitation.expiresAt) {
    await db.interviewInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.EXPIRED },
    });
    return { error: "INVITATION_EXPIRED", invitation };
  }

  return { invitation };
}

export async function startInvitedInterviewAction(token: string) {
  const session = await auth();

  const invitation = await db.interviewInvitation.findUnique({
    where: { token },
    include: { template: true },
  });

  if (!invitation) {
    return { success: false, error: "Invitation not found." };
  }

  if (invitation.status === InvitationStatus.EXPIRED || new Date() > invitation.expiresAt) {
    return { success: false, error: "This invitation link has expired." };
  }

  if (invitation.status === InvitationStatus.REVOKED) {
    return { success: false, error: "This invitation has been revoked." };
  }

  if (invitation.status === InvitationStatus.COMPLETED) {
    return { success: false, error: "This interview has already been completed." };
  }

  // If already started and has interviewId, redirect directly
  if (invitation.status === InvitationStatus.STARTED && invitation.interviewId) {
    return { success: true, interviewId: invitation.interviewId };
  }

  // Determine user ID
  let userId = session?.user?.id;

  // If candidate is not signed in, look up or create an account matching invitation.candidateEmail
  if (!userId) {
    let candidateUser = await db.user.findUnique({
      where: { email: invitation.candidateEmail.toLowerCase().trim() },
    });

    if (!candidateUser) {
      candidateUser = await db.user.create({
        data: {
          email: invitation.candidateEmail.toLowerCase().trim(),
          name: invitation.candidateName || "Candidate",
          role: Role.CANDIDATE,
          emailVerified: new Date(),
        },
      });
    }

    userId = candidateUser.id;
  }

  // Fetch bank questions if template exists or fallback to standard topics
  let starterQuestions: Array<{
    content: string;
    type: any;
    orderIndex: number;
    expectedTopics: string[];
  }> = [];

  const bankQuestions = await db.bankQuestion.findMany({
    take: invitation.template?.questionCount || 4,
    orderBy: { createdAt: "asc" },
  });

  if (bankQuestions.length > 0) {
    starterQuestions = bankQuestions.map((bq, idx) => ({
      orderIndex: idx + 1,
      type: bq.type,
      content: bq.content,
      expectedTopics: bq.expectedTopics,
    }));
  } else {
    // Default curriculum
    starterQuestions = [
      {
        orderIndex: 1,
        type: "TECHNICAL",
        content: `Explain the core architectural principles you rely on when building scalable applications in ${invitation.jobRole}.`,
        expectedTopics: ["Architecture", "Scalability", "Best Practices"],
      },
      {
        orderIndex: 2,
        type: "CODING",
        content: "Write a function that debounces asynchronous operations and handles cancellations gracefully.",
        expectedTopics: ["Debounce", "Closures", "Async/Await"],
      },
      {
        orderIndex: 3,
        type: "BEHAVIORAL",
        content: "Describe a situation where you had a disagreement with a team member about a technical approach. How did you resolve it?",
        expectedTopics: ["Conflict Resolution", "Collaboration", "Communication"],
      },
    ];
  }

  // Create the tailored Interview session
  const interview = await db.interview.create({
    data: {
      userId,
      title: invitation.template?.title || `${invitation.jobRole} Assessment`,
      jobRole: invitation.jobRole,
      difficulty: invitation.difficulty,
      topics: [invitation.jobRole, "Core Competencies", "Problem Solving"],
      status: InterviewStatus.IN_PROGRESS,
      startedAt: new Date(),
      templateId: invitation.templateId || null,
      questions: {
        create: starterQuestions.map((q) => ({
          orderIndex: q.orderIndex,
          type: q.type,
          content: q.content,
          expectedTopics: q.expectedTopics,
        })),
      },
    },
  });

  // Link invitation to the newly created interview
  await db.interviewInvitation.update({
    where: { id: invitation.id },
    data: {
      status: InvitationStatus.STARTED,
      interviewId: interview.id,
    },
  });

  return { success: true, interviewId: interview.id };
}

