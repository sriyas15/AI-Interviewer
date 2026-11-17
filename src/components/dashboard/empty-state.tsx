"use client";

import Link from "next/link";
import { BrainCircuit, Plus } from "lucide-react";

interface EmptyStateProps {
  isAdmin?: boolean;
}

export function EmptyState({ isAdmin = false }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <BrainCircuit size={40} strokeWidth={1.25} />
      </div>
      <h3 className="empty-state-title">No Interview Sessions Yet</h3>
      <p className="empty-state-desc">
        {isAdmin
          ? "Configure a new interview to simulate questions and test the candidate assessment environment."
          : "You haven't completed any assessment sessions yet. Check the Assessment Invitations section above to begin your invited interviews."}
      </p>
      {isAdmin ? (
        <Link href="/interview/new" className="btn btn-primary">
          <Plus size={18} />
          <span>Start Your First Interview</span>
        </Link>
      ) : (
        <div className="text-xs text-[var(--text-tertiary)] mt-2">
          Assessment sessions will automatically appear here once started.
        </div>
      )}
    </div>
  );
}

