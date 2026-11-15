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
  X,
  FileBarChart,
  Filter,
  RotateCcw,
  Plus,
  Send,
  BookOpen,
  DollarSign,
  UserCheck,
  UserX,
  Copy,
  Download,
  Trash2,
  Check,
  TrendingUp,
  BarChart2,
  Lock,
  AlertCircle,
  Mail,
  Loader2,
} from "lucide-react";
import {
  createTemplateAction,
  deleteTemplateAction,
  createBankQuestionAction,
  deleteBankQuestionAction,
  createInvitationAction,
  revokeInvitationAction,
  resendInvitationEmailAction,
  updateUserRoleAction,
  toggleUserActiveAction,
  exportCandidatePipelineCsvAction,
} from "@/actions/admin";
import { Role, Difficulty, QuestionType, CandidateDecision } from "@prisma/client";

interface CandidateData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  isActive: boolean;
  emailVerified: Date | null;
  createdAt: Date;
  interviews: Array<{
    id: string;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    totalScore: number | null;
    humanDecision: CandidateDecision;
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
  humanDecision: CandidateDecision;
  humanScore: number | null;
  humanNotes: string | null;
  durationSeconds: number | null;
  tokenCount: number;
  estimatedCost: number;
  createdAt: Date;
  completedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  template?: {
    id: string;
    title: string;
  } | null;
  report: {
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
    problemSolvingScore: number;
    modelName: string | null;
    promptVersion: string | null;
  } | null;
  _count: {
    questions: number;
    activities: number;
  };
}

interface TemplateData {
  id: string;
  title: string;
  jobRole: string;
  description: string | null;
  duration: number;
  questionCount: number;
  difficulty: Difficulty;
  stages: string[];
  rubricWeights: any;
  proctoringPolicy: any;
  createdAt: Date;
  createdBy: {
    name: string | null;
    email: string;
  };
  _count: {
    interviews: number;
    invitations: number;
  };
}

interface BankQuestionData {
  id: string;
  title: string;
  content: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  expectedTopics: string[];
  sampleCode: string | null;
  starterCode: any;
  testCases: any;
  rubric: any;
  createdAt: Date;
  createdBy: {
    name: string | null;
    email: string;
  } | null;
}

interface InvitationData {
  id: string;
  token: string;
  candidateEmail: string;
  candidateName: string | null;
  jobRole: string;
  difficulty: Difficulty;
  status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  createdAt: Date;
  template: { title: string } | null;
  invitedBy: { name: string | null; email: string };
}

interface UserData {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  _count: {
    interviews: number;
  };
}

interface AdminPortalProps {
  candidates: CandidateData[];
  interviews: InterviewData[];
  templates: TemplateData[];
  bankQuestions: BankQuestionData[];
  invitations: InvitationData[];
  allUsers: UserData[];
}

