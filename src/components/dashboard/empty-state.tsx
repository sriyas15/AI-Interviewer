"use client";

import { Mail } from "lucide-react";

export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Mail size={40} strokeWidth={1.25} />
      </div>
      <h3 className="empty-state-title">No Invitations Yet</h3>
      <p className="empty-state-desc">
        No invitations yet. Check your email for an assessment invitation link from your recruiter.
      </p>
    </div>
  );
}

