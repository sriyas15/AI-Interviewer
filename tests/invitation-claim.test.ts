import assert from "node:assert/strict";

/**
 * Invitation Claim and Authorization Test Suite
 */

interface MockInvitation {
  token: string;
  candidateEmail: string;
  status: "INVITED" | "STARTED" | "COMPLETED" | "EXPIRED" | "REVOKED";
  expiresAt: Date;
  interviewId?: string;
}

export function validateInviteClaim(
  invitation: MockInvitation,
  sessionEmail?: string | null
): { success: boolean; error?: string } {
  const now = new Date();

  if (invitation.status === "EXPIRED" || now > invitation.expiresAt) {
    return { success: false, error: "This invitation link has expired." };
  }

  if (invitation.status === "REVOKED") {
    return { success: false, error: "This invitation has been revoked." };
  }

  if (invitation.status === "COMPLETED") {
    return { success: false, error: "This interview has already been completed." };
  }

  if (sessionEmail) {
    const normSession = sessionEmail.toLowerCase().trim();
    const normCandidate = invitation.candidateEmail.toLowerCase().trim();
    if (normSession !== normCandidate) {
      return {
        success: false,
        error: `This invitation was issued to ${invitation.candidateEmail}. You are currently signed in as ${sessionEmail}. Please switch accounts or log out to continue.`,
      };
    }
  }

  return { success: true };
}

export async function runInvitationClaimTests() {
  console.log("▶ Running Invitation Claim & Authorization Tests...");

  const baseInvite: MockInvitation = {
    token: "valid-secure-token-123",
    candidateEmail: "candidate@example.com",
    status: "INVITED",
    expiresAt: new Date(Date.now() + 86400000), // tomorrow
  };

  // 1. Valid matching email claim
  const validClaim = validateInviteClaim(baseInvite, "candidate@example.com");
  assert.equal(validClaim.success, true);

  // 2. Case-insensitive and whitespace-trimmed email claim
  const mixedCaseClaim = validateInviteClaim(baseInvite, "  Candidate@Example.COM ");
  assert.equal(mixedCaseClaim.success, true);

  // 3. Email mismatch rejection
  const mismatchClaim = validateInviteClaim(baseInvite, "other.recruiter@example.com");
  assert.equal(mismatchClaim.success, false);
  assert.match(mismatchClaim.error || "", /This invitation was issued to candidate@example.com/);

  // 4. Expired status rejection
  const expiredInvite: MockInvitation = {
    ...baseInvite,
    status: "EXPIRED",
  };
  const expClaim = validateInviteClaim(expiredInvite, "candidate@example.com");
  assert.equal(expClaim.success, false);
  assert.match(expClaim.error || "", /invitation link has expired/);

  // 5. Past expiration date rejection
  const pastDateInvite: MockInvitation = {
    ...baseInvite,
    expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
  };
  const pastClaim = validateInviteClaim(pastDateInvite, "candidate@example.com");
  assert.equal(pastClaim.success, false);
  assert.match(pastClaim.error || "", /invitation link has expired/);

  // 6. Revoked status rejection
  const revokedInvite: MockInvitation = {
    ...baseInvite,
    status: "REVOKED",
  };
  const revClaim = validateInviteClaim(revokedInvite, "candidate@example.com");
  assert.equal(revClaim.success, false);
  assert.match(revClaim.error || "", /invitation has been revoked/);

  // 7. Completed status rejection
  const completedInvite: MockInvitation = {
    ...baseInvite,
    status: "COMPLETED",
  };
  const compClaim = validateInviteClaim(completedInvite, "candidate@example.com");
  assert.equal(compClaim.success, false);
  assert.match(compClaim.error || "", /interview has already been completed/);

  console.log("  ✔ All Invitation Claim Tests Passed!");
}

