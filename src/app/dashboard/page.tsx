import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { InterviewList } from "@/components/dashboard/interview-list";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";

// This page requires auth + DB — intentionally dynamic, not statically prerendered
export const instant = false;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
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
            <div className="candidate-badge">
              <LayoutDashboard size={13} />
              <span>Candidate</span>
            </div>
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
        {/* ─── Page Header ─── */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">
              Welcome back, <span className="text-gradient">{firstName}</span> 👋
            </h1>
            <p className="dashboard-subtitle">
              Track your practice sessions and keep improving your interview skills.
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
