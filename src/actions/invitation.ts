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

  // If candidate is already signed in, ensure the invited email matches
  if (session?.user?.email) {
    const sessionEmail = session.user.email.toLowerCase().trim();
    const candidateEmail = invitation.candidateEmail.toLowerCase().trim();
    if (sessionEmail !== candidateEmail) {
      return {
        success: false,
        error: `This invitation was issued to ${invitation.candidateEmail}. You are currently signed in as ${session.user.email}. Please switch accounts or log out to continue.`,
      };
    }
  }

  // If already started and has interviewId, redirect directly
  if (invitation.status === InvitationStatus.STARTED && invitation.interviewId) {
    return { success: true, interviewId: invitation.interviewId };
  }

  // Fetch bank questions filtered by role, difficulty, or tags, and randomly sample them
  const targetCount = invitation.template?.questionCount || 4;
  const roleKeywords = invitation.jobRole.toLowerCase().split(/\s+/);

  // Retrieve candidate pool of matching bank questions
  const potentialQuestions = await db.bankQuestion.findMany({
    where: {
      difficulty: invitation.difficulty,
    },
  });

  // Score & filter questions by role relevance
  const matchingQuestions = potentialQuestions.filter((q) => {
    const qText = `${q.title} ${q.content} ${q.tags.join(" ")}`.toLowerCase();
    return roleKeywords.some((keyword) => qText.includes(keyword));
  });

  // Use matching pool if sufficient, otherwise combine with general pool
  const candidatePool = matchingQuestions.length >= targetCount
    ? matchingQuestions
    : potentialQuestions.length > 0
    ? Array.from(new Set([...matchingQuestions, ...potentialQuestions]))
    : [];

  // Random sampling (Fisher-Yates shuffle) so candidates don't get the same static questions
  const shuffled = [...candidatePool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const sampledBankQuestions = shuffled.slice(0, targetCount);

  let starterQuestions: Array<{
    content: string;
    type: any;
    orderIndex: number;
    expectedTopics: string[];
    context?: string | null;
    hints: string[];
    testCases?: any;
  }> = [];

  if (sampledBankQuestions.length > 0) {
    starterQuestions = sampledBankQuestions.map((bq, idx) => ({
      orderIndex: idx + 1,
      type: bq.type,
      content: bq.content,
      context: bq.sampleCode || null,
      expectedTopics: bq.expectedTopics,
      testCases: bq.testCases ?? undefined,
      hints: bq.hints && bq.hints.length > 0
        ? bq.hints
        : [
            `Focus on core ${invitation.jobRole} requirements and constraints.`,
            `Analyze time/space complexity tradeoffs before finalizing your approach.`,
            `Walk through a concrete example with edge cases.`
          ],
    }));
  } else {
    // Role-tailored default curriculum with specific hints and test cases per question
    starterQuestions = [
      {
        orderIndex: 1,
        type: "TECHNICAL",
        content: `Explain the core architectural principles you rely on when building scalable applications in ${invitation.jobRole}.`,
        expectedTopics: ["Architecture", "Scalability", "Best Practices"],
        hints: [
          `Consider decoupling, caching strategies, and data access layers.`,
          `Address state management and latency bottlenecks in distributed environments.`,
          `Discuss fault isolation, observability, and failover mechanisms.`
        ],
      },
      {
        orderIndex: 2,
        type: "CODING",
        content: "Write a function that debounces asynchronous operations and handles cancellations gracefully.",
        expectedTopics: ["Debounce", "Closures", "Async/Await"],
        testCases: [
          { input: "100", expectedOutput: "true", isHidden: false, explanation: "Basic debounce execution" },
          { input: "50", expectedOutput: "true", isHidden: false, explanation: "Cancellation before invocation" }
        ],
        hints: [
          `Use a closure to capture and clear the active timeout timer.`,
          `Attach a .cancel() method directly onto the returned debounced function.`,
          `Properly forward arguments and preserve execution context in the trailing callback.`
        ],
      },
      {
        orderIndex: 3,
        type: "BEHAVIORAL",
        content: "Describe a situation where you had a disagreement with a team member about a technical approach. How did you resolve it?",
        expectedTopics: ["Conflict Resolution", "Collaboration", "Communication"],
        hints: [
          `Structure your answer with the STAR framework (Situation, Task, Action, Result).`,
          `Emphasize data-driven evaluation (benchmarks, RFCs) rather than personal preferences.`,
          `Highlight the long-term impact on team velocity and architecture.`
        ],
      },
    ];
  }

  // Atomically claim the invitation and initialize the interview session
  try {
    const claimResult = await db.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race conditions
      const freshInvite = await tx.interviewInvitation.findUnique({
        where: { id: invitation.id },
        include: { template: true },
      });

      if (!freshInvite) {
        throw new Error("Invitation not found.");
      }

      if (freshInvite.status === InvitationStatus.EXPIRED || new Date() > freshInvite.expiresAt) {
        throw new Error("This invitation link has expired.");
      }

      if (freshInvite.status === InvitationStatus.REVOKED) {
        throw new Error("This invitation has been revoked.");
      }

      if (freshInvite.status === InvitationStatus.COMPLETED) {
        throw new Error("This interview has already been completed.");
      }

      if (freshInvite.status === InvitationStatus.STARTED && freshInvite.interviewId) {
        return { interviewId: freshInvite.interviewId };
      }

      // Determine or create candidate user within the transaction
      let candidateUserId = session?.user?.id;
      if (!candidateUserId) {
        const candidateUser = await tx.user.upsert({
          where: { email: freshInvite.candidateEmail.toLowerCase().trim() },
          update: {},
          create: {
            email: freshInvite.candidateEmail.toLowerCase().trim(),
            name: freshInvite.candidateName || "Candidate",
            role: Role.CANDIDATE,
            emailVerified: new Date(),
            isActive: true,
          },
        });
        candidateUserId = candidateUser.id;
      }

      // Create the tailored Interview session with duration, hints, and testCases
      const interview = await tx.interview.create({
        data: {
          userId: candidateUserId,
          title: freshInvite.template?.title || `${freshInvite.jobRole} Assessment`,
          jobRole: freshInvite.jobRole,
          difficulty: freshInvite.difficulty,
          topics: [freshInvite.jobRole, "Core Competencies", "Problem Solving"],
          status: InterviewStatus.IN_PROGRESS,
          startedAt: new Date(),
          durationMinutes: freshInvite.template?.duration || 30,
          feedbackReleased: false,
          templateId: freshInvite.templateId || null,
          questions: {
            create: starterQuestions.map((q) => ({
              orderIndex: q.orderIndex,
              type: q.type,
              content: q.content,
              context: q.context || null,
              expectedTopics: q.expectedTopics,
              hints: q.hints,
              testCases: q.testCases ?? undefined,
            })),
          },
        },
      });

      // Link invitation to the newly created interview
      await tx.interviewInvitation.update({
        where: { id: freshInvite.id },
        data: {
          status: InvitationStatus.STARTED,
          interviewId: interview.id,
        },
      });

      return { interviewId: interview.id };
    });

    return { success: true, interviewId: claimResult.interviewId };
  } catch (txError: any) {
    console.error("Atomic invite claim error:", txError);
    return { success: false, error: txError.message || "Failed to initialize interview session." };
  }
}

