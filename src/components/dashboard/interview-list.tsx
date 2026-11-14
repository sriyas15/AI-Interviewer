"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, Clock, Hash, Layers } from "lucide-react";

type InterviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Difficulty = "EASY" | "MEDIUM" | "HARD";

interface InterviewSummary {
  id: string;
  title: string;
  jobRole: string;
  difficulty: Difficulty;
  topics: string[];
  status: InterviewStatus;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  _count: { questions: number };
}

interface InterviewListProps {
  interviews: InterviewSummary[];
}

const statusConfig: Record<
  InterviewStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Ready to Start",
    className: "badge-muted",
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "badge-warning",
  },
  COMPLETED: {
    label: "Submitted",
    className: "badge-success",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "badge-error",
  },
};

const difficultyConfig: Record<
  Difficulty,
  { label: string; className: string }
> = {
  EASY: { label: "Easy", className: "badge-success" },
  MEDIUM: { label: "Medium", className: "badge-warning" },
  HARD: { label: "Hard", className: "badge-error" },
};

export function InterviewList({ interviews }: InterviewListProps) {
  return (
    <div className="interview-list">
      {interviews.map((interview) => {
        const status = statusConfig[interview.status];
        const difficulty = difficultyConfig[interview.difficulty];
        const timeAgo = formatDistanceToNow(new Date(interview.createdAt), {
          addSuffix: true,
        });

        return (
          <Link
            key={interview.id}
            href={
              interview.status === "PENDING"
                ? `/interview/${interview.id}/start`
                : interview.status === "IN_PROGRESS"
                  ? `/interview/${interview.id}`
                  : `/interview/${interview.id}/report`
            }
            className="interview-card card"
          >
            <div className="interview-card-main">
              <div className="interview-card-top">
                <div className="interview-card-badges">
                  <span className={`badge ${difficulty.className}`}>
                    {difficulty.label}
                  </span>
                  <span className={`badge ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <ChevronRight
                  size={18}
                  style={{ color: "var(--text-tertiary)", flexShrink: 0 }}
                />
              </div>

              <h3 className="interview-card-title">{interview.jobRole}</h3>

              <div className="interview-card-meta">
                {interview._count.questions > 0 && (
                  <span className="meta-item">
                    <Hash size={13} />
                    {interview._count.questions} question
                    {interview._count.questions !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="meta-item">
                  <Clock size={13} />
                  {timeAgo}
                </span>
              </div>

              {interview.topics.length > 0 && (
                <div className="interview-card-topics">
                  <Layers size={13} style={{ color: "var(--text-tertiary)" }} />
                  {interview.topics.slice(0, 4).map((topic) => (
                    <span key={topic} className="topic-chip">
                      {topic}
                    </span>
                  ))}
                  {interview.topics.length > 4 && (
                    <span className="topic-chip topic-chip-more">
                      +{interview.topics.length - 4}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

