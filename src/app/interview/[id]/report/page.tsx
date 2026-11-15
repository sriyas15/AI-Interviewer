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
} from "lucide-react";
import { InterviewReportView } from "@/components/interview/interview-report-view";
import { generateFinalInterviewReport } from "@/lib/ai/service";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewReportPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;

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

  let report = interview.report;

  // If session has no report yet, compile it now
  if (!report) {
    const questionsWithResponses = interview.questions;
    if (questionsWithResponses.length === 0) {
      redirect(`/interview/${id}`);
    }

    const compiled = await generateFinalInterviewReport({
      interview: {
        jobRole: interview.jobRole,
        difficulty: interview.difficulty,
        topics: interview.topics,
      },
      questionsWithResponses: questionsWithResponses.map((q) => ({
        content: q.content,
        type: q.type,
        response: q.response
          ? {
              content: q.response.content,
              code: q.response.code,
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
      })),
    });

    report = await db.report.create({
      data: {
        interviewId: interview.id,
        overallScore: compiled.overallScore,
        summary: compiled.summary,
        technicalScore: compiled.technicalScore,
        communicationScore: compiled.communicationScore,
        problemSolvingScore: compiled.problemSolvingScore,
        codeQualityScore: compiled.codeQualityScore ?? null,
        strengths: compiled.strengths,
        weaknesses: compiled.weaknesses,
        recommendations: compiled.recommendations,
        detailedFeedback: compiled as unknown as object,
      },
    });

    await db.interview.update({
      where: { id: interview.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalScore: compiled.overallScore,
      },
    });
  }

  // ─── CANDIDATE VIEW: Score-blind submission confirmation ───
  if (!isAdmin) {
    return (
      <div className="setup-page">
        {/* Top Nav */}
        <nav className="dashboard-nav no-print">
          <div className="dashboard-nav-inner">
            <Link href="/" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </nav>

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
              Your responses, code submissions, and proctoring activity have been recorded and delivered to the recruitment administration team.
            </div>

            <Link href="/dashboard" className="btn btn-primary" style={{ width: "100%", padding: "0.75rem" }}>
              <span>Return to Candidate Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── ADMIN VIEW: Full AI Evaluation Report with Admin Controls ───
  return (
    <div className="setup-page">
      {/* Top Nav with Admin Bar */}
      <nav className="dashboard-nav no-print">
        <div className="dashboard-nav-inner max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="nav-brand">
              <BrainCircuit size={24} strokeWidth={1.5} />
              <span>AI Interviewer</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <Link
              href={`/admin/interviews/${interview.id}`}
              className="btn btn-ghost btn-sm text-xs text-[var(--text-secondary)] flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              <span>Deep Dive Transcript</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[var(--color-warning-subtle)] border border-[rgba(255,170,0,0.3)] px-3 py-1 rounded-full text-xs text-[var(--color-warning)] font-medium">
              <Shield size={14} />
              <span>Admin Report View: {interview.user.name || interview.user.email}</span>
            </div>
            <Link href="/admin" className="btn btn-secondary btn-sm text-xs">
              Admin Portal
            </Link>
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
