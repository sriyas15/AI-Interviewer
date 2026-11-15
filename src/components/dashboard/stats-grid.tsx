import { BookOpen, CheckCircle2, Clock, ListChecks } from "lucide-react";

export type StatIconType = "book" | "check" | "clock" | "list";

export interface StatItem {
  label: string;
  value: number;
  iconType: StatIconType;
  color: "primary" | "success" | "warning" | "muted";
}

interface StatsGridProps {
  stats: StatItem[];
}

const iconMap = {
  book: BookOpen,
  check: CheckCircle2,
  clock: Clock,
  list: ListChecks,
};

const colorMap = {
  primary: {
    icon: "var(--color-primary)",
    bg: "var(--color-primary-subtle)",
  },
  success: {
    icon: "var(--color-success)",
    bg: "var(--color-success-subtle)",
  },
  warning: {
    icon: "var(--color-warning)",
    bg: "var(--color-warning-subtle)",
  },
  muted: {
    icon: "var(--text-tertiary)",
    bg: "rgba(107, 107, 128, 0.12)",
  },
};

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="stats-grid">
      {stats.map((stat) => {
        const Icon = iconMap[stat.iconType] || BookOpen;
        const colors = colorMap[stat.color];
        return (
          <div key={stat.label} className="stat-card card">
            <div
              className="stat-card-icon"
              style={{ background: colors.bg, color: colors.icon }}
            >
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value">{stat.value}</span>
              <span className="stat-card-label">{stat.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
