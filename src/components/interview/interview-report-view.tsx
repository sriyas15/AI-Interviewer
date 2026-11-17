"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BrainCircuit,
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  Code2,
} from "lucide-react";

interface EvaluationData {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

interface QuestionResponseData {
  id: string;
  orderIndex: number;
  type: string;
  content: string;
  context: string | null;
  expectedTopics: string[];
  response: {
    content: string;
    code: string | null;
    language: string | null;
    durationMs: number | null;
    evaluation: EvaluationData | null;
  } | null;
}

interface ActivityEventData {
  id: string;
  type: string;
  description: string | null;
  timestamp: string | Date;
}

interface ReportData {
  overallScore: number;
  summary: string;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  codeQualityScore: number | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface InterviewReportViewProps {
  interview: {
    id: string;
    title: string;
    jobRole: string;
    difficulty: string;
    topics: string[];
    createdAt: string | Date;
    completedAt: string | Date | null;
  };
  report: ReportData;
  questions: QuestionResponseData[];
  activities: ActivityEventData[];
}

export function InterviewReportView({
  interview,
  report,
  questions,
  activities,
}: InterviewReportViewProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({
    [questions[0]?.id || ""]: true,
  });

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getTier = (score: number) => {
    if (score >= 85) return { label: "Strong Candidate", color: "var(--color-success)", bg: "var(--color-success-subtle)" };
    if (score >= 70) return { label: "Solid Foundation", color: "var(--color-primary)", bg: "var(--color-primary-subtle)" };
    if (score >= 55) return { label: "Developing Candidate", color: "var(--color-warning)", bg: "var(--color-warning-subtle)" };
    return { label: "Needs More Preparation", color: "var(--color-error)", bg: "var(--color-error-subtle)" };
  };

  const tier = getTier(report.overallScore);

  const printReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto py-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print">
        <Link href="/dashboard" className="btn btn-ghost btn-sm text-xs">
          &larr; Back to Dashboard
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={printReport}
            className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
          >
            <Printer size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Score & Executive Summary Card */}
      <div className="card-glass p-8 rounded-2xl border border-[var(--surface-border)] shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Big Score Gauge (4 cols) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[var(--surface)] border border-[var(--surface-border)]">
            <span className="text-xs uppercase font-semibold tracking-wider text-[var(--text-tertiary)] mb-2">
              Overall Performance
            </span>

