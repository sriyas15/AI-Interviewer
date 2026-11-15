"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  BrainCircuit,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  AlertTriangle,
  Award,
  Calendar,
} from "lucide-react";

interface CandidateData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  interviews: Array<{
    id: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    totalScore: number | null;
    createdAt: Date;
  }>;
}

interface InterviewData {
  id: string;
  title: string;
  jobRole: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  topics: string[];
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  totalScore: number | null;
  createdAt: Date;
  completedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  report: {
    overallScore: number;
  } | null;
  _count: {
    questions: number;
    activities: number;
  };
}

interface AdminPortalProps {
  candidates: CandidateData[];
  interviews: InterviewData[];
}

export function AdminPortal({ candidates, interviews }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<"candidates" | "interviews">("candidates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q) ?? false;
      const matchEmail = c.email.toLowerCase().includes(q);
      return matchName || matchEmail;
    });
  }, [candidates, searchQuery]);

  // Filtered Interviews
  const filteredInterviews = useMemo(() => {
    return interviews.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchRole = item.jobRole.toLowerCase().includes(q);
      const matchName = item.user.name?.toLowerCase().includes(q) ?? false;
      const matchEmail = item.user.email.toLowerCase().includes(q);

      const matchDifficulty =
        selectedDifficulty === "ALL" || item.difficulty === selectedDifficulty;
      const matchStatus =
        selectedStatus === "ALL" || item.status === selectedStatus;

      return (matchRole || matchName || matchEmail) && matchDifficulty && matchStatus;
    });
  }, [interviews, searchQuery, selectedDifficulty, selectedStatus]);

  // Key platform metrics
  const totalCompleted = interviews.filter((i) => i.status === "COMPLETED").length;
  const scoredInterviews = interviews.filter((i) => typeof i.totalScore === "number");
  const averageScore = scoredInterviews.length
    ? Math.round(
        (scoredInterviews.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) /
          scoredInterviews.length) *
          10
      ) / 10
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ─── Metrics Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border border-[var(--surface-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
              Registered Candidates
            </span>
            <Users size={18} className="text-[var(--color-primary)]" />
          </div>
          <div className="text-2xl font-bold">{candidates.length}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            {candidates.filter((c) => c.emailVerified).length} verified accounts
          </div>
        </div>

        <div className="card p-5 border border-[var(--surface-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
              Total Interviews
            </span>
            <BrainCircuit size={18} className="text-[var(--color-info)]" />
          </div>
          <div className="text-2xl font-bold">{interviews.length}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            {totalCompleted} completed sessions
          </div>
        </div>

        <div className="card p-5 border border-[var(--surface-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
              Platform Avg Score
            </span>
            <Award size={18} className="text-[var(--color-success)]" />
          </div>
          <div className="text-2xl font-bold">
            {averageScore !== null ? `${averageScore}%` : "N/A"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            across {scoredInterviews.length} graded session(s)
          </div>
        </div>

        <div className="card p-5 border border-[var(--surface-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-medium text-[var(--text-secondary)]">
              Security Incidents
            </span>
            <Shield size={18} className="text-[var(--color-warning)]" />
          </div>
          <div className="text-2xl font-bold">
            {interviews.reduce((acc, curr) => acc + (curr._count?.activities || 0), 0)}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            tab switches & focus events logged
          </div>
        </div>
      </div>

      {/* ─── Tab Controls & Search ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("candidates")}
            className={`btn btn-sm ${
              activeTab === "candidates" ? "btn-primary" : "btn-secondary"
            }`}
          >
            <Users size={15} />
            <span>Candidate Roster ({candidates.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("interviews")}
            className={`btn btn-sm ${
              activeTab === "interviews" ? "btn-primary" : "btn-secondary"
            }`}
          >
            <BrainCircuit size={15} />
            <span>Interview Sessions ({interviews.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder={
              activeTab === "candidates"
                ? "Search candidate by name or email..."
                : "Search by candidate, role..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ─── TAB 1: Candidate Roster ─── */}
      {activeTab === "candidates" && (
        <div className="card p-0 overflow-hidden border border-[var(--surface-border)]">
          <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold">Registered Candidates</h2>
            <span className="text-xs text-[var(--text-tertiary)]">
              Showing {filteredCandidates.length} of {candidates.length}
            </span>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
              No candidates found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--bg-secondary)]">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Email Status</th>
                    <th className="py-3 px-4">Interviews Taken</th>
                    <th className="py-3 px-4">Latest Activity</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--surface-border)]">
                  {filteredCandidates.map((candidate) => {
                    const completedCount = candidate.interviews.filter(
                      (i) => i.status === "COMPLETED"
                    ).length;
                    const latestInterview = candidate.interviews[0];

                    return (
                      <tr
                        key={candidate.id}
                        className="hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex items-center gap-3">
                            {candidate.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={candidate.image}
                                alt={candidate.name || "Candidate"}
                                className="w-8 h-8 rounded-full object-cover border border-[var(--surface-border)]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[var(--gradient-primary)] text-white font-bold flex items-center justify-center text-xs">
                                {(candidate.name?.[0] || candidate.email[0]).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-[var(--text-primary)]">
                                {candidate.name || "Unnamed Candidate"}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)]">
                                {candidate.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {candidate.emailVerified ? (
                            <span className="badge badge-success inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> Verified
                            </span>
                          ) : (
                            <span className="badge badge-warning inline-flex items-center gap-1">
                              <Clock size={11} /> Unverified
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span>{candidate.interviews.length} total</span>
                            <span className="text-[var(--text-tertiary)]">
                              ({completedCount} completed)
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                          {latestInterview ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} />
                              {formatDistanceToNow(new Date(latestInterview.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">None yet</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>
                              {new Date(candidate.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {latestInterview ? (
                            <Link
                              href={`/admin/interviews/${latestInterview.id}`}
                              className="btn btn-ghost btn-sm text-[var(--color-primary-light)] hover:text-white"
                            >
                              <span>Inspect Session</span>
                              <ChevronRight size={14} />
                            </Link>
                          ) : (
                            <span className="text-[var(--text-tertiary)] text-[11px]">
                              No sessions
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: Interview Sessions ─── */}
      {activeTab === "interviews" && (
        <div className="flex flex-col gap-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              Filter by:
            </span>
            <select
              className="input text-xs w-auto py-1.5 px-3"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
            >
              <option value="ALL">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            <select
              className="input text-xs w-auto py-1.5 px-3"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          <div className="card p-0 overflow-hidden border border-[var(--surface-border)]">
            <div className="p-4 border-b border-[var(--surface-border)] flex items-center justify-between">
              <h2 className="text-sm font-semibold">Interview Sessions</h2>
              <span className="text-xs text-[var(--text-tertiary)]">
                Showing {filteredInterviews.length} of {interviews.length}
              </span>
            </div>

            {filteredInterviews.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
                No interview sessions match the current filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-tertiary)] uppercase tracking-wider bg-[var(--bg-secondary)]">
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Target Job Role</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Score</th>
                      <th className="py-3 px-4">Security Incidents</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--surface-border)]">
                    {filteredInterviews.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[var(--bg-secondary)] transition-colors"
                      >
                        <td className="py-3.5 px-4 font-medium">
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">
                              {item.user.name || "Candidate"}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {item.user.email}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-[var(--text-primary)]">
                            {item.jobRole}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Layers size={10} className="text-[var(--text-tertiary)]" />
                            <span className="text-[11px] text-[var(--text-tertiary)]">
                              {item.topics.slice(0, 3).join(", ")}
                              {item.topics.length > 3 && ` +${item.topics.length - 3}`}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`badge ${
                              item.difficulty === "EASY"
                                ? "badge-success"
                                : item.difficulty === "MEDIUM"
                                ? "badge-warning"
                                : "badge-error"
                            }`}
                          >
                            {item.difficulty}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`badge ${
                              item.status === "COMPLETED"
                                ? "badge-success"
                                : item.status === "IN_PROGRESS"
                                ? "badge-warning"
                                : "badge-muted"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {typeof item.totalScore === "number" ? (
                            <span
                              className="font-bold text-sm"
                              style={{
                                color:
                                  item.totalScore >= 75
                                    ? "var(--color-success)"
                                    : item.totalScore >= 50
                                    ? "var(--color-warning)"
                                    : "var(--color-error)",
                              }}
                            >
                              {item.totalScore}%
                            </span>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {item._count.activities > 0 ? (
                            <span className="badge badge-warning inline-flex items-center gap-1">
                              <AlertTriangle size={11} />
                              {item._count.activities} flagged
                            </span>
                          ) : (
                            <span className="badge badge-muted inline-flex items-center gap-1">
                              <CheckCircle2 size={11} /> 0 clean
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/interviews/${item.id}`}
                              className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5"
                              title="Full interview transcript, questions, code, and proctoring timeline"
                            >
                              <span>Deep Dive</span>
                            </Link>

                            <Link
                              href={`/interview/${item.id}/report`}
                              className="btn btn-primary btn-sm text-[11px] py-1 px-2.5"
                              title="View AI Performance Assessment Report"
                            >
                              <span>Report</span>
                              <ArrowRight size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
