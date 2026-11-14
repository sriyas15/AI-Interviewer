import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BrainCircuit } from "lucide-react";
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

  // Security check: Only the candidate who owns the interview can view the report
  if (interview.userId !== session.user.id) {
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
            Dashboard
          </Link>
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