            <div className="relative w-36 h-36 flex items-center justify-center my-2">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="var(--bg-tertiary)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="transparent"
                  stroke="var(--color-primary)"
                  strokeWidth="8"
                  strokeDasharray="264"
                  strokeDashoffset={264 - (264 * report.overallScore) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold tracking-tight">{report.overallScore}</span>
                <span className="text-[11px] text-[var(--text-tertiary)] font-medium">out of 100</span>
              </div>
            </div>

            <span
              className="mt-2 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: tier.bg, color: tier.color }}
            >
              {tier.label}
            </span>
          </div>

          {/* Executive Summary (8 cols) */}
          <div className="md:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--surface-border)]">
                {interview.jobRole}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                {interview.difficulty} Tier
              </span>
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock size={12} />
                Completed on {new Date(interview.completedAt || Date.now()).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {interview.title} &mdash; Final Evaluation
            </h1>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {report.summary}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {interview.topics.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--surface-border)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Technical */}
        <div className="card p-5 border border-[var(--surface-border)] rounded-xl space-y-2">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Technical Depth</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--color-primary)]">{report.technicalScore}</span>
            <span className="text-xs text-[var(--text-tertiary)]">/ 100</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)]"
              style={{ width: `${report.technicalScore}%` }}
            />
          </div>
        </div>

        {/* Communication */}
        <div className="card p-5 border border-[var(--surface-border)] rounded-xl space-y-2">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Communication Clarity</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--color-success)]">{report.communicationScore}</span>
            <span className="text-xs text-[var(--text-tertiary)]">/ 100</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-success)]"
              style={{ width: `${report.communicationScore}%` }}
            />
          </div>
        </div>

        {/* Problem Solving */}
        <div className="card p-5 border border-[var(--surface-border)] rounded-xl space-y-2">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Problem Solving</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--color-warning)]">{report.problemSolvingScore}</span>
            <span className="text-xs text-[var(--text-tertiary)]">/ 100</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-warning)]"
              style={{ width: `${report.problemSolvingScore}%` }}
            />
          </div>
        </div>

        {/* Code Quality */}
        <div className="card p-5 border border-[var(--surface-border)] rounded-xl space-y-2">
          <span className="text-xs text-[var(--text-secondary)] font-medium">Code Quality</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--color-info)]">
              {report.codeQualityScore ?? 80}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">/ 100</span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-info)]"
              style={{ width: `${report.codeQualityScore ?? 80}%` }}
            />
          </div>
        </div>
      </div>

      {/* Strengths, Weaknesses, Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Strengths */}
        <div className="card p-6 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-[var(--color-success)] font-bold text-sm">
            <CheckCircle2 size={16} />
            <span>Demonstrated Strengths</span>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {report.strengths.map((str, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[var(--color-success)] shrink-0">•</span>
                <span>{str}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="card p-6 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-[var(--color-warning)] font-bold text-sm">
            <AlertTriangle size={16} />
            <span>Areas for Improvement</span>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {report.weaknesses.map((weak, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[var(--color-warning)] shrink-0">•</span>
                <span>{weak}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="card p-6 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-[var(--color-primary)] font-bold text-sm">
            <Lightbulb size={16} />
            <span>Recommended Next Steps</span>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {report.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-[var(--color-primary)] shrink-0">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Detailed Question & Answer Audit ({questions.length} Questions)
        </h2>

        <div className="space-y-3">
          {questions.map((q, idx) => {
            const isExpanded = expandedQuestions[q.id];
            const evalData = q.response?.evaluation;

            return (
              <div
                key={q.id}
                className="card p-0 border border-[var(--surface-border)] rounded-xl overflow-hidden bg-[var(--surface)] transition-all"
              >
                {/* Header Toggle */}
                <button
                  type="button"
                  onClick={() => toggleQuestion(q.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3 pr-4">
                    <span className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] text-[var(--color-primary)] font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">
                          {q.type}
                        </span>
                      </div>
                      <p className="font-semibold text-xs text-[var(--text-primary)] line-clamp-1">
                        {q.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {evalData && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
                        {evalData.score.toFixed(1)} / 10
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-[var(--surface-border)] space-y-4 mt-2 text-xs">
                    {/* Full Question Text */}
                    <div className="p-3 rounded-lg bg-[var(--bg-secondary)] space-y-1">
                      <span className="font-semibold text-[var(--text-secondary)] block">Prompt:</span>
                      <p className="text-[var(--text-primary)] leading-relaxed">{q.content}</p>
                      {q.context && (
                        <pre className="mt-2 p-2 rounded bg-[var(--bg-primary)] text-[var(--text-tertiary)] font-mono text-[11px] whitespace-pre-wrap">
                          {q.context}
                        </pre>
                      )}
                    </div>

                    {/* Candidate Submitted Response */}
                    <div className="space-y-1">
                      <span className="font-semibold text-[var(--text-secondary)] block">Candidate Answer:</span>
                      <p className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--surface-border)] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                        {q.response?.content || "(No response submitted)"}
                      </p>
                    </div>

                    {/* Submitted Code (if present) */}
                    {q.response?.code && (
                      <div className="space-y-1">
                        <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                          <Code2 size={13} /> Submitted Code ({q.response.language || "code"}):
                        </span>
                        <pre className="p-3 rounded-lg bg-[#0a0a12] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {q.response.code}
                        </pre>
                      </div>
                    )}

                    {/* AI Feedback */}
                    {evalData && (
                      <div className="p-3.5 rounded-xl bg-[var(--bg-tertiary)] border border-[rgba(108,92,231,0.2)] space-y-2">
                        <div className="flex items-center justify-between font-semibold text-[var(--color-primary)]">
                          <span>AI Evaluation & Critique</span>
                          <span>Score: {evalData.score.toFixed(1)} / 10</span>
                        </div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">
                          {evalData.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anti-Cheat & Proctoring Audit Timeline */}
      <div className="card p-6 border border-[var(--surface-border)] rounded-2xl space-y-3 bg-[var(--surface)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
            <ShieldCheck size={18} className="text-[var(--color-success)]" />
            <span>Anti-Cheat / Proctoring Integrity Log</span>
          </div>

          <span className="text-xs text-[var(--text-tertiary)]">
            {activities.length} Recorded Event{activities.length === 1 ? "" : "s"}
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-4 rounded-xl bg-[var(--color-success-subtle)] border border-[rgba(0,214,143,0.2)] text-xs text-[var(--color-success)] flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Clean Session &mdash; No suspicious tab-switching, blur, or clipboard incidents detected.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[var(--text-tertiary)]">
                  <th className="py-2">Event Type</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {activities.map((act) => (
                  <tr key={act.id} className="text-[var(--text-secondary)]">
                    <td className="py-2 font-mono text-[var(--color-warning)]">{act.type}</td>
                    <td className="py-2">{act.description || "Activity recorded"}</td>
                    <td className="py-2 text-[var(--text-tertiary)]">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="pt-4 flex items-center justify-start no-print">
        <Link href="/dashboard" className="btn btn-secondary">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
