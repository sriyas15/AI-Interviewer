// ─────────────────────────────────────────────────────────────
// Application Constants
// ─────────────────────────────────────────────────────────────

export const APP_NAME = "AI Interviewer";
export const APP_DESCRIPTION =
  "AI-powered interview platform for practicing technical interviews with real-time feedback.";

// ─── Interview Config ────────────────────────────────────────

export const MAX_QUESTIONS_PER_INTERVIEW = 10;
export const MIN_QUESTIONS_PER_INTERVIEW = 3;
export const DEFAULT_QUESTIONS_COUNT = 5;

export const JOB_ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Data Engineer",
  "Mobile Developer",
  "Machine Learning Engineer",
  "Software Architect",
] as const;

export const TOPIC_OPTIONS = [
  // Frontend
  "React",
  "Next.js",
  "TypeScript",
  "JavaScript",
  "HTML/CSS",
  "State Management",
  "Performance Optimization",
  // Backend
  "Node.js",
  "REST APIs",
  "GraphQL",
  "Authentication",
  "Database Design",
  "Caching",
  "Message Queues",
  // General
  "System Design",
  "Data Structures",
  "Algorithms",
  "Design Patterns",
  "Testing",
  "CI/CD",
  "Docker",
  "Cloud Services",
  "Security",
  "Microservices",
] as const;

export const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
] as const;

// ─── Difficulty Labels ───────────────────────────────────────

export const DIFFICULTY_CONFIG = {
  EASY: {
    label: "Easy",
    color: "var(--color-success)",
    description: "Junior level questions",
  },
  MEDIUM: {
    label: "Medium",
    color: "var(--color-warning)",
    description: "Mid-level questions",
  },
  HARD: {
    label: "Hard",
    color: "var(--color-error)",
    description: "Senior level questions",
  },
} as const;

// ─── Status Labels ───────────────────────────────────────────

export const STATUS_CONFIG = {
  PENDING: { label: "Pending", color: "var(--color-muted)" },
  IN_PROGRESS: { label: "In Progress", color: "var(--color-primary)" },
  COMPLETED: { label: "Completed", color: "var(--color-success)" },
  CANCELLED: { label: "Cancelled", color: "var(--color-error)" },
} as const;
