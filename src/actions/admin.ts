"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  Role,
  Difficulty,
  QuestionType,
  InvitationStatus,
  CandidateDecision,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { sendInterviewInviteEmail } from "@/lib/email";

// ─────────────────────────────────────────────────────────────
// RBAC Enforcement Helper (A7: Server-side RBAC guard)
// ─────────────────────────────────────────────────────────────

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED: Authentication required.");
  }

  // Verify in database to prevent stale token bypass
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true, email: true, name: true },
  });

  if (!user || user.role !== Role.ADMIN) {
    throw new Error("FORBIDDEN: Administrative privileges required.");
  }

  if (user.isActive === false) {
    throw new Error("FORBIDDEN: This administrator account has been deactivated.");
  }

  return user;
}

// ─────────────────────────────────────────────────────────────
// A1: INTERVIEW TEMPLATES
// ─────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  title: string;
  jobRole: string;
  description?: string;
  duration?: number;
  questionCount?: number;
  difficulty?: Difficulty;
  stages?: string[];
  rubricWeights?: {
    technical?: number;
    problemSolving?: number;
    communication?: number;
    codeQuality?: number;
  };
  proctoringPolicy?: {
    tabSwitchLimit?: number;
    blockPaste?: boolean;
    fullscreenRequired?: boolean;
  };
}

export async function createTemplateAction(input: CreateTemplateInput) {
  try {
    const admin = await requireAdmin();

    if (!input.title?.trim() || !input.jobRole?.trim()) {
      return { success: false, error: "Title and Job Role are required." };
    }

    const template = await db.interviewTemplate.create({
      data: {
        title: input.title.trim(),
        jobRole: input.jobRole.trim(),
        description: input.description?.trim() || null,
        duration: input.duration || 45,
        questionCount: input.questionCount || 5,
        difficulty: input.difficulty || Difficulty.MEDIUM,
        stages: input.stages && input.stages.length > 0
          ? input.stages
          : ["SCREENING", "TECHNICAL", "CODING"],
        rubricWeights: input.rubricWeights || {
          technical: 40,
          problemSolving: 30,
          communication: 20,
          codeQuality: 10,
        },
        proctoringPolicy: input.proctoringPolicy || {
          tabSwitchLimit: 3,
          blockPaste: true,
          fullscreenRequired: true,
        },
        createdById: admin.id,
      },
    });

    revalidatePath("/admin");
    return { success: true, template };
  } catch (error: any) {
    console.error("createTemplateAction error:", error);
    return { success: false, error: error.message || "Failed to create template." };
  }
}

export async function deleteTemplateAction(templateId: string) {
  try {
    await requireAdmin();

    await db.interviewTemplate.delete({
      where: { id: templateId },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("deleteTemplateAction error:", error);
    return { success: false, error: error.message || "Failed to delete template." };
  }
}

// ─────────────────────────────────────────────────────────────
// A2: QUESTION BANK (CRUD with tags & test cases)
// ─────────────────────────────────────────────────────────────

export interface CreateBankQuestionInput {
  title: string;
  content: string;
  type: QuestionType;
  difficulty?: Difficulty;
  tags?: string[];
  expectedTopics?: string[];
  sampleCode?: string;
  starterCode?: Record<string, string>;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
    explanation?: string;
  }>;
  rubric?: Record<string, any>;
}

export async function createBankQuestionAction(input: CreateBankQuestionInput) {
  try {
    const admin = await requireAdmin();

    if (!input.title?.trim() || !input.content?.trim()) {
      return { success: false, error: "Question title and description content are required." };
    }

    const question = await db.bankQuestion.create({
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        type: input.type,
        difficulty: input.difficulty || Difficulty.MEDIUM,
        tags: input.tags || [],
        expectedTopics: input.expectedTopics || [],
        sampleCode: input.sampleCode?.trim() || null,
        starterCode: input.starterCode ?? undefined,
        testCases: input.testCases ?? undefined,
        rubric: input.rubric ?? undefined,
        createdById: admin.id,
      },
    });

    revalidatePath("/admin");
    return { success: true, question };
  } catch (error: any) {
    console.error("createBankQuestionAction error:", error);
    return { success: false, error: error.message || "Failed to create question." };
  }
}

