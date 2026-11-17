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

    // 6. ATOMIC CLAIM: Conditional update ensures single-use even if clicked multiple times concurrently
    const claimResult = await db.interviewInvitation.updateMany({
      where: {
        token,
        status: InvitationStatus.INVITED,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: InvitationStatus.STARTED,
      },
    });

    if (claimResult.count === 0) {
      // Re-check if it was claimed by concurrent request of the same candidate
      const currentInv = await db.interviewInvitation.findUnique({
        where: { token },
      });
      if (currentInv?.status === InvitationStatus.STARTED && currentInv.interviewId) {
        return { success: true, interviewId: currentInv.interviewId };
      }
      return {
        success: false,
        error: "This invitation is no longer available or was already started.",
      };
    }

    // 7. Questions setup: Curated Bank questions or default curriculum
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
      // Standard curriculum
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

    // 8. Create the Interview session with PENDING status (ready for Lobby check)
    const interview = await db.interview.create({
      data: {
        userId: session.user.id,
        title: invitation.template?.title || `${invitation.jobRole} Assessment`,
        jobRole: invitation.jobRole,
        difficulty: invitation.difficulty,
        topics: [invitation.jobRole, "Core Competencies", "Problem Solving"],
        status: InterviewStatus.PENDING,
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

    // 9. Associate the interviewId with the invitation
    await db.interviewInvitation.update({
      where: { token },
      data: {
        interviewId: interview.id,
      },
    });

    return { success: true, interviewId: interview.id };
  } catch (error: any) {
    console.error("startInvitedInterviewAction error:", error);
    return {
      success: false,
      error: error.message || "Failed to initialize interview assessment.",
    };
  }
}
