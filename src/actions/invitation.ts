"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { InvitationStatus, InterviewStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  // Check if an existing account exists for candidateEmail
  const existingUser = await db.user.findUnique({
    where: { email: invitation.candidateEmail.toLowerCase().trim() },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  return {
    invitation,
    accountStatus: {
      exists: !!existingUser,
      hasPassword: !!existingUser?.passwordHash,
    },
  };
}

export interface RegisterCandidateFromInviteInput {
  token: string;
  name?: string;
  password: string;
  confirmPassword: string;
}

export async function registerCandidateFromInviteAction(
  input: RegisterCandidateFromInviteInput
) {
  try {
    const { token, name, password, confirmPassword } = input;

    if (!token) {
      return { success: false, error: "Missing invitation token." };
    }

    const invitation = await db.interviewInvitation.findUnique({
      where: { token },
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

    const normalizedEmail = invitation.candidateEmail.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return {
        success: false,
        error: "An account with this email already exists. Please sign in with your password.",
        alreadyExists: true,
      };
    }

    // Password validation
    if (!password || password.length < 8) {
      return { success: false, error: "Password must be at least 8 characters long." };
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return {
        success: false,
        error: "Password must include at least one uppercase letter, one lowercase letter, and one number.",
      };
    }

    if (password !== confirmPassword) {
      return { success: false, error: "Passwords do not match." };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const candidateName = name?.trim() || invitation.candidateName?.trim() || "Candidate";

    // Create user: emailVerified is marked because possession of the single-use invite token verifies inbox access
    await db.user.create({
      data: {
        email: normalizedEmail,
        name: candidateName,
        passwordHash,
        role: Role.CANDIDATE,
        emailVerified: new Date(),
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("registerCandidateFromInviteAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to create candidate account.",
    };
  }
}

export async function startInvitedInterviewAction(token: string) {
  try {
    const session = await auth();

    // 1. Authentication check
    if (!session?.user?.id || !session.user.email) {
      return {
        success: false,
        error: "Authentication required. Please sign in or set your password to begin.",
      };
    }

    // 2. Fetch invitation
    const invitation = await db.interviewInvitation.findUnique({
      where: { token },
      include: { template: true },
    });

    if (!invitation) {
      return { success: false, error: "Invitation not found." };
    }

    // 3. Email verification guard: Prevent signed-in users from claiming someone else's invite
    const sessionEmail = session.user.email.toLowerCase().trim();
    const candidateEmail = invitation.candidateEmail.toLowerCase().trim();

    if (sessionEmail !== candidateEmail) {
      return {
        success: false,
        error: `Account mismatch. You are signed in as ${session.user.email}, but this invitation was sent to ${invitation.candidateEmail}. Please sign out and switch accounts.`,
      };
    }

    // 4. Expiration and revocation checks
    if (invitation.status === InvitationStatus.EXPIRED || new Date() > invitation.expiresAt) {
      return { success: false, error: "This invitation link has expired." };
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return { success: false, error: "This invitation has been revoked." };
    }

    if (invitation.status === InvitationStatus.COMPLETED) {
      return { success: false, error: "This interview has already been completed." };
    }

    // 5. Re-entrancy: If already started by this candidate, return existing interviewId
    if (invitation.status === InvitationStatus.STARTED && invitation.interviewId) {
      return { success: true, interviewId: invitation.interviewId };
    }

    // 6. ATOMIC TRANSACTION: Claim invitation, select role-matched bank questions, and create interview
    const targetCount = invitation.template?.questionCount || 4;

    const result = await db.$transaction(async (tx) => {
      // Re-verify inside transaction to prevent race conditions
      const currentInv = await tx.interviewInvitation.findUnique({
        where: { token },
        include: { template: true },
      });

      if (!currentInv) {
        throw new Error("Invitation not found");
      }
      if (currentInv.status === InvitationStatus.STARTED && currentInv.interviewId) {
        return { interviewId: currentInv.interviewId };
      }
      if (currentInv.status !== InvitationStatus.INVITED || new Date() > currentInv.expiresAt) {
        throw new Error("This invitation is no longer valid or has expired.");
      }

      // 7. Questions setup: Role & difficulty filtered sampling from Bank
      let starterQuestions: Array<{
        content: string;
        type: any;
        orderIndex: number;
        expectedTopics: string[];
        hints?: string[];
        context?: string | null;
        testCases?: any;
      }> = [];

      const bankQuestions = await tx.bankQuestion.findMany({
        where: {
          OR: [
            { tags: { has: currentInv.jobRole } },
            { difficulty: currentInv.difficulty },
          ],
        },
      });

      if (bankQuestions.length > 0) {
        // Randomize questions so each candidate receives a varied assessment
        const shuffled = [...bankQuestions].sort(() => 0.5 - Math.random());
        starterQuestions = shuffled.slice(0, targetCount).map((bq, idx) => ({
          orderIndex: idx + 1,
          type: bq.type,
          content: bq.content,
          expectedTopics: bq.expectedTopics,
          hints: bq.hints && bq.hints.length > 0 ? bq.hints : [
            `Review core ${currentInv.jobRole} concepts and system constraints.`,
            `Analyze edge cases and trade-offs before finalizing your solution.`,
            `Structure your approach clearly and state any key assumptions.`
          ],
          testCases: (bq as any).testCases ?? undefined,
          context: (bq as any).context ?? null,
        }));
      }

      // If bank had fewer questions, complete with tailored curriculum
      if (starterQuestions.length === 0) {
        starterQuestions = [
          {
            orderIndex: 1,
            type: "TECHNICAL",
            content: `Explain the core architectural principles you rely on when building scalable applications in ${currentInv.jobRole}.`,
            expectedTopics: ["Architecture", "Scalability", "Best Practices"],
            hints: [
              "Consider separation of concerns, layering, and maintainability.",
              "Discuss how you handle state management, caching, or asynchronous workflows.",
              "Cite a concrete project or architecture you have designed or maintained."
            ],
          },
          {
            orderIndex: 2,
            type: "CODING",
            content: "Write a function mergeIntervals(intervals) that accepts an array of intervals [start, end] and merges all overlapping intervals.",
            context: "// Example:\n// mergeIntervals([[1,3],[2,6],[8,10],[15,18]]) => [[1,6],[8,10],[15,18]]",
            expectedTopics: ["Sorting", "Interval Merging", "O(N log N) Complexity"],
            hints: [
              "First, sort intervals by start value: intervals.sort((a,b) => a[0] - b[0]).",
              "Iterate through intervals and merge whenever current[0] <= previous[1].",
              "Update previous[1] with Math.max(previous[1], current[1])."
            ],
            testCases: [
              { input: "[[1,3],[2,6],[8,10],[15,18]]", expectedOutput: [[1,6],[8,10],[15,18]], isHidden: false, explanation: "Standard merge" },
              { input: "[[1,4],[4,5]]", expectedOutput: [[1,5]], isHidden: false, explanation: "Adjacent boundary" },
              { input: "[[1,4],[0,4]]", expectedOutput: [[0,4]], isHidden: true, explanation: "Enclosing interval" }
            ],
          },
          {
            orderIndex: 3,
            type: "BEHAVIORAL",
            content: "Describe a situation where you had a disagreement with a team member about a technical approach. How did you resolve it?",
            expectedTopics: ["Conflict Resolution", "Collaboration", "Communication"],
            hints: [
              "Frame your response using the STAR method (Situation, Task, Action, Result).",
              "Focus on objective data (benchmarks, prototypes, trade-off matrices) rather than opinions.",
              "Emphasize the positive outcome for team alignment and product delivery."
            ],
          },
        ];
      }

      // 8. Create the Interview session with PENDING status and ASSESSMENT mode
      const interview = await tx.interview.create({
        data: {
          userId: session.user.id,
          title: currentInv.template?.title || `${currentInv.jobRole} Assessment`,
          jobRole: currentInv.jobRole,
          difficulty: currentInv.difficulty,
          topics: [currentInv.jobRole, "Core Competencies", "Problem Solving"],
          status: InterviewStatus.PENDING,
          mode: "ASSESSMENT",
          templateId: currentInv.templateId || null,
          questions: {
            create: starterQuestions.map((q) => ({
              orderIndex: q.orderIndex,
              type: q.type,
              content: q.content,
              context: (q as any).context || null,
              expectedTopics: q.expectedTopics,
              hints: (q as any).hints || [],
              testCases: (q as any).testCases ?? undefined,
            })),
          },
        },
      });

      // 9. Atomically mark invitation STARTED and link interviewId
      await tx.interviewInvitation.update({
        where: { id: currentInv.id },
        data: {
          status: InvitationStatus.STARTED,
          interviewId: interview.id,
        },
      });

      return { interviewId: interview.id };
    });

    return { success: true, interviewId: result.interviewId };
  } catch (error: any) {
    console.error("startInvitedInterviewAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to initialize interview assessment.",
    };
  }
}