export async function deleteBankQuestionAction(questionId: string) {
  try {
    await requireAdmin();

    await db.bankQuestion.delete({
      where: { id: questionId },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("deleteBankQuestionAction error:", error);
    return { success: false, error: error.message || "Failed to delete question." };
  }
}

// ─────────────────────────────────────────────────────────────
// A3: INVITE FLOW (Single-use expiring links)
// ─────────────────────────────────────────────────────────────

export interface CreateInvitationInput {
  candidateEmail: string;
  candidateName?: string;
  templateId?: string;
  jobRole: string;
  difficulty?: Difficulty;
  expiresInDays?: number;
}

export async function createInvitationAction(input: CreateInvitationInput) {
  try {
    const admin = await requireAdmin();

    const email = input.candidateEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { success: false, error: "A valid candidate email is required." };
    }

    const token = crypto.randomBytes(24).toString("hex");
    const days = input.expiresInDays || 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invitation = await db.interviewInvitation.create({
      data: {
        token,
        candidateEmail: email,
        candidateName: input.candidateName?.trim() || null,
        jobRole: input.jobRole.trim(),
        difficulty: input.difficulty || Difficulty.MEDIUM,
        templateId: input.templateId || null,
        expiresAt,
        invitedById: admin.id,
      },
      include: {
        template: {
          select: { title: true, duration: true },
        },
      },
    });

    const inviteLink = `${process.env.AUTH_URL || "http://localhost:3000"}/invite/${token}`;

    // Send the interview assessment invitation email via SMTP
    const emailResult = await sendInterviewInviteEmail({
      candidateEmail: email,
      candidateName: input.candidateName?.trim() || null,
      inviteLink,
      jobRole: input.jobRole.trim(),
      difficulty: input.difficulty || Difficulty.MEDIUM,
      templateTitle: invitation.template?.title || null,
      expiresInDays: days,
      inviterName: admin.name || "Recruiting Team",
    });

    revalidatePath("/admin");
    return {
      success: true,
      invitation,
      inviteLink,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    };
  } catch (error: any) {
    console.error("createInvitationAction error:", error);
    return { success: false, error: error.message || "Failed to generate invitation." };
  }
}

export async function resendInvitationEmailAction(invitationId: string) {
  try {
    const admin = await requireAdmin();

    const invitation = await db.interviewInvitation.findUnique({
      where: { id: invitationId },
      include: {
        template: {
          select: { title: true },
        },
      },
    });

    if (!invitation) {
      return { success: false, error: "Invitation record not found." };
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return { success: false, error: "Cannot resend a revoked invitation." };
    }

    const inviteLink = `${process.env.AUTH_URL || "http://localhost:3000"}/invite/${invitation.token}`;
    const daysRemaining = Math.max(
      1,
      Math.ceil((invitation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const emailResult = await sendInterviewInviteEmail({
      candidateEmail: invitation.candidateEmail,
      candidateName: invitation.candidateName,
      inviteLink,
      jobRole: invitation.jobRole,
      difficulty: invitation.difficulty,
      templateTitle: invitation.template?.title || null,
      expiresInDays: daysRemaining,
      inviterName: admin.name || "Recruiting Team",
    });

    return {
      success: true,
      emailSent: emailResult.success,
      emailError: emailResult.error,
      inviteLink,
    };
  } catch (error: any) {
    console.error("resendInvitationEmailAction error:", error);
    return { success: false, error: error.message || "Failed to resend invitation email." };
  }
}

export async function revokeInvitationAction(invitationId: string) {
  try {
    await requireAdmin();

    await db.interviewInvitation.update({
      where: { id: invitationId },
      data: { status: InvitationStatus.REVOKED },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("revokeInvitationAction error:", error);
    return { success: false, error: error.message || "Failed to revoke invitation." };
  }
}

// ─────────────────────────────────────────────────────────────
// A6: HUMAN OVERRIDE & DECISION AUDIT LOG
// ─────────────────────────────────────────────────────────────

export interface UpdateDecisionInput {
  interviewId: string;
  decision: CandidateDecision;
  humanScore?: number;
  notes?: string;
}

export async function updateCandidateDecisionAction(input: UpdateDecisionInput) {
  try {
    const admin = await requireAdmin();

    const interview = await db.interview.findUnique({
      where: { id: input.interviewId },
      select: {
        id: true,
        totalScore: true,
        humanScore: true,
        humanDecision: true,
      },
    });

    if (!interview) {
      return { success: false, error: "Interview session not found." };
    }

    const previousDecision = interview.humanDecision;
    const originalScore = interview.totalScore;
    const overrideScore =
      typeof input.humanScore === "number" ? input.humanScore : interview.humanScore;

    // Transaction: update interview and record audit log
    await db.$transaction([
      db.interview.update({
        where: { id: input.interviewId },
        data: {
          humanDecision: input.decision,
          humanScore: overrideScore,
          humanNotes: input.notes?.trim() || null,
          reviewedAt: new Date(),
          reviewedById: admin.id,
        },
      }),
      db.decisionAuditLog.create({
        data: {
          interviewId: input.interviewId,
          adminId: admin.id,
          action:
            previousDecision !== input.decision
              ? "DECISION_UPDATED"
              : overrideScore !== interview.humanScore
              ? "SCORE_OVERRIDDEN"
              : "NOTE_RECORDED",
          originalScore,
          overrideScore,
          previousDecision,
          newDecision: input.decision,
          notes: input.notes?.trim() || null,
        },
      }),
    ]);

    revalidatePath("/admin");
    revalidatePath(`/admin/interviews/${input.interviewId}`);
    return { success: true };
  } catch (error: any) {
    console.error("updateCandidateDecisionAction error:", error);
    return { success: false, error: error.message || "Failed to record human review." };
  }
}

// ─────────────────────────────────────────────────────────────
// A7: USER MANAGEMENT (Role toggling & Deactivation)
// ─────────────────────────────────────────────────────────────

export async function updateUserRoleAction(targetUserId: string, newRole: Role) {
  try {
    const admin = await requireAdmin();

    if (admin.id === targetUserId && newRole !== Role.ADMIN) {
      return { success: false, error: "You cannot revoke your own administrator status." };
    }

    await db.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("updateUserRoleAction error:", error);
    return { success: false, error: error.message || "Failed to update user role." };
  }
}

export async function toggleUserActiveAction(targetUserId: string, isActive: boolean) {
  try {
    const admin = await requireAdmin();

    if (admin.id === targetUserId && !isActive) {
      return { success: false, error: "You cannot deactivate your own administrator account." };
    }

    await db.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("toggleUserActiveAction error:", error);
    return { success: false, error: error.message || "Failed to toggle user status." };
  }
}

// ─────────────────────────────────────────────────────────────
// A11: CSV EXPORT DATA GENERATOR
// ─────────────────────────────────────────────────────────────

export async function exportCandidatePipelineCsvAction() {
  try {
    await requireAdmin();

    const interviews = await db.interview.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { activities: true, questions: true } },
      },
    });

    const header = [
      "Interview ID",
      "Candidate Name",
      "Candidate Email",
      "Target Role",
      "Difficulty",
      "Status",
      "AI Score",
      "Recruiter Decision",
      "Recruiter Score",
      "Recruiter Notes",
      "Security Flags",
      "Created Date",
      "Completed Date",
    ];

    const rows = interviews.map((i) => [
      `"${i.id}"`,
      `"${(i.user.name || "Candidate").replace(/"/g, '""')}"`,
      `"${i.user.email.replace(/"/g, '""')}"`,
      `"${i.jobRole.replace(/"/g, '""')}"`,
      `"${i.difficulty}"`,
      `"${i.status}"`,
      i.totalScore !== null ? i.totalScore : "N/A",
      `"${i.humanDecision}"`,
      i.humanScore !== null ? i.humanScore : "N/A",
      `"${(i.humanNotes || "").replace(/"/g, '""')}"`,
      i._count.activities,
      `"${new Date(i.createdAt).toISOString()}"`,
      i.completedAt ? `"${new Date(i.completedAt).toISOString()}"` : "N/A",
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return { success: true, csvContent };
  } catch (error: any) {
    console.error("exportCandidatePipelineCsvAction error:", error);
    return { success: false, error: error.message || "Failed to export CSV." };
  }
}
