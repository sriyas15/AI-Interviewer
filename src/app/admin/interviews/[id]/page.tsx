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
  Sparkles,
  Printer,
  Download,
} from "lucide-react";
import { ProfileDropdown } from "@/components/auth/profile-dropdown";
import { RecruiterDecisionCard } from "@/components/admin/recruiter-decision-card";

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
      auditLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  if (!interview) {
    notFound();
  }

  const answeredQuestions = interview.questions.filter((q) => q.response);
  const flaggedEvents = interview.activities;

  return (
    <div className="dashboard-page">
      {/* Ambient background */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-3" />
      </div>

      {/* Top Nav aligned with Dashboard */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <Link
              href="/admin"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
            >
              <ArrowLeft size={14} />
              <span>Back to Admin Workspace</span>
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
              <span>Interview Deep Dive</span>
            </div>
          </div>

          <div className="dashboard-nav-right">
            <a
              href={`/api/admin/interviews/${interview.id}/pdf`}
              download={`assessment-report-${interview.id}.html`}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
              title="Download structured evaluation report"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </a>
            <Link
              href={`/interview/${interview.id}/report`}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
            >
              <FileBarChart size={14} />
              <span>View Candidate Report</span>
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

      <main className="dashboard-body" style={{ position: "relative", zIndex: 10, gap: "2rem" }}>
        {/* ─── Candidate & Session Header Card ─── */}
        <div className="card card-glass" style={{ padding: "1.5rem" }}>
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
                  {interview.humanDecision !== "UNDECIDED" && (
                    <span
                      className={`badge ${
                        interview.humanDecision === "ADVANCE"
                          ? "badge-success"
                          : interview.humanDecision === "HOLD"
                          ? "badge-warning"
                          : "badge-error"
                      }`}
                    >
                      Decision: {interview.humanDecision}
                    </span>
                  )}
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

              {typeof (interview.humanScore ?? interview.totalScore) === "number" && (
                <div className="bg-[var(--surface-hover)] border border-[var(--surface-border)] px-4 py-2 rounded-lg text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">
                    {interview.humanScore !== null ? "Overridden Score" : "AI Score"}
                  </div>
                  <div
                    className="text-2xl font-black"
                    style={{
                      color:
                        (interview.humanScore ?? interview.totalScore!) >= 75
                          ? "var(--color-success)"
                          : (interview.humanScore ?? interview.totalScore!) >= 50
                          ? "var(--color-warning)"
                          : "var(--color-error)",
                    }}
                  >
                    {interview.humanScore ?? interview.totalScore}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Topics Chips & Version Stamp (A10) */}
          <div className="mt-5 pt-4 border-t border-[var(--surface-border)] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 font-medium">
                <Layers size={13} /> Tested Topics:
              </span>
              {interview.topics.map((t) => (
                <span key={t} className="topic-chip text-xs">
                  {t}
                </span>
              ))}
            </div>

            {/* Version Stamping (A10) */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
              <Sparkles size={12} className="text-[var(--color-primary)]" />
              <span>
                Model: <strong>{interview.report?.modelName || "Not stamped"}</strong> • Prompt: <strong>{interview.report?.promptVersion || "—"}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ─── Human Recruiter Override Control Card (A6) ─── */}
        <RecruiterDecisionCard
          interviewId={interview.id}
          currentDecision={interview.humanDecision}
          currentScore={interview.humanScore}
          currentNotes={interview.humanNotes}
          originalAiScore={interview.totalScore}
          auditLogs={interview.auditLogs}
        />

        {/* ─── Question-by-Question Deep Dive (A5) ─── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BrainCircuit size={20} className="text-[var(--color-primary)]" />
              <span>Question-by-Question Transcript &amp; Evaluation (A5)</span>
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
                            {evalData.score} / 10
                          </span>
                        </div>
                      ) : (
                        <span className="badge badge-muted text-[10px]">Unanswered</span>
                      )}
                    </div>

                    {/* Question Content */}
                    <div>
                      <h3 className="font-semibold text-sm text-[var(--text-primary)]">
                        {q.content}
                      </h3>
                      {q.context && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 bg-[var(--surface-hover)] p-2 rounded border border-[var(--surface-border)] font-mono">
                          {q.context}
                        </p>
                      )}
                    </div>

                    {/* Expected Topics */}
                    {q.expectedTopics.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                          Expected topics:
                        </span>
                        {q.expectedTopics.map((topic) => (
                          <span
                            key={topic}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--surface-border)]"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Candidate Answer Transcript */}
                    {q.response && (
                      <div className="bg-[var(--surface-hover)] border border-[var(--surface-border)] rounded-lg p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                          <span className="font-semibold text-[var(--text-secondary)]">
                            Candidate Answer Transcript:
                          </span>
                          {q.response.durationMs && (
                            <span className="flex items-center gap-1 font-mono text-[11px]">
                              <Clock size={11} />
                              {Math.round(q.response.durationMs / 1000)}s speaking time
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                          {q.response.content || "(No verbal transcript recorded)"}
                        </p>

                        {/* Code snippet if coding question */}
                        {q.response.code && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] mb-1 font-mono">
                              <span className="flex items-center gap-1">
                                <Code2 size={12} />
                                Submitted Code ({q.response.language || "javascript"}):
                              </span>
                            </div>
                            <pre className="bg-[var(--bg-primary)] border border-[var(--surface-border)] p-3 rounded text-xs font-mono overflow-x-auto text-[var(--text-primary)]">
                              <code>{q.response.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rubric Evaluation with Evidence Traceability (A5) */}
                    {evalData && (
                      <div className="border border-[var(--surface-border)] rounded-lg p-4 flex flex-col gap-3 bg-[var(--bg-secondary)]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--color-primary-light)]">
                            AI Evaluation &amp; Rubric Feedback:
                          </span>
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          {evalData.feedback}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                          {/* Strengths */}
                          {evalData.strengths.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] font-semibold text-[var(--color-success)] flex items-center gap-1">
                                <CheckCircle2 size={12} /> Strengths Demonstrated:
                              </span>
                              <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] flex flex-col gap-0.5">
                                {evalData.strengths.map((str, sIdx) => (
                                  <li key={sIdx}>{str}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Weaknesses */}
                          {evalData.weaknesses.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[11px] font-semibold text-[var(--color-error)] flex items-center gap-1">
                                <AlertTriangle size={12} /> Improvement Areas:
                              </span>
                              <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] flex flex-col gap-0.5">
                                {evalData.weaknesses.map((w, wIdx) => (
                                  <li key={wIdx}>{w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Code Specific Metrics */}
                        {(evalData.codeCorrectness !== null || evalData.codeEfficiency !== null || evalData.codeReadability !== null) && (
                          <div className="mt-2 pt-3 border-t border-[var(--surface-border)] grid grid-cols-3 gap-2 text-center text-xs font-mono">
                            <div>
                              Correctness: <strong>{evalData.codeCorrectness !== null ? `${evalData.codeCorrectness}/10` : "Not evaluated"}</strong>
                            </div>
                            <div>
                              Efficiency: <strong>{evalData.codeEfficiency !== null ? `${evalData.codeEfficiency}/10` : "Not evaluated"}</strong>
                            </div>
                            <div>
                              Readability: <strong>{evalData.codeReadability !== null ? `${evalData.codeReadability}/10` : "Not evaluated"}</strong>
                            </div>
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
              <span>Proctoring &amp; Activity Log (A5)</span>
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
