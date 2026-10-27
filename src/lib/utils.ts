// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

import { clsx, type ClassValue } from "clsx";

/**
 * Merge CSS class names conditionally.
 * Uses `clsx` for conditional classes.
 *
 * Usage:
 *   cn("base-class", isActive && "active", className)
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a date to a human-readable string.
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format a duration in milliseconds to a readable string.
 * e.g., 125000 → "2m 5s"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Map a score (0-100) to a color for visual feedback.
 */
export function scoreToColor(score: number): string {
  if (score >= 80) return "var(--color-success)";
  if (score >= 60) return "var(--color-warning)";
  return "var(--color-error)";
}

/**
 * Map a score (0-100) to a text label.
 */
export function scoreToLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Very Good";
  if (score >= 70) return "Good";
  if (score >= 60) return "Satisfactory";
  if (score >= 50) return "Needs Improvement";
  return "Poor";
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Generate initials from a name (for avatars).
 * e.g., "John Doe" → "JD"
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Sleep for a given number of milliseconds.
 * Useful for adding delays in async flows.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
