import assert from "node:assert/strict";
import { validateInviteClaimEligibility, InvitationClaimData } from "../src/lib/invitation-claim";

export async function runInvitationClaimTests() {
  console.log("▶ Running Real Invitation Claim Tests (from src/lib/invitation-claim)...");

  const futureDate = new Date(Date.now() + 86400000);
  const pastDate = new Date(Date.now() - 86400000);

  const baseInvite: InvitationClaimData = {
    candidateEmail: "candidate@example.com",
    status: "INVITED",
    expiresAt: futureDate,
  };

  // 1. Valid matching email claim
  {
    const res = validateInviteClaimEligibility(baseInvite, "candidate@example.com");
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  }

  // 2. Case insensitive & trimmed email match
  {
    const res = validateInviteClaimEligibility(baseInvite, "  CANDIDATE@example.COM  ");
    assert.equal(res.valid, true);
  }

  // 3. Mismatched email security check
  {
    const res = validateInviteClaimEligibility(baseInvite, "intruder@malicious.com");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /issued to candidate@example\.com/);
  }

  // 4. Expired status
  {
    const expiredStatusInvite: InvitationClaimData = {
      ...baseInvite,
      status: "EXPIRED",
    };
    const res = validateInviteClaimEligibility(expiredStatusInvite, "candidate@example.com");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /expired/i);
  }

  // 5. Expired date
  {
    const expiredDateInvite: InvitationClaimData = {
      ...baseInvite,
      expiresAt: pastDate,
    };
    const res = validateInviteClaimEligibility(expiredDateInvite, "candidate@example.com");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /expired/i);
  }

  // 6. Revoked invitation
  {
    const revokedInvite: InvitationClaimData = {
      ...baseInvite,
      status: "REVOKED",
    };
    const res = validateInviteClaimEligibility(revokedInvite, "candidate@example.com");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /revoked/i);
  }

  // 7. Completed interview link blocked
  {
    const completedInvite: InvitationClaimData = {
      ...baseInvite,
      status: "COMPLETED",
    };
    const res = validateInviteClaimEligibility(completedInvite, "candidate@example.com");
    assert.equal(res.valid, false);
    assert.match(res.error || "", /already been completed/i);
  }

  console.log("  ✔ All Invitation Claim Tests Passed!");
}
