"use client";

import { useState } from "react";
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { createInterview } from "@/actions/interview";

const JOB_ROLE_PRESETS = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Developer",
  "Mobile Developer",
  "DevOps Engineer",
  "Machine Learning Engineer",
  "Data Engineer",
];

const TOPIC_OPTIONS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Python",
  "System Design",
  "Algorithms & DSA",
  "Databases & SQL",
  "REST APIs",
  "Docker & Kubernetes",
  "AWS / Cloud",
  "Git & CI/CD",
  "Testing",
  "Behavioral",
];

const DIFFICULTIES = [
  {
    value: "EASY" as const,
    label: "Easy",
    desc: "Foundational concepts & basic coding",
    color: "var(--color-success)",
    subtle: "var(--color-success-subtle)",
  },
  {
    value: "MEDIUM" as const,
    label: "Medium",
    desc: "Standard FAANG / tier-1 difficulty",
    color: "var(--color-warning)",
    subtle: "var(--color-warning-subtle)",
  },
  {
    value: "HARD" as const,
    label: "Hard",
    desc: "Complex architecture & edge cases",
    color: "var(--color-error)",
    subtle: "var(--color-error-subtle)",
  },
];

export function InterviewSetupForm() {
  const [jobRole, setJobRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const resolvedRole = jobRole === "__custom__" ? customRole.trim() : jobRole;

  function toggleTopic(topic: string) {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
    if (fieldErrors.topics) setFieldErrors((prev) => ({ ...prev, topics: [] }));
  }

  function validate(): boolean {
    const errors: Record<string, string[]> = {};

    if (!resolvedRole || resolvedRole.length < 2) {
      errors.jobRole = ["Please select or enter a job role"];
    }
    if (selectedTopics.length === 0) {
      errors.topics = ["Select at least one topic or technology"];
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      const result = await createInterview({
        title: `${resolvedRole} Mock Interview`,
        jobRole: resolvedRole,
        difficulty,
        topics: selectedTopics,
      });

      if (result && !result.success) {
        setError(result.error || "Failed to create interview.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setIsLoading(false);
      }
      // On success, the server action redirects — no need to do anything
    } catch (err) {
      console.error("Interview creation error:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="setup-form">
      {error && (
        <div className="auth-alert auth-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Job Role ─── */}
      <div className="setup-section">
        <div className="setup-section-header">
          <h2 className="setup-section-title">Target Job Role</h2>
          <p className="setup-section-desc">
            Which role are you interviewing for?
          </p>
        </div>

        <div className="role-presets">
          {JOB_ROLE_PRESETS.map((role) => (
            <button
              key={role}
              type="button"
              className={`role-preset-btn ${jobRole === role ? "role-preset-btn--active" : ""}`}
              onClick={() => {
                setJobRole(role);
                setCustomRole("");
                if (fieldErrors.jobRole) setFieldErrors((prev) => ({ ...prev, jobRole: [] }));
              }}
            >
              {jobRole === role && <CheckCircle2 size={14} />}
              {role}
            </button>
          ))}
          <button
            type="button"
            className={`role-preset-btn ${jobRole === "__custom__" ? "role-preset-btn--active" : ""}`}
            onClick={() => setJobRole("__custom__")}
          >
            Custom Role...
          </button>
        </div>

        {jobRole === "__custom__" && (
          <input
            type="text"
            className="input"
            placeholder="e.g. Site Reliability Engineer"
            value={customRole}
            onChange={(e) => {
              setCustomRole(e.target.value);
              if (fieldErrors.jobRole) setFieldErrors((prev) => ({ ...prev, jobRole: [] }));
            }}
            autoFocus
            style={{ marginTop: "0.75rem" }}
          />
        )}

        {fieldErrors.jobRole?.[0] && (
          <p className="form-error">{fieldErrors.jobRole[0]}</p>
        )}
      </div>

      {/* ─── Difficulty ─── */}
      <div className="setup-section">
        <div className="setup-section-header">
          <h2 className="setup-section-title">Difficulty Level</h2>
          <p className="setup-section-desc">
            How challenging should the questions be?
          </p>
        </div>

        <div className="difficulty-grid">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`difficulty-card ${difficulty === d.value ? "difficulty-card--active" : ""}`}
              style={
                difficulty === d.value
                  ? { borderColor: d.color, background: d.subtle }
                  : {}
              }
              onClick={() => setDifficulty(d.value)}
            >
              <span
                className="difficulty-label"
                style={difficulty === d.value ? { color: d.color } : {}}
              >
                {d.label}
              </span>
              <span className="difficulty-desc">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Topics ─── */}
      <div className="setup-section">
        <div className="setup-section-header">
          <h2 className="setup-section-title">Topics & Tech Stack</h2>
          <p className="setup-section-desc">
            Select the technologies and areas you want to be tested on.{" "}
            {selectedTopics.length > 0 && (
              <span style={{ color: "var(--color-primary)", fontWeight: 500 }}>
                {selectedTopics.length} selected
              </span>
            )}
          </p>
        </div>

        <div className="topic-chips-grid">
          {TOPIC_OPTIONS.map((topic) => {
            const selected = selectedTopics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                className={`topic-select-chip ${selected ? "topic-select-chip--active" : ""}`}
                onClick={() => toggleTopic(topic)}
              >
                {selected && <CheckCircle2 size={13} />}
                {topic}
              </button>
            );
          })}
        </div>

        {fieldErrors.topics?.[0] && (
          <p className="form-error">{fieldErrors.topics[0]}</p>
        )}
      </div>

      {/* ─── Submit ─── */}
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", padding: "0.875rem", fontSize: "1rem" }}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={18} />
            <span>Creating Interview...</span>
          </>
        ) : (
          "Start Interview →"
        )}
      </button>
    </form>
  );
}
