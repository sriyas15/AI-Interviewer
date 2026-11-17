import assert from "node:assert/strict";

/**
 * Follow-up State Machine Test Suite
 */

export class MockFollowUpStateMachine {
  private responses = new Map<string, { content: string; followUps: Array<{ prompt: string; answer: string }> }>();

  public submitInitialAnswer(questionId: string, answer: string): { success: boolean; error?: string } {
    if (this.responses.has(questionId)) {
      return { success: false, error: "An answer has already been submitted for this question." };
    }
    this.responses.set(questionId, { content: answer, followUps: [] });
    return { success: true };
  }

  public submitFollowUp(
    questionId: string,
    prompt: string,
    answer: string
  ): { success: boolean; shouldFollowUp: boolean; error?: string; followUpCount: number } {
    const existing = this.responses.get(questionId);
    if (!existing) {
      return { success: false, shouldFollowUp: false, error: "Question response not found.", followUpCount: 0 };
    }

    if (existing.followUps.length >= 2) {
      return {
        success: false,
        shouldFollowUp: false,
        error: "Maximum follow-ups (2) reached for this question.",
        followUpCount: existing.followUps.length,
      };
    }

    existing.followUps.push({ prompt, answer });
    const currentCount = existing.followUps.length;
    // Allow further follow up only if strictly under 2
    const canFollowUpAgain = currentCount < 2;

    return {
      success: true,
      shouldFollowUp: canFollowUpAgain,
      followUpCount: currentCount,
    };
  }

  public getFollowUpCount(questionId: string): number {
    return this.responses.get(questionId)?.followUps.length || 0;
  }
}

export async function runFollowUpTests() {
  console.log("▶ Running Follow-Up State Machine Tests...");

  const sm = new MockFollowUpStateMachine();
  const qId = "question-test-101";

  // 1. Initial answer
  const initialRes = sm.submitInitialAnswer(qId, "Initial architectural approach.");
  assert.equal(initialRes.success, true);

  // 2. Duplicate initial answer rejection
  const dupRes = sm.submitInitialAnswer(qId, "Duplicate submission attempt.");
  assert.equal(dupRes.success, false);
  assert.match(dupRes.error || "", /already been submitted/);

  // 3. First follow-up turn
  const f1 = sm.submitFollowUp(qId, "How would you handle caching invalidation?", "Using write-through cache.");
  assert.equal(f1.success, true);
  assert.equal(f1.followUpCount, 1);
  assert.equal(f1.shouldFollowUp, true, "First follow-up may still permit 1 more follow-up");

  // 4. Second follow-up turn (reaching max limit)
  const f2 = sm.submitFollowUp(qId, "What happens during network partitions?", "Fallback to stale cache with circuit breaker.");
  assert.equal(f2.success, true);
  assert.equal(f2.followUpCount, 2);
  assert.equal(f2.shouldFollowUp, false, "Second follow-up MUST terminate follow-up state (hard cap = 2)");

  // 5. Third follow-up turn attempt (must be blocked)
  const f3 = sm.submitFollowUp(qId, "Third inquiry", "Exceeding cap.");
  assert.equal(f3.success, false);
  assert.match(f3.error || "", /Maximum follow-ups \(2\) reached/);

  console.log("  ✔ All Follow-Up State Machine Tests Passed!");
}

