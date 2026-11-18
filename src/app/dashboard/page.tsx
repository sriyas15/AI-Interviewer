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
  Mail,
  Clock,
  CheckCircle2,
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

  const candidateEmail = (session.user.email || "").toLowerCase().trim();

  // Candidate-safe query: sessions, user profile, and candidate invitations
  const [interviews, user, invitations] = await Promise.all([
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
    candidateEmail
      ? db.interviewInvitation.findMany({
          where: {
            candidateEmail: {
              equals: candidateEmail,
              mode: "insensitive",
            },
          },
          include: {
            template: {
              select: { title: true, duration: true, questionCount: true },
            },
            interview: {
              select: { id: true, status: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
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
          {isAdmin ? (
            <Link href="/interview/new" className="btn btn-primary">
              <Plus size={18} />
              <span>New Interview</span>
            </Link>
          ) : (
            <Link href="/practice" className="btn btn-secondary">
              <BrainCircuit size={18} className="text-[var(--color-primary)]" />
              <span>Practice Mode</span>
            </Link>
          )}
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

        {/* ─── Candidate Assessment Invitations List ─── */}
        <div className="dashboard-section">
          <div className="section-header">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-primary)]" />
              <h2 className="section-title-sm">Assessment Invitations</h2>
            </div>
            {invitations.length > 0 && (
              <span className="badge badge-primary">{invitations.length} invite(s)</span>
            )}
          </div>

          {invitations.length === 0 ? (
            <div className="card p-5 border border-[var(--surface-border)] rounded-xl text-center text-xs text-[var(--text-secondary)]">
              No pending assessment invitations found for your verified email ({candidateEmail || "your account"}).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitations.map((inv) => {
                const isExpired =
                  inv.status === "EXPIRED" ||
                  (inv.status === "INVITED" && new Date() > new Date(inv.expiresAt));
                const isStarted = inv.status === "STARTED";
                const isCompleted = inv.status === "COMPLETED";

                return (
                  <div
                    key={inv.id}
                    className="card p-5 border border-[var(--surface-border)] rounded-xl flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">
                          {inv.template?.title || `${inv.jobRole} Assessment`}
                        </span>
                        <span
                          className={`badge text-[10px] ${
                            isCompleted
                              ? "badge-success"
                              : isStarted
                              ? "badge-warning"
                              : isExpired
                              ? "badge-error"
                              : "badge-primary"
                          }`}
                        >
                          {isCompleted
                            ? "Completed"
                            : isStarted
                            ? "In Progress"
                            : isExpired
                            ? "Expired"
                            : "Invited"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {inv.template?.duration || 30} mins
                        </span>
                        <span>•</span>
                        <span className="capitalize">{inv.difficulty.toLowerCase()} Level</span>
                      </div>

                      <div className="text-[11px] text-[var(--text-tertiary)] mt-2">
                        {isExpired
                          ? `Expired on ${new Date(inv.expiresAt).toLocaleDateString()}`
                          : `Expires on ${new Date(inv.expiresAt).toLocaleDateString()} at ${new Date(inv.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--surface-border)] flex items-center justify-end">
                      {isCompleted && inv.interviewId ? (
                        <Link
                          href={`/interview/${inv.interviewId}/report`}
                          className="btn btn-secondary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <span>View Submission</span>
                          <ArrowRight size={13} />
                        </Link>
                      ) : isStarted && inv.interviewId ? (
                        <Link
                          href={inv.interview?.status === "PENDING" ? `/interview/${inv.interviewId}/start` : `/interview/${inv.interviewId}`}
                          className="btn btn-primary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <span>{inv.interview?.status === "PENDING" ? "Enter Lobby" : "Resume Interview"}</span>
                          <ArrowRight size={13} />
                        </Link>
                      ) : !isExpired ? (
                        <Link
                          href={`/invite/${inv.token}`}
                          className="btn btn-primary btn-sm text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                          <span>Start Assessment</span>
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="btn btn-secondary btn-sm text-xs py-1.5 px-3 opacity-50 cursor-not-allowed"
                        >
                          Link Expired
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Interview History ─── */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title-sm">Interview Sessions</h2>
            {totalInterviews > 0 && (
              <span className="badge badge-muted">{totalInterviews} total</span>
            )}
          </div>

          {totalInterviews === 0 ? (
            <EmptyState isAdmin={isAdmin} />
          ) : (
            <InterviewList interviews={interviews} />
          )}
        </div>
      </div>
    </div>
  );
}
