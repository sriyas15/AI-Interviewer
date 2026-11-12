"use client";

import Link from "next/link";
import { BrainCircuit, Plus } from "lucide-react";

export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <BrainCircuit size={40} strokeWidth={1.25} />
      </div>
      <h3 className="empty-state-title">No Interview Sessions Yet</h3>
      <p className="empty-state-desc">
        Start your first AI-powered mock interview to practice technical
        concepts, coding problems, and behavioral questions.
      </p>
      <Link href="/interview/new" className="btn btn-primary">
        <Plus size={18} />
        <span>Start Your First Interview</span>
      </Link>
    </div>
  );
}