export function AdminPortal({
  candidates,
  interviews,
  templates,
  bankQuestions,
  invitations,
  allUsers,
}: AdminPortalProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<
    "pipeline" | "invites" | "templates" | "questions" | "analytics" | "users"
  >("pipeline");

  // Pipeline filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDecision, setFilterDecision] = useState("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState("ALL");

  // Invitations tab state (A3)
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("ALL");
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [inviteActionMsg, setInviteActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  // Invite creation form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("Frontend Developer");
  const [inviteDifficulty, setInviteDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [inviteTemplateId, setInviteTemplateId] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState<boolean | null>(null);
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template creation form state
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateRole, setTemplateRole] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateDuration, setTemplateDuration] = useState(45);
  const [templateQuestionCount, setTemplateQuestionCount] = useState(5);
  const [templateDifficulty, setTemplateDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);

  // Question creation form state
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionContent, setQuestionContent] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>(QuestionType.CODING);
  const [questionDifficulty, setQuestionDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [questionTags, setQuestionTags] = useState("");
  const [sampleTestCaseInput, setSampleTestCaseInput] = useState("");
  const [sampleTestCaseOutput, setSampleTestCaseOutput] = useState("");

  // Filtered Interviews for Candidate Pipeline (A4)
  const filteredInterviews = useMemo(() => {
    return interviews.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.jobRole.toLowerCase().includes(q) ||
        (item.user.name?.toLowerCase().includes(q) ?? false) ||
        item.user.email.toLowerCase().includes(q) ||
        item.topics.some((t) => t.toLowerCase().includes(q));

      const matchRole = filterRole === "ALL" || item.jobRole === filterRole;
      const matchStatus = filterStatus === "ALL" || item.status === filterStatus;
      const matchDecision =
        filterDecision === "ALL" || item.humanDecision === filterDecision;
      const matchDifficulty =
        filterDifficulty === "ALL" || item.difficulty === filterDifficulty;

      return matchQuery && matchRole && matchStatus && matchDecision && matchDifficulty;
    });
  }, [interviews, searchQuery, filterRole, filterStatus, filterDecision, filterDifficulty]);

  // Unique job roles for filtering
  const uniqueRoles = useMemo(() => {
    const roles = new Set(interviews.map((i) => i.jobRole));
    return Array.from(roles);
  }, [interviews]);

  // Funnel & Analytics Metrics (A8, A9)
  const totalInvited = invitations.length;
  const totalStarted = invitations.filter((i) => i.status === "STARTED" || i.status === "COMPLETED").length;
  const totalCompleted = interviews.filter((i) => i.status === "COMPLETED").length;
  const totalAdvanced = interviews.filter((i) => i.humanDecision === "ADVANCE").length;

  const totalTokens = interviews.reduce((acc, curr) => acc + (curr.tokenCount || 0), 0);
  const totalCost = interviews.reduce((acc, curr) => acc + (curr.estimatedCost || 0), 0);
  const flaggedSessions = interviews.filter((i) => i._count.activities > 0).length;
  const flaggedRate = interviews.length
    ? Math.round((flaggedSessions / interviews.length) * 100)
    : 0;

  const scoredInterviews = interviews.filter((i) => typeof i.totalScore === "number");
  const averageScore = scoredInterviews.length
    ? Math.round(
        (scoredInterviews.reduce((acc, curr) => acc + (curr.totalScore || 0), 0) /
          scoredInterviews.length) *
          10
      ) / 10
    : null;

  // CSV Export Handler (A11)
  async function handleExportCsv() {
    const res = await exportCandidatePipelineCsvAction();
    if (res.success && res.csvContent) {
      const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `candidate_pipeline_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Create Invitation Handler (A3)
  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setInviteEmailSent(null);
    setInviteEmailError(null);

    const res = await createInvitationAction({
      candidateEmail: inviteEmail,
      candidateName: inviteName,
      jobRole: inviteRole,
      difficulty: inviteDifficulty,
      templateId: inviteTemplateId || undefined,
      expiresInDays: inviteDays,
    });
    setIsSubmitting(false);

    if (res.success && res.inviteLink) {
      setGeneratedInviteLink(res.inviteLink);
      setInviteEmailSent(res.emailSent ?? true);
      setInviteEmailError(res.emailError ?? null);
    }
  }

  // Resend Invite Email Handler (A3 + SMTP)
  async function handleResendInvite(invitationId: string) {
    setResendingInviteId(invitationId);
    setInviteActionMsg(null);
    try {
      const res = await resendInvitationEmailAction(invitationId);
      if (res.success) {
        setInviteActionMsg({
          type: "success",
          text: "Assessment invitation email re-sent successfully via SMTP!",
        });
      } else {
        setInviteActionMsg({
          type: "error",
          text: res.error || "Failed to resend invitation email.",
        });
      }
    } catch (err: any) {
      setInviteActionMsg({
        type: "error",
        text: err.message || "Failed to resend email.",
      });
    } finally {
      setResendingInviteId(null);
      setTimeout(() => setInviteActionMsg(null), 5000);
    }
  }

  // Revoke Invitation Handler (A3)
  async function handleRevokeInvite(invitationId: string) {
    if (!confirm("Are you sure you want to revoke this invitation? The candidate will no longer be able to use the link.")) {
      return;
    }
    setInviteActionMsg(null);
    try {
      const res = await revokeInvitationAction(invitationId);
      if (res.success) {
        setInviteActionMsg({
          type: "success",
          text: "Invitation revoked.",
        });
      } else {
        setInviteActionMsg({
          type: "error",
          text: res.error || "Failed to revoke invitation.",
        });
      }
    } catch (err: any) {
      setInviteActionMsg({
        type: "error",
        text: err.message || "Failed to revoke.",
      });
    } finally {
      setTimeout(() => setInviteActionMsg(null), 4000);
    }
  }

  // Create Template Handler (A1)
  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    await createTemplateAction({
      title: templateTitle,
      jobRole: templateRole,
      description: templateDescription,
      duration: templateDuration,
      questionCount: templateQuestionCount,
      difficulty: templateDifficulty,
    });
    setIsSubmitting(false);
    setShowTemplateModal(false);
    setTemplateTitle("");
    setTemplateRole("");
    setTemplateDescription("");
  }

  // Create Question Handler (A2)
  async function handleCreateQuestion(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    const tags = questionTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const testCases =
      sampleTestCaseInput && sampleTestCaseOutput
        ? [
            {
              input: sampleTestCaseInput,
              expectedOutput: sampleTestCaseOutput,
              isHidden: false,
            },
          ]
        : undefined;

    await createBankQuestionAction({
      title: questionTitle,
      content: questionContent,
      type: questionType,
      difficulty: questionDifficulty,
      tags,
      testCases,
    });
    setIsSubmitting(false);
    setShowQuestionModal(false);
    setQuestionTitle("");
    setQuestionContent("");
    setQuestionTags("");
    setSampleTestCaseInput("");
    setSampleTestCaseOutput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* ─── Executive Summary KPI Cards ─── */}
      <div className="stats-grid">
        <div className="card card-glass stat-card">
          <div
            className="stat-card-icon"
            style={{
              backgroundColor: "rgba(108, 92, 231, 0.15)",
              color: "var(--color-primary)",
            }}
          >
            <Users size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value">{candidates.length}</span>
            <span className="stat-card-label">Active Pipeline</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              {candidates.filter((c) => c.emailVerified).length} verified candidates
            </span>
          </div>
        </div>

        <div className="card card-glass stat-card">
          <div
            className="stat-card-icon"
            style={{
              backgroundColor: "rgba(52, 152, 219, 0.15)",
              color: "var(--color-info)",
            }}
          >
            <BrainCircuit size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value">{interviews.length}</span>
            <span className="stat-card-label">Interview Submissions</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              {totalCompleted} completed assessments
            </span>
          </div>
        </div>

        <div className="card card-glass stat-card">
          <div
            className="stat-card-icon"
            style={{
              backgroundColor: "rgba(0, 214, 143, 0.15)",
              color: "var(--color-success)",
            }}
          >
            <Award size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value">
              {averageScore !== null ? `${averageScore}%` : "N/A"}
            </span>
            <span className="stat-card-label">Platform Average</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              Across {scoredInterviews.length} graded sessions
            </span>
          </div>
        </div>

        <div className="card card-glass stat-card">
          <div
            className="stat-card-icon"
            style={{
              backgroundColor: "rgba(255, 170, 0, 0.15)",
              color: "var(--color-warning)",
            }}
          >
            <Shield size={22} />
          </div>
          <div className="stat-card-body">
            <span className="stat-card-value">{flaggedRate}%</span>
            <span className="stat-card-label">Proctoring Flag Rate</span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "2px" }}>
              {flaggedSessions} flagged session{flaggedSessions === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Executive Tab Navigation Bar ─── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: "var(--bg-secondary)",
            padding: "0.3rem",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--surface-border)",
            gap: "0.25rem",
            overflowX: "auto",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "pipeline" ? "var(--color-primary)" : "transparent",
              color: activeTab === "pipeline" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <Users size={15} />
            <span>Candidate Pipeline</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                backgroundColor: activeTab === "pipeline" ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
              }}
            >
              {interviews.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invites")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "invites" ? "var(--color-primary)" : "transparent",
              color: activeTab === "invites" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <Send size={15} />
            <span>Invitations</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                backgroundColor: activeTab === "invites" ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
              }}
            >
              {invitations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "templates" ? "var(--color-primary)" : "transparent",
              color: activeTab === "templates" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <Layers size={15} />
            <span>Interview Templates</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                backgroundColor: activeTab === "templates" ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
              }}
            >
              {templates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("questions")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "questions" ? "var(--color-primary)" : "transparent",
              color: activeTab === "questions" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <BookOpen size={15} />
            <span>Question Bank</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                backgroundColor: activeTab === "questions" ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
              }}
            >
              {bankQuestions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "analytics" ? "var(--color-primary)" : "transparent",
              color: activeTab === "analytics" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <BarChart2 size={15} />
            <span>Analytics &amp; Costs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "var(--radius-md)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              backgroundColor: activeTab === "users" ? "var(--color-primary)" : "transparent",
              color: activeTab === "users" ? "#ffffff" : "var(--text-secondary)",
            }}
          >
            <Shield size={15} />
            <span>Team &amp; RBAC</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "9999px",
                backgroundColor: activeTab === "users" ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
              }}
            >
              {allUsers.length}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            title="Download full candidate pipeline as CSV (A11)"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGeneratedInviteLink(null);
              setShowInviteModal(true);
            }}
            className="btn btn-primary btn-sm"
            style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <Send size={13} />
            <span>Send Assessment Invite</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: CANDIDATE PIPELINE (A4) ─── */}
      {activeTab === "pipeline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Filter Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              backgroundColor: "rgba(20, 20, 31, 0.7)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--surface-border)",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", minWidth: "260px", flex: "1", maxWidth: "380px" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: "2.25rem", height: "34px", fontSize: "0.75rem" }}
                placeholder="Search candidate, email, role, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <select
                className="input"
                style={{ width: "auto", height: "34px", fontSize: "0.75rem", padding: "0 0.5rem" }}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <select
                className="input"
                style={{ width: "auto", height: "34px", fontSize: "0.75rem", padding: "0 0.5rem" }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
              </select>

              <select
                className="input"
                style={{ width: "auto", height: "34px", fontSize: "0.75rem", padding: "0 0.5rem" }}
                value={filterDecision}
                onChange={(e) => setFilterDecision(e.target.value)}
              >
                <option value="ALL">All Recruiter Decisions</option>
                <option value="ADVANCE">Advance (Selected)</option>
                <option value="HOLD">Hold (Waitlist)</option>
                <option value="REJECT">Reject</option>
                <option value="UNDECIDED">Undecided</option>
              </select>

              {(searchQuery || filterRole !== "ALL" || filterStatus !== "ALL" || filterDecision !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterRole("ALL");
                    setFilterStatus("ALL");
                    setFilterDecision("ALL");
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ height: "34px", fontSize: "0.75rem", color: "var(--color-primary-hover)" }}
                >
                  <RotateCcw size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Pipeline Table */}
          <div
            className="card card-glass"
            style={{
              padding: 0,
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--surface-border)",
            }}
          >
            <div
              style={{
                padding: "0.85rem 1.25rem",
                borderBottom: "1px solid var(--surface-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(18, 18, 26, 0.4)",
              }}
            >
              <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                Candidate Evaluation Pipeline ({filteredInterviews.length})
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                Auditable decision records &amp; AI scorecards
              </span>
            </div>

            {filteredInterviews.length === 0 ? (
              <div style={{ padding: "3.5rem 1rem", textAlign: "center", color: "var(--text-secondary)" }}>
                <Users size={32} style={{ margin: "0 auto 0.75rem", color: "var(--text-tertiary)" }} />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  No Candidates Found
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: "4px" }}>
                  Adjust your search terms or send a new assessment invite.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--surface-border)",
                        backgroundColor: "rgba(18, 18, 26, 0.8)",
                        color: "var(--text-tertiary)",
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      <th style={{ padding: "0.75rem 1.25rem", textAlign: "left" }}>Candidate</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "left" }}>Role &amp; Template</th>
                      <th style={{ padding: "0.75rem 0.75rem", textAlign: "left" }}>Status</th>
                      <th style={{ padding: "0.75rem 0.75rem", textAlign: "left" }}>AI Score</th>
                      <th style={{ padding: "0.75rem 0.75rem", textAlign: "left" }}>Human Decision</th>
                      <th style={{ padding: "0.75rem 0.75rem", textAlign: "left" }}>Security Audit</th>
                      <th style={{ padding: "0.75rem 0.75rem", textAlign: "left" }}>Submitted</th>
                      <th style={{ padding: "0.75rem 1.25rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterviews.map((item, idx) => {
                      const score = item.totalScore ?? item.report?.overallScore ?? null;

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom:
                              idx < filteredInterviews.length - 1
                                ? "1px solid var(--surface-border)"
                                : "none",
                          }}
                        >
                          {/* Candidate info */}
                          <td style={{ padding: "0.85rem 1.25rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <div
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "50%",
                                  background: "var(--gradient-primary)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {(item.user.name?.[0] || item.user.email[0]).toUpperCase()}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8125rem" }}>
                                  {item.user.name || "Candidate"}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                                  {item.user.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role & Template */}
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8125rem" }}>
                                {item.jobRole}
                              </span>
                              <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                                {item.template?.title || "Custom Prompt Session"}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "0.85rem 0.75rem" }}>
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

                          {/* AI Score */}
                          <td style={{ padding: "0.85rem 0.75rem" }}>
                            {typeof score === "number" ? (
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: "0.875rem",
                                  color:
                                    score >= 75
                                      ? "var(--color-success)"
                                      : score >= 50
                                      ? "var(--color-warning)"
                                      : "var(--color-error)",
                                }}
                              >
                                {score}%
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-tertiary)" }}>—</span>
                            )}
                          </td>

                          {/* Recruiter Decision (A6) */}
                          <td style={{ padding: "0.85rem 0.75rem" }}>
                            <span
                              className={`badge ${
                                item.humanDecision === "ADVANCE"
                                  ? "badge-success"
                                  : item.humanDecision === "HOLD"
                                  ? "badge-warning"
                                  : item.humanDecision === "REJECT"
                                  ? "badge-error"
                                  : "badge-muted"
                              }`}
                            >
                              {item.humanDecision}
                            </span>
                          </td>

                          {/* Proctoring */}
                          <td style={{ padding: "0.85rem 0.75rem" }}>
                            {item._count.activities > 0 ? (
                              <span className="badge badge-warning" style={{ gap: "0.25rem" }}>
                                <AlertTriangle size={11} /> {item._count.activities} flags
                              </span>
                            ) : (
                              <span className="badge badge-muted" style={{ gap: "0.25rem" }}>
                                <CheckCircle2 size={11} /> Clean
                              </span>
                            )}
                          </td>

                          {/* Date */}
                          <td style={{ padding: "0.85rem 0.75rem", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>

                          {/* Actions (A5 & A6 link) */}
                          <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                              <Link
                                href={`/admin/interviews/${item.id}`}
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
                                title="Audit transcript, rubric scores, code, and set human decision"
                              >
                                <FileBarChart size={12} />
                                <span>Audit &amp; Review</span>
                              </Link>

                              <Link
                                href={`/interview/${item.id}/report`}
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: "0.75rem", padding: "0.25rem 0.55rem" }}
                                title="View candidate report"
                              >
                                <span>Report</span>
                                <ArrowRight size={12} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB: CANDIDATE INVITATIONS (A3 + SMTP) ─── */}
      {activeTab === "invites" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Assessment Invitations</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Single-use assessment links with automated lifecycle tracking (invited → started → completed → expired). Dispatched via SMTP.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setGeneratedInviteLink(null);
                setShowInviteModal(true);
              }}
              className="btn btn-primary btn-sm"
              style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
            >
              <Send size={13} />
              <span>Send New Invite</span>
            </button>
          </div>

          {inviteActionMsg && (
            <div
              className={`auth-alert ${
                inviteActionMsg.type === "success" ? "auth-alert-success" : "auth-alert-error"
              }`}
            >
              {inviteActionMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{inviteActionMsg.text}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div
            className="card-glass"
            style={{
              padding: "0.75rem 1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ position: "relative", flex: "1 1 240px" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type="text"
                placeholder="Search candidate name, email, or role..."
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: "2.25rem", fontSize: "0.8125rem", height: "36px" }}
              />
            </div>

            <select
              value={inviteStatusFilter}
              onChange={(e) => setInviteStatusFilter(e.target.value)}
              className="input"
              style={{ width: "auto", fontSize: "0.8125rem", height: "36px" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="INVITED">INVITED</option>
              <option value="STARTED">STARTED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="REVOKED">REVOKED</option>
            </select>
          </div>

          {/* Invitations Table */}
          {(() => {
            const filteredInvites = invitations.filter((inv) => {
              if (inviteStatusFilter !== "ALL" && inv.status !== inviteStatusFilter) return false;
              if (!inviteSearch.trim()) return true;
              const q = inviteSearch.toLowerCase();
              return (
                inv.candidateEmail.toLowerCase().includes(q) ||
                (inv.candidateName && inv.candidateName.toLowerCase().includes(q)) ||
                inv.jobRole.toLowerCase().includes(q) ||
                (inv.template?.title && inv.template.title.toLowerCase().includes(q))
              );
            });

            if (filteredInvites.length === 0) {
              return (
                <div
                  className="card-glass"
                  style={{
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Mail size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.5 }} />
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>No Invitations Found</h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {invitations.length === 0
                      ? "You haven't sent any assessment invitations yet."
                      : "No invitations match your search filter."}
                  </p>
                </div>
              );
            }

            return (
              <div className="card-glass" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--surface-border)",
                        textAlign: "left",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <th style={{ padding: "0.75rem 1rem" }}>Candidate</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Role & Difficulty</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Template</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                      <th style={{ padding: "0.75rem 1rem" }}>Valid Until</th>
                      <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvites.map((inv) => {
                      const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                      const effectiveStatus =
                        inv.status === "INVITED" && isExpired ? "EXPIRED" : inv.status;
                      const directLink = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.token}`;

                      return (
                        <tr
                          key={inv.id}
                          style={{
                            borderBottom: "1px solid var(--surface-border)",
                          }}
                        >
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {inv.candidateName || "Candidate"}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                              {inv.candidateEmail}
                            </div>
                          </td>
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div>{inv.jobRole}</div>
                            <span
                              className={`badge ${
                                inv.difficulty === "HARD"
                                  ? "badge-error"
                                  : inv.difficulty === "MEDIUM"
                                  ? "badge-warning"
                                  : "badge-success"
                              }`}
                              style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem", marginTop: "2px" }}
                            >
                              {inv.difficulty}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem 1rem" }}>
                            {inv.template?.title ? (
                              <span style={{ color: "var(--color-primary-light)" }}>
                                {inv.template.title}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-tertiary)" }}>Default Curated</span>
                            )}
                          </td>
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <span
                              className={`badge ${
                                effectiveStatus === "COMPLETED"
                                  ? "badge-success"
                                  : effectiveStatus === "STARTED"
                                  ? "badge-primary"
                                  : effectiveStatus === "INVITED"
                                  ? "badge-warning"
                                  : effectiveStatus === "REVOKED"
                                  ? "badge-error"
                                  : "badge-muted"
                              }`}
                            >
                              {effectiveStatus}
                            </span>
                          </td>
                          <td style={{ padding: "0.85rem 1rem" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                              {new Date(inv.expiresAt).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>
                              {isExpired ? "Expired" : "Active token"}
                            </div>
                          </td>
                          <td style={{ padding: "0.85rem 1rem", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
                              <button
                                type="button"
                                title="Copy direct link"
                                onClick={() => {
                                  navigator.clipboard.writeText(directLink);
                                  setInviteActionMsg({
                                    type: "success",
                                    text: "Invitation token link copied to clipboard!",
                                  });
                                  setTimeout(() => setInviteActionMsg(null), 3000);
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                              >
                                <Copy size={13} />
                                <span>Copy</span>
                              </button>

                              <button
                                type="button"
                                title="Resend invitation email via SMTP"
                                disabled={
                                  resendingInviteId === inv.id ||
                                  effectiveStatus === "REVOKED" ||
                                  effectiveStatus === "COMPLETED"
                                }
                                onClick={() => handleResendInvite(inv.id)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                              >
                                {resendingInviteId === inv.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Mail size={13} />
                                )}
                                <span>Resend</span>
                              </button>

                              {effectiveStatus !== "REVOKED" && effectiveStatus !== "COMPLETED" && (
                                <button
                                  type="button"
                                  title="Revoke access link"
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  className="btn btn-ghost btn-sm"
                                  style={{
                                    padding: "0.3rem 0.5rem",
                                    fontSize: "0.75rem",
                                    color: "var(--color-error)",
                                  }}
                                >
                                  <X size={13} />
                                  <span>Revoke</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── TAB 2: INTERVIEW TEMPLATES (A1) ─── */}
      {activeTab === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Reusable Interview Templates</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Standardize your hiring bars: create role-specific rubrics, durations, proctoring policies, and question counts once and reuse them indefinitely.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem" }}
            >
              <Plus size={14} />
              <span>Create Template</span>
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="card card-glass" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <Layers size={36} style={{ margin: "0 auto 0.75rem", color: "var(--text-tertiary)" }} />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>No Templates Created Yet</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Create your first standardized interview template to send single-click candidate invitations.
              </p>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="btn btn-primary btn-sm"
                style={{ marginTop: "1rem" }}
              >
                Create Template
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="card card-glass"
                  style={{
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span className="badge badge-primary">{tpl.jobRole}</span>
                      <span
                        className={`badge ${
                          tpl.difficulty === "EASY"
                            ? "badge-success"
                            : tpl.difficulty === "MEDIUM"
                            ? "badge-warning"
                            : "badge-error"
                        }`}
                      >
                        {tpl.difficulty}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1rem", fontWeight: 700, marginTop: "0.5rem" }}>{tpl.title}</h3>
                    {tpl.description && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                        {tpl.description}
                      </p>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "0.5rem",
                        marginTop: "0.75rem",
                        padding: "0.6rem 0",
                        borderTop: "1px solid var(--surface-border)",
                        borderBottom: "1px solid var(--surface-border)",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      <div>
                        ⏱️ Duration: <strong>{tpl.duration} mins</strong>
                      </div>
                      <div>
                        ❓ Questions: <strong>{tpl.questionCount} items</strong>
                      </div>
                      <div>
                        📨 Used in: <strong>{tpl._count.invitations} invites</strong>
                      </div>
                      <div>
                        🎯 Completed: <strong>{tpl._count.interviews} sessions</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteTemplateId(tpl.id);
                        setInviteRole(tpl.jobRole);
                        setInviteDifficulty(tpl.difficulty);
                        setShowInviteModal(true);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <Send size={12} />
                      <span>Send Invite</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteTemplateAction(tpl.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--color-error)", fontSize: "0.75rem" }}
                      title="Delete template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: QUESTION BANK (A2) ─── */}
      {activeTab === "questions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Curated Question Bank</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Curate coding and behavioral challenges with starter code and test cases to mix into interviews.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowQuestionModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem" }}
            >
              <Plus size={14} />
              <span>Add Question</span>
            </button>
          </div>

          {bankQuestions.length === 0 ? (
            <div className="card card-glass" style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <BookOpen size={36} style={{ margin: "0 auto 0.75rem", color: "var(--text-tertiary)" }} />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>Question Bank is Empty</h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                Add curated technical or coding questions with automated test cases.
              </p>
              <button
                type="button"
                onClick={() => setShowQuestionModal(true)}
                className="btn btn-primary btn-sm"
                style={{ marginTop: "1rem" }}
              >
                Add First Question
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {bankQuestions.map((q) => (
                <div
                  key={q.id}
                  className="card card-glass"
                  style={{
                    padding: "1rem 1.25rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "1rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span className="badge badge-primary">{q.type}</span>
                      <span
                        className={`badge ${
                          q.difficulty === "EASY"
                            ? "badge-success"
                            : q.difficulty === "MEDIUM"
                            ? "badge-warning"
                            : "badge-error"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      {q.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "var(--radius-sm)",
                            backgroundColor: "var(--bg-tertiary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)" }}>{q.title}</h4>
                    <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.5 }}>
                      {q.content}
                    </p>

                    {Array.isArray(q.testCases) && q.testCases.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.4rem 0.6rem",
                          backgroundColor: "rgba(0,0,0,0.25)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.72rem",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        Test Case: input: <code>{q.testCases[0].input}</code> → output: <code>{q.testCases[0].expectedOutput}</code>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteBankQuestionAction(q.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--color-error)" }}
                    title="Delete question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: ANALYTICS & COST TRACKING (A8, A9) ─── */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Funnel Metrics */}
          <div className="card card-glass" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, marginBottom: "0.25rem" }}>
              Recruitment Conversion Funnel
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
              Candidate pipeline progression from invitation to hiring decision
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", textAlign: "center" }}>
              <div style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>1. Invited</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>{totalInvited}</div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>Links generated</span>
              </div>

              <div style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>2. Started</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>{totalStarted}</div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-primary)" }}>
                  {totalInvited ? Math.round((totalStarted / totalInvited) * 100) : 0}% start rate
                </span>
              </div>

              <div style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>3. Completed</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem" }}>{totalCompleted}</div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-info)" }}>
                  {totalStarted ? Math.round((totalCompleted / totalStarted) * 100) : 0}% completion
                </span>
              </div>

              <div style={{ padding: "1rem", backgroundColor: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", textTransform: "uppercase" }}>4. Advanced</span>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: "0.25rem", color: "var(--color-success)" }}>
                  {totalAdvanced}
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--color-success)" }}>
                  {totalCompleted ? Math.round((totalAdvanced / totalCompleted) * 100) : 0}% offer rate
                </span>
              </div>
            </div>
          </div>

          {/* Cost & LLM Telemetry (A9) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
            <div className="card card-glass" style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <DollarSign size={18} style={{ color: "var(--color-success)" }} />
                <h4 style={{ fontSize: "0.9rem", fontWeight: 600 }}>AI Inference Cost Tracking</h4>
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                ${totalCost.toFixed(2)}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                Total platform evaluation spend across {interviews.length} sessions
              </p>
              <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--surface-border)", fontSize: "0.75rem" }}>
                Estimated Cost Per Interview: <strong>${interviews.length ? (totalCost / interviews.length).toFixed(3) : "0.00"}</strong>
              </div>
            </div>

            <div className="card card-glass" style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <TrendingUp size={18} style={{ color: "var(--color-info)" }} />
                <h4 style={{ fontSize: "0.9rem", fontWeight: 600 }}>Token Consumption</h4>
              </div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {totalTokens.toLocaleString()}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                Total prompt and completion tokens processed
              </p>
              <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--surface-border)", fontSize: "0.75rem" }}>
                Avg Tokens / Session: <strong>{interviews.length ? Math.round(totalTokens / interviews.length).toLocaleString() : 0}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: TEAM & RBAC MANAGEMENT (A7) ─── */}
      {activeTab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Access Control &amp; User Management</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                Manage roles (Admin / Candidate) and toggle account activation. Permissions are enforced on the server for all actions.
              </p>
            </div>
          </div>

          <div
            className="card card-glass"
            style={{
              padding: 0,
              overflow: "hidden",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--surface-border)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--surface-border)",
                      backgroundColor: "rgba(18, 18, 26, 0.8)",
                      color: "var(--text-tertiary)",
                      fontSize: "0.7rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    <th style={{ padding: "0.85rem 1.25rem", textAlign: "left" }}>User</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "left" }}>Assigned Role</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "left" }}>Account Status</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "left" }}>Interviews</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "left" }}>Joined</th>
                    <th style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>RBAC Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u, idx) => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: idx < allUsers.length - 1 ? "1px solid var(--surface-border)" : "none",
                      }}
                    >
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8125rem" }}>
                            {u.name || "User"}
                          </span>
                          <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{u.email}</span>
                        </div>
                      </td>

                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span className={`badge ${u.role === Role.ADMIN ? "badge-warning" : "badge-primary"}`}>
                          {u.role}
                        </span>
                      </td>

                      <td style={{ padding: "0.85rem 1rem" }}>
                        {u.isActive ? (
                          <span className="badge badge-success" style={{ gap: "0.25rem" }}>
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="badge badge-error" style={{ gap: "0.25rem" }}>
                            <Lock size={11} /> Deactivated
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)" }}>
                        {u._count.interviews} sessions
                      </td>

                      <td style={{ padding: "0.85rem 1rem", color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ padding: "0.85rem 1.25rem", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                          <button
                            type="button"
                            onClick={() =>
                              updateUserRoleAction(u.id, u.role === Role.ADMIN ? Role.CANDIDATE : Role.ADMIN)
                            }
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                            title="Toggle user role"
                          >
                            Set {u.role === Role.ADMIN ? "Candidate" : "Admin"}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleUserActiveAction(u.id, !u.isActive)}
                            className="btn btn-ghost btn-sm"
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.2rem 0.5rem",
                              color: u.isActive ? "var(--color-error)" : "var(--color-success)",
                            }}
                          >
                            {u.isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                            <span>{u.isActive ? "Deactivate" : "Activate"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Send Assessment Invite (A3) ─── */}
      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card card-glass"
            style={{ width: "100%", maxWidth: "480px", padding: "1.75rem", borderRadius: "var(--radius-lg)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Send size={18} style={{ color: "var(--color-primary)" }} />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Generate Assessment Invite</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "0.2rem" }}
              >
                <X size={18} />
              </button>
            </div>

            {generatedInviteLink ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="auth-alert auth-alert-success">
                  <CheckCircle2 size={18} />
                  <span>
                    Single-use assessment invitation created successfully!
                    {inviteEmailSent
                      ? " An invitation email with the assessment link was dispatched via SMTP."
                      : inviteEmailError
                      ? ` (SMTP notice: ${inviteEmailError} — link still usable below)`
                      : " (Local SMTP fallback: logged to terminal)."}
                  </span>
                </div>

                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="input"
                    style={{ paddingRight: "4rem", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="btn btn-primary btn-sm"
                    style={{ position: "absolute", right: "4px", top: "4px", height: "30px", fontSize: "0.75rem" }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </button>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                  Share this expiring link with the candidate. When they open it, their interview session will launch automatically without requiring self-configuration.
                </p>

                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: "flex-end" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="form-label">Candidate Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="candidate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Candidate Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Target Job Role *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Developer"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="input"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label">Difficulty</label>
                    <select
                      value={inviteDifficulty}
                      onChange={(e) => setInviteDifficulty(e.target.value as Difficulty)}
                      className="input"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Expires In (Days)</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={inviteDays}
                      onChange={(e) => setInviteDays(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                </div>

                {templates.length > 0 && (
                  <div>
                    <label className="form-label">Interview Template (Optional)</label>
                    <select
                      value={inviteTemplateId}
                      onChange={(e) => setInviteTemplateId(e.target.value)}
                      className="input"
                    >
                      <option value="">No template (use role default)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.duration} mins)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
                    {isSubmitting ? "Generating..." : "Generate Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: Create Template (A1) ─── */}
      {showTemplateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card card-glass"
            style={{ width: "100%", maxWidth: "520px", padding: "1.75rem", borderRadius: "var(--radius-lg)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Layers size={18} style={{ color: "var(--color-primary)" }} />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Create Interview Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "0.2rem" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="form-label">Template Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer Bar Raiser"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="form-label">Target Job Role *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend Engineer"
                  value={templateRole}
                  onChange={(e) => setTemplateRole(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="form-label">Description / Instructions</label>
                <textarea
                  rows={2}
                  placeholder="Notes on what this assessment evaluates..."
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="input"
                  style={{ height: "auto" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                <div>
                  <label className="form-label">Duration (Mins)</label>
                  <input
                    type="number"
                    min={15}
                    max={120}
                    value={templateDuration}
                    onChange={(e) => setTemplateDuration(Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Questions</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={templateQuestionCount}
                    onChange={(e) => setTemplateQuestionCount(Number(e.target.value))}
                    className="input"
                  />
                </div>

                <div>
                  <label className="form-label">Difficulty</label>
                  <select
                    value={templateDifficulty}
                    onChange={(e) => setTemplateDifficulty(e.target.value as Difficulty)}
                    className="input"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
                  {isSubmitting ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Add Question to Bank (A2) ─── */}
      {showQuestionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="card card-glass"
            style={{ width: "100%", maxWidth: "520px", padding: "1.75rem", borderRadius: "var(--radius-lg)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <BookOpen size={18} style={{ color: "var(--color-primary)" }} />
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Add Curated Question</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "0.2rem" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="form-label">Question Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement an LRU Cache"
                  value={questionTitle}
                  onChange={(e) => setQuestionTitle(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="form-label">Question Content / Problem Statement *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the challenge or technical prompt..."
                  value={questionContent}
                  onChange={(e) => setQuestionContent(e.target.value)}
                  className="input"
                  style={{ height: "auto" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                <div>
                  <label className="form-label">Question Type</label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                    className="input"
                  >
                    <option value="CODING">Coding Problem</option>
                    <option value="TECHNICAL">Technical Deep-Dive</option>
                    <option value="SYSTEM_DESIGN">System Design</option>
                    <option value="BEHAVIORAL">Behavioral</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Difficulty</label>
                  <select
                    value={questionDifficulty}
                    onChange={(e) => setQuestionDifficulty(e.target.value as Difficulty)}
                    className="input"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="React, State Management, Data Structures"
                  value={questionTags}
                  onChange={(e) => setQuestionTags(e.target.value)}
                  className="input"
                />
              </div>

              {questionType === QuestionType.CODING && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label">Sample Input</label>
                    <input
                      type="text"
                      placeholder="e.g. [2, 7, 11, 15], target = 9"
                      value={sampleTestCaseInput}
                      onChange={(e) => setSampleTestCaseInput(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Expected Output</label>
                    <input
                      type="text"
                      placeholder="e.g. [0, 1]"
                      value={sampleTestCaseOutput}
                      onChange={(e) => setSampleTestCaseOutput(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-sm">
                  {isSubmitting ? "Adding..." : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
