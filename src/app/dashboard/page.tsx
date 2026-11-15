import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Plus,
  LayoutDashboard,
  Shield,
  ArrowRight,
} from "lucide-react";
import { InterviewList } from "@/components/dashboard/interview-list";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";

// This page requires auth + DB — intentionally dynamic, not statically prerendered
export const instant = false;

interface DashboardPageProps {
  searchParams?: Promise<{ view?: string }>;
}

export default async function DashboardPage(props: DashboardPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const isAdmin = session.user.role === "ADMIN";

  // Admins land on the Admin Workspace by default unless intentionally in preview mode
  if (isAdmin && searchParams?.view !== "candidate") {
    redirect("/admin");
  }

  // Candidate-safe query: no scores, evaluations, or reports
  const [interviews, user] = await Promise.all([
    db.interview.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        title: true,
        jobRole: true,
        difficulty: true,
        topics: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true },
    }),
  ]);

  const totalInterviews = interviews.length;
  const completedInterviews = interviews.filter((i) => i.status === "COMPLETED").length;
  const inProgressInterviews = interviews.filter((i) => i.status === "IN_PROGRESS").length;
  const pendingInterviews = interviews.filter((i) => i.status === "PENDING").length;

  const displayName = user?.name || session.user.name || "Candidate";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="dashboard-page">
      {/* ─── Top Nav ─── */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <Link href="/" className="nav-brand">
            <BrainCircuit size={24} strokeWidth={1.5} />
            <span>AI Interviewer</span>
          </Link>
          <div className="dashboard-nav-right">
            {isAdmin ? (
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
                <span>Admin</span>
              </div>
            ) : (
              <div className="candidate-badge">
                <LayoutDashboard size={13} />
                <span>Candidate</span>
              </div>
            )}
            <ProfileDropdown
              user={{
                name: displayName,
                email: user?.email || session.user.email || "",
                image: user?.image,
                role: session.user.role,
              }}
            />
          </div>
        </div>
      </nav>

      <div className="dashboard-body">
        {/* ─── Admin Preview Notification Banner (Visible only to Admins previewing Candidate UI) ─── */}
        {isAdmin && (
          <div
            style={{
              marginBottom: "1.5rem",
              padding: "1rem 1.25rem",
              borderRadius: "0.75rem",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <Shield size={18} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <span style={{ fontSize: "0.875rem", color: "#fef3c7" }}>
                <strong>Admin Preview Mode:</strong> You are viewing the candidate practice view. Numerical scores and evaluation deep-dives are intentionally hidden here.
              </span>
            </div>
            <Link
              href="/admin"
              className="btn btn-sm"
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.2)",
                color: "#fef3c7",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
              }}
            >
              <span>Return to Admin Workspace</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {/* ─── Page Header ─── */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              Welcome back, <span className="text-gradient">{firstName}</span> 👋
            </h1>
            <p className="dashboard-subtitle">
              {isAdmin
                ? "Candidate view simulation — test questions and practice interviews."
                : "Track your practice sessions and keep improving your interview skills."}
            </p>
          </div>
          <Link href="/interview/new" className="btn btn-primary">
            <Plus size={18} />
            <span>New Interview</span>
          </Link>
        </div>

        {/* ─── Stats Grid ─── */}
        <StatsGrid
          stats={[
            {
              label: "Total Sessions",
              value: totalInterviews,
              iconType: "book",
              color: "primary",
            },
            {
              label: "Completed",
              value: completedInterviews,
              iconType: "check",
              color: "success",
            },
            {
              label: "In Progress",
              value: inProgressInterviews,
              iconType: "clock",
              color: "warning",
            },
            {
              label: "Pending",
              value: pendingInterviews,
              iconType: "list",
              color: "muted",
            },
          ]}
        />

        {/* ─── Interview History ─── */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title-sm">Interview Sessions</h2>
            {totalInterviews > 0 && (
              <span className="badge badge-muted">{totalInterviews} total</span>
            )}
          </div>

          {totalInterviews === 0 ? (
            <EmptyState />
          ) : (
            <InterviewList interviews={interviews} />
          )}
        </div>
      </div>
    </div>
  );
}
