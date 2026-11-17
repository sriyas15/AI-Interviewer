import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  BrainCircuit,
  ArrowLeft,
  Shield,
  Layers,
  FileCheck,
  Eye,
  EyeOff,
  Share2,
} from "lucide-react";
import { InterviewReportView } from "@/components/interview/interview-report-view";
import { toggleReleaseFeedbackAction } from "@/actions/interview";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ preview?: string }>;
}

export default async function InterviewReportPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const queryParams = searchParams ? await searchParams : {};
  const isCandidatePreview = queryParams.preview === "candidate";

  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      report: true,
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          response: {
            include: {
              evaluation: true,
            },
          },
        },
      },
      activities: {
        orderBy: { timestamp: "asc" },
      },
    },
  });

  if (!interview) {
    notFound();
  }

  const isAdmin = session.user.role === "ADMIN";

  // Security check: Only the candidate who owns the interview (or an admin) can access this page
  if (interview.userId !== session.user.id && !isAdmin) {
    redirect("/dashboard");
  }

  const report = interview.report;
  const isFeedbackReleased = interview.feedbackReleased;

  // ─── CANDIDATE VIEW OR ADMIN PREVIEW MODE ───
  // Candidate only sees "Submitted for Review" unless recruiter has released feedback (or in admin preview)
  const shouldShowCandidateSubmittedView =
    (isAdmin && isCandidatePreview) || (!isAdmin && !isFeedbackReleased);

  if (shouldShowCandidateSubmittedView) {
    return (
      <div className="setup-page">
        {/* Top Nav */}
        <nav className="dashboard-nav no-print">
          <div className="dashboard-nav-inner">
            <Link href="/" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <Link
                  href={`/interview/${id}/report`}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                >
                  <EyeOff size={14} />
                  <span>Exit Candidate Preview</span>
                </Link>
              )}
              <Link href="/dashboard" className="btn btn-ghost btn-sm">
                <ArrowLeft size={16} />
                <span>Dashboard</span>
              </Link>
              <SignOutButton className="btn btn-ghost btn-sm text-xs text-[var(--text-tertiary)] hover:text-[var(--color-error)]" />
            </div>
          </div>
        </nav>

        {/* Admin Preview Mode Notice */}
        {isAdmin && (
          <div className="bg-amber-500/10 border-b border-amber-500/25 px-6 py-2.5 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
            <Eye size={14} />
            <span>
              <strong>Admin Preview Mode:</strong> You are viewing this page exactly as the candidate sees it. Candidate feedback is currently{" "}
              <strong>{isFeedbackReleased ? "RELEASED" : "WITHHELD (Default)"}</strong>.
            </span>
          </div>
        )}

        {/* Candidate Submission Confirmation Card */}
        <div className="setup-body" style={{ maxWidth: "680px", margin: "2rem auto" }}>
          <div className="card-glass p-8 border border-[var(--surface-border)] text-center flex flex-col items-center gap-5 animate-slide-up">
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                background: "rgba(0, 214, 143, 0.15)",
                color: "var(--color-success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileCheck size={36} />
            </div>

            <div>
              <h1 className="text-2xl font-bold">Interview Completed &amp; Submitted</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Thank you for completing your technical simulation for{" "}
                <strong className="text-[var(--text-primary)]">{interview.jobRole}</strong>.
              </p>
            </div>

            {/* Session Metadata Summary */}
            <div
              style={{
                width: "100%",
                background: "var(--bg-secondary)",
                border: "1px solid var(--surface-border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.25rem",
                textAlign: "left",
              }}
              className="flex flex-col gap-2.5 text-xs text-[var(--text-secondary)]"
            >
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className="badge badge-success">Submitted for Review</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Difficulty:</span>
                <span className="badge badge-muted">{interview.difficulty}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Questions Answered:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {interview.questions.length} question(s)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Completion Date:</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {interview.completedAt
                    ? new Date(interview.completedAt).toLocaleString()
                    : new Date().toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-[var(--surface-border)] flex items-center gap-1.5 flex-wrap">
                <Layers size={12} className="text-[var(--text-tertiary)]" />
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Topics: {interview.topics.join(", ")}
                </span>
              </div>
            </div>

            <div
              style={{
                background: "rgba(108, 92, 231, 0.08)",
                border: "1px solid rgba(108, 92, 231, 0.2)",
                borderRadius: "var(--radius-md)",
                padding: "0.75rem 1rem",
                width: "100%",
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                lineHeight: "1.5",
              }}
            >
              Your responses, code submissions, and proctoring activity have been recorded and delivered to the recruitment administration team. Detailed rubrics and scoring stay admin-only until released by your recruiter.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
              <SignOutButton className="btn btn-primary flex-1 justify-center py-2.5" />
              <Link
                href="/dashboard"
                className="btn btn-secondary flex-1 justify-center py-2.5 text-center"
              >
                <span>View Candidate Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If report hasn't finished compiling yet, display clean processing notice (does not trigger compile on GET)
  if (!report) {
    return (
      <div className="setup-page">
        <nav className="dashboard-nav">
          <div className="dashboard-nav-inner">
            <Link href="/" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
          </div>
        </nav>
        <div className="setup-body text-center py-16">
          <h2 className="text-xl font-bold">Report Synthesis In Progress</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            The interview has completed and the report is being synthesized. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  // ─── ADMIN FULL REPORT VIEW (OR CANDIDATE WITH RELEASED FEEDBACK) ───
  return (
    <div className="setup-page">
      {/* Top Nav with Admin Bar */}
      <nav className="dashboard-nav no-print">
        <div className="dashboard-nav-inner max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href={isAdmin ? "/admin" : "/dashboard"} className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <Link
              href={isAdmin ? "/admin" : "/dashboard"}
              className="btn btn-ghost btn-sm text-xs text-[var(--text-secondary)] flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              <span>{isAdmin ? "Admin Portal" : "Dashboard"}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <>
                {/* Recruiter Release Feedback Action Button */}
                <form
                  action={async () => {
                    "use server";
                    await toggleReleaseFeedbackAction(interview.id);
                  }}
                >
                  <button
                    type="submit"
                    className={`btn btn-sm text-xs flex items-center gap-1.5 ${
                      isFeedbackReleased ? "btn-success" : "btn-secondary"
                    }`}
                    title={
                      isFeedbackReleased
                        ? "Feedback is visible to candidate. Click to withhold."
                        : "Feedback is hidden from candidate. Click to release."
                    }
                  >
                    <Share2 size={13} />
                    <span>{isFeedbackReleased ? "Feedback Released" : "Release Feedback"}</span>
                  </button>
                </form>

                {/* Preview as Candidate */}
                <Link
                  href={`/interview/${id}/report?preview=candidate`}
                  className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                >
                  <Eye size={13} />
                  <span>Preview as Candidate</span>
                </Link>

                <div className="flex items-center gap-2 bg-[var(--color-warning-subtle)] border border-[rgba(255,170,0,0.3)] px-3 py-1 rounded-full text-xs text-[var(--color-warning)] font-medium">
                  <Shield size={14} />
                  <span>Admin Mode</span>
                </div>
              </>
            )}

            {!isAdmin && isFeedbackReleased && (
              <span className="badge badge-success text-xs">
                Feedback Released by Recruiter
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main Report Body */}
      <div className="setup-body" style={{ maxWidth: "1080px" }}>
        <InterviewReportView
          interview={{
            id: interview.id,
            title: interview.title,
            jobRole: interview.jobRole,
            difficulty: interview.difficulty,
            topics: interview.topics,
            createdAt: interview.createdAt,
            completedAt: interview.completedAt,
          }}
          report={{
            overallScore: report.overallScore,
            summary: report.summary,
            technicalScore: report.technicalScore,
            communicationScore: report.communicationScore,
            problemSolvingScore: report.problemSolvingScore,
            codeQualityScore: report.codeQualityScore,
            strengths: report.strengths,
            weaknesses: report.weaknesses,
            recommendations: report.recommendations,
          }}
          questions={interview.questions.map((q) => ({
            id: q.id,
            orderIndex: q.orderIndex,
            type: q.type,
            content: q.content,
            context: q.context,
            expectedTopics: q.expectedTopics,
            response: q.response
              ? {
                  content: q.response.content,
                  code: q.response.code,
                  language: q.response.language,
                  durationMs: q.response.durationMs,
                  evaluation: q.response.evaluation
                    ? {
                        score: q.response.evaluation.score,
                        feedback: q.response.evaluation.feedback,
                        strengths: q.response.evaluation.strengths,
                        weaknesses: q.response.evaluation.weaknesses,
                      }
                    : null,
                }
              : null,
          }))}
          activities={interview.activities.map((a) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            timestamp: a.timestamp,
          }))}
        />
      </div>
    </div>
  );
}
