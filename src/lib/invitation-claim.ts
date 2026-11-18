/**
 * Pure functions governing invitation token claims, expiry validation, and candidate authorization.
 */

export interface InvitationClaimData {
  status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED" | "REVOKED" | string;
  expiresAt: Date;
  candidateEmail: string;
}

/**
 * Validates whether an invitation token is eligible to be claimed or viewed.
 */
export function validateInviteClaimEligibility(
  invitation: InvitationClaimData,
  sessionEmail?: string | null,
  now: Date = new Date()
): { valid: boolean; error?: string } {
  if (invitation.status === "EXPIRED" || now > invitation.expiresAt) {
    return { valid: false, error: "This invitation link has expired." };
  }

  if (invitation.status === "REVOKED") {
    return { valid: false, error: "This invitation has been revoked by the recruiter." };
  }

  if (invitation.status === "COMPLETED") {
    return { valid: false, error: "This interview has already been completed." };
  }

  if (sessionEmail) {
    const normSession = sessionEmail.toLowerCase().trim();
    const normCandidate = invitation.candidateEmail.toLowerCase().trim();
    if (normSession !== normCandidate) {
      return {
        valid: false,
        error: `This invitation was issued to ${invitation.candidateEmail}. You are currently signed in as ${sessionEmail}. Please switch accounts or log out to continue.`,
      };
    }
  }

  return { valid: true };
}
