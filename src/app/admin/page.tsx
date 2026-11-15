import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  Shield,
  Eye,
  BrainCircuit,
  Loader2,
} from "lucide-react";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";
import { AdminPortal } from "@/components/admin/admin-portal";

export const instant = false;

async function AdminContent() {
  const user = await getCurrentUser();

  // Enforce ADMIN role access control
  if (!user || user.role !== Role.ADMIN) {
    redirect("/dashboard?error=unauthorized");
  }

  // Fetch all recruiter data in parallel
  const [candidates, interviews, templates, bankQuestions, invitations, allUsers] = await Promise.all([
    db.user.findMany({
      where: { role: Role.CANDIDATE },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        interviews: {
          select: {
            id: true,
            status: true,
            totalScore: true,
            humanDecision: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.interview.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        jobRole: true,
        difficulty: true,
        topics: true,
        status: true,
        totalScore: true,
        humanDecision: true,
        humanScore: true,
        humanNotes: true,
        durationSeconds: true,
        tokenCount: true,
        estimatedCost: true,
        createdAt: true,
        completedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        template: {
          select: {
            id: true,
            title: true,
          },
        },
        report: {
          select: {
            overallScore: true,
            technicalScore: true,
            communicationScore: true,
            problemSolvingScore: true,
            modelName: true,
            promptVersion: true,
          },
        },
        _count: {
          select: {
            questions: true,
            activities: true,
          },
        },
      },
    }),
    db.interviewTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
        _count: {
          select: { interviews: true, invitations: true },
        },
      },
    }),
    db.bankQuestion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { name: true, email: true },
        },
      },
    }),
    db.interviewInvitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { title: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { interviews: true } },
      },
    }),
  ]);

  return (
    <div className="dashboard-page">
      {/* Ambient background glow */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Top Nav aligned with Dashboard */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <Link href="/" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <div
              style={{
                width: "1px",
                height: "18px",
                backgroundColor: "var(--surface-border)",
              }}
            />
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              <Shield size={13} />
              <span>Admin Workspace</span>
            </div>
          </div>

          <div className="dashboard-nav-right">
            <Link
              href="/dashboard?view=candidate"
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
              title="Preview candidate dashboard experience"
            >
              <Eye size={14} />
              <span>Preview Candidate View</span>
            </Link>

            <ProfileDropdown
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
              }}
              showDashboardLink={false}
            />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="dashboard-body" style={{ position: "relative", zIndex: 10 }}>
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "#f59e0b",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  border: "1px solid rgba(245, 158, 11, 0.25)",
                }}
              >
                Executive Portal
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.75rem",
                  color: "var(--color-success)",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-success)",
                    boxShadow: "0 0 8px var(--color-success)",
                  }}
                />
                Live Candidate Sync
              </span>
            </div>
            <h1 className="dashboard-title">
              Recruiter &amp; Admin <span className="text-gradient">Workspace</span>
            </h1>
            <p className="dashboard-subtitle">
              Audit candidate rosters, examine question-by-question evaluations and written code, and review proctoring telemetry.
            </p>
          </div>
        </div>

        {/* Interactive Candidate Roster, Templates, Question Bank, Pipeline & Team Portal */}
        <AdminPortal
          candidates={candidates}
          interviews={interviews}
          templates={templates}
          bankQuestions={bankQuestions}
          invitations={invitations}
          allUsers={allUsers}
        />
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div
          className="dashboard-page"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Loading Admin Intelligence Workspace...
            </span>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
