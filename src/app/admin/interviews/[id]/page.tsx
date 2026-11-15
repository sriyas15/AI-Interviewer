import { getCurrentUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ArrowLeft,
  BrainCircuit,
  FileBarChart,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Layers,
  Calendar,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const instant = false;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminInterviewDeepDivePage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user || user.role !== Role.ADMIN) {
    redirect("/dashboard?error=unauthorized");
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
          image: true,
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

  const answeredQuestions = interview.questions.filter((q) => q.response);
  const flaggedEvents = interview.activities;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Ambient background */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Navigation */}
      <nav className="nav border-b border-[var(--surface-border)] sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md">
        <div className="nav-inner max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
            >
              <ArrowLeft size={14} />
              <span>Back to Admin Portal</span>
            </Link>
            <div className="h-4 w-px bg-[var(--surface-border)]" />
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)]">
              <Shield size={16} />
              <span>Interview Deep Dive</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/interview/${interview.id}/report`}
              className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs"
            >
              <FileBarChart size={14} />
              <span>View Full AI Report</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10 flex flex-col gap-8">
        {/* ─── Candidate & Session Header Card ─── */}
        <div className="card p-6 border border-[var(--surface-border)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {interview.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={interview.user.image}
                  alt={interview.user.name || "Candidate"}
                  className="w-14 h-14 rounded-full object-cover border-2 border-[var(--surface-border)]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[var(--gradient-primary)] text-white font-bold flex items-center justify-center text-lg">
                  {(interview.user.name?.[0] || interview.user.email[0]).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{interview.user.name || "Candidate"}</h1>
                  <span className="badge badge-muted text-[10px]">Candidate</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{interview.user.email}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    <span>Created: {new Date(interview.createdAt).toLocaleString()}</span>
                  </span>
                  {interview.completedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} />
                      <span>Completed: {new Date(interview.completedAt).toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Score & Badges */}
            <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
              <span
                className={`badge ${
                  interview.difficulty === "EASY"
                    ? "badge-success"
                    : interview.difficulty === "MEDIUM"
                    ? "badge-warning"
                    : "badge-error"
                }`}
              >
                {interview.difficulty}
              </span>
              <span
                className={`badge ${
                  interview.status === "COMPLETED"
                    ? "badge-success"
                    : interview.status === "IN_PROGRESS"
                    ? "badge-warning"
                    : "badge-muted"
                }`}
              >
                {interview.status}
              </span>

              {typeof interview.totalScore === "number" && (
                <div className="bg-[var(--surface-hover)] border border-[var(--surface-border)] px-4 py-2 rounded-lg text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                    Overall Score
                  </div>
                  <div
                    className="text-2xl font-black"
                    style={{
                      color:
                        interview.totalScore >= 75
                          ? "var(--color-success)"
                          : interview.totalScore >= 50
                          ? "var(--color-warning)"
                          : "var(--color-error)",
                    }}
                  >
                    {interview.totalScore}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Topics Chips */}
          <div className="mt-5 pt-4 border-t border-[var(--surface-border)] flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 font-medium">
              <Layers size={13} /> Tested Topics:
            </span>
            {interview.topics.map((t) => (
              <span key={t} className="topic-chip text-xs">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Report Score Summary (if generated) ─── */}
        {interview.report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4 border border-[var(--surface-border)] text-center">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">
                Technical Depth
              </span>
              <div className="text-2xl font-bold mt-1 text-[var(--color-primary-light)]">
                {interview.report.technicalScore}%
              </div>
            </div>
            <div className="card p-4 border border-[var(--surface-border)] text-center">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">
                Communication
              </span>
              <div className="text-2xl font-bold mt-1 text-[var(--color-info)]">
                {interview.report.communicationScore}%
              </div>
            </div>
            <div className="card p-4 border border-[var(--surface-border)] text-center">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">
                Problem Solving
              </span>
              <div className="text-2xl font-bold mt-1 text-[var(--color-success)]">
                {interview.report.problemSolvingScore}%
              </div>
            </div>
            <div className="card p-4 border border-[var(--surface-border)] text-center">
              <span className="text-[11px] text-[var(--text-tertiary)] uppercase font-semibold">
                Code Quality
              </span>
              <div className="text-2xl font-bold mt-1 text-[var(--color-warning)]">
                {interview.report.codeQualityScore !== null
                  ? `${interview.report.codeQualityScore}%`
                  : "N/A"}
              </div>
            </div>
          </div>
        )}

        {/* ─── Question-by-Question Deep Dive ─── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BrainCircuit size={20} className="text-[var(--color-primary)]" />
              <span>Question-by-Question Transcript &amp; Evaluation</span>
            </h2>
            <span className="text-xs text-[var(--text-tertiary)]">
              {answeredQuestions.length} of {interview.questions.length} answered
            </span>
          </div>

          {interview.questions.length === 0 ? (
            <div className="card p-8 text-center text-sm text-[var(--text-tertiary)] border border-[var(--surface-border)]">
              No questions generated for this interview session.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {interview.questions.map((q, idx) => {
                const evalData = q.response?.evaluation;

                return (
                  <div
                    key={q.id}
                    className="card p-6 border border-[var(--surface-border)] flex flex-col gap-4"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-[var(--surface-hover)] border border-[var(--surface-border)] flex items-center justify-center text-xs font-mono font-bold text-[var(--color-primary-light)]">
                          {idx + 1}
                        </span>
                        <span className="badge badge-primary text-[10px] font-mono">
                          {q.type}
                        </span>
                      </div>

                      {evalData ? (
                        <div className="flex items-center gap-2 bg-[var(--surface-hover)] border border-[var(--surface-border)] px-3 py-1 rounded-full text-xs font-semibold">
                          <span className="text-[var(--text-tertiary)]">Score:</span>
                          <span
                            style={{
                              color:
                                evalData.score >= 7.5
                                  ? "var(--color-success)"
                                  : evalData.score >= 5
                                  ? "var(--color-warning)"
                                  : "var(--color-error)",
                            }}
                          >
                            {evalData.score.toFixed(1)} / 10
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-muted text-[10px]">Unanswered</span>
                      )}
                    </div>

                    {/* Question Content */}
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                        {q.content}
                      </h3>
                      {q.expectedTopics.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                            Expected:
                          </span>
                          {q.expectedTopics.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] bg-[var(--bg-secondary)] border border-[var(--surface-border)] px-2 py-0.5 rounded text-[var(--text-secondary)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Candidate's Submitted Answer */}
                    {q.response ? (
                      <div className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-lg p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                          <span>Candidate Answer:</span>
                          {q.response.durationMs && (
                            <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
                              <Clock size={12} />
                              {Math.round(q.response.durationMs / 1000)}s
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                          {q.response.content || "No verbal response provided."}
                        </p>

                        {/* Submitted Code Block if present */}
                        {q.response.code && (
                          <div className="mt-2">
                            <div className="text-[11px] font-mono text-[var(--text-tertiary)] mb-1 flex items-center gap-1">
                              <Code2 size={12} />
                              <span>Code Submission ({q.response.language || "code"}):</span>
                            </div>
                            <pre className="p-3 bg-[var(--bg-primary)] border border-[var(--surface-border)] rounded-md font-mono text-xs overflow-x-auto text-[var(--text-primary)]">
                              <code>{q.response.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-tertiary)] italic p-3 bg-[var(--bg-secondary)]/50 rounded-md">
                        Candidate skipped or has not yet responded to this question.
                      </div>
                    )}

                    {/* AI Evaluation Breakdown */}
                    {evalData && (
                      <div className="bg-[var(--surface-hover)] border border-[var(--surface-border)] rounded-lg p-4 flex flex-col gap-3">
                        <div className="text-xs font-semibold text-[var(--color-primary-light)] uppercase tracking-wider">
                          AI Assessment &amp; Feedback
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {evalData.feedback}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                          {evalData.strengths.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-[var(--color-success)] flex items-center gap-1 mb-1">
                                <CheckCircle2 size={12} /> Strengths
                              </span>
                              <ul className="text-xs text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                                {evalData.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {evalData.weaknesses.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-[var(--color-warning)] flex items-center gap-1 mb-1">
                                <AlertTriangle size={12} /> Areas for Improvement
                              </span>
                              <ul className="text-xs text-[var(--text-secondary)] list-disc list-inside space-y-0.5">
                                {evalData.weaknesses.map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Coding Metrics if present */}
                        {(evalData.codeCorrectness !== null ||
                          evalData.codeEfficiency !== null ||
                          evalData.codeReadability !== null) && (
                          <div className="pt-2 border-t border-[var(--surface-border)] flex items-center gap-4 text-xs">
                            {evalData.codeCorrectness !== null && (
                              <span>
                                Correctness: <strong>{evalData.codeCorrectness}/10</strong>
                              </span>
                            )}
                            {evalData.codeEfficiency !== null && (
                              <span>
                                Efficiency: <strong>{evalData.codeEfficiency}/10</strong>
                              </span>
                            )}
                            {evalData.codeReadability !== null && (
                              <span>
                                Readability: <strong>{evalData.codeReadability}/10</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Proctoring & Security Incidents Timeline ─── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-[var(--color-warning)]" />
              <span>Proctoring &amp; Activity Log</span>
            </h2>
            <span className="text-xs text-[var(--text-tertiary)]">
              {flaggedEvents.length} security incident(s) logged
            </span>
          </div>

          <div className="card p-6 border border-[var(--surface-border)]">
            {flaggedEvents.length === 0 ? (
              <div className="flex items-center gap-3 text-xs text-[var(--color-success)] py-2">
                <ShieldCheck size={20} />
                <span>
                  <strong>Clean Session:</strong> No tab switches, clipboard paste events, or focus losses were logged during this interview.
                </span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--surface-border)]">
                {flaggedEvents.map((evt) => (
                  <div key={evt.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle
                        size={15}
                        className="text-[var(--color-warning)] mt-0.5 flex-shrink-0"
                      />
                      <div>
                        <span className="badge badge-warning text-[10px] uppercase font-mono mr-2">
                          {evt.type}
                        </span>
                        <span className="text-[var(--text-primary)]">
                          {evt.description || "Activity flag logged"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[var(--text-tertiary)] flex-shrink-0 font-mono text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
