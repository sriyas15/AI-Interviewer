"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronRight, Clock, Hash, Calendar } from "lucide-react";

type InterviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface InterviewSummary {
  id: string;
  title: string;
  jobRole: string;
  status: InterviewStatus;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  invitation?: {
    expiresAt: Date;
  } | null;
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

export function InterviewList({ interviews }: InterviewListProps) {
  return (
    <div className="interview-list">
      {interviews.map((interview) => {
        const status = statusConfig[interview.status];
        const timeAgo = formatDistanceToNow(new Date(interview.createdAt), {
          addSuffix: true,
        });

        const dueDate = interview.invitation?.expiresAt
          ? new Date(interview.invitation.expiresAt)
          : null;
        const isPastDue = dueDate ? dueDate.getTime() < Date.now() : false;

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
                  Assigned {timeAgo}
                </span>
                {dueDate && (
                  <span
                    className="meta-item"
                    style={{
                      color: isPastDue && interview.status !== "COMPLETED" ? "var(--color-error)" : undefined,
                    }}
                  >
                    <Calendar size={13} />
                    Due: {format(dueDate, "MMM d, yyyy")}
                    {isPastDue && interview.status !== "COMPLETED" ? " (Expired)" : ""}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

