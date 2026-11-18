import assert from "node:assert/strict";
import {
  MAX_FOLLOW_UPS_PER_QUESTION,
  evaluateFollowUpEligibility,
  buildCombinedFollowUpTranscript,
} from "../src/lib/follow-up";

export async function runFollowUpTests() {
  console.log("▶ Running Real Follow-Up State Machine Tests (from src/lib/follow-up)...");

  // 1. Initial State: 0 follow ups
  {
    const res = evaluateFollowUpEligibility(0);
    assert.equal(res.canFollowUp, true);
    assert.equal(res.error, undefined);
  }

  // 2. Second State: 1 follow up completed
  {
    const res = evaluateFollowUpEligibility(1);
    assert.equal(res.canFollowUp, true);
  }

  // 3. Max State: 2 follow ups reached
  {
    const res = evaluateFollowUpEligibility(2);
    assert.equal(res.canFollowUp, false);
    assert.match(res.error || "", /Maximum follow-ups/);
  }

  // 4. Over Max State: 3 follow ups
  {
    const res = evaluateFollowUpEligibility(3);
    assert.equal(res.canFollowUp, false);
  }

  // 5. Transcript builder
  {
    const transcript = buildCombinedFollowUpTranscript("Initial answer about binary trees", [
      { prompt: "What is the time complexity?", answer: "O(log n) for balanced" },
      { prompt: "What if it degrades into a linked list?", answer: "O(n) worst case" },
    ]);

    assert.match(transcript, /\[Initial Response\]/);
    assert.match(transcript, /Initial answer about binary trees/);
    assert.match(transcript, /\[Follow-Up Turn 1 - Question\]/);
    assert.match(transcript, /O\(log n\) for balanced/);
    assert.match(transcript, /\[Follow-Up Turn 2 - Candidate Answer\]/);
    assert.match(transcript, /O\(n\) worst case/);
  }

  console.log("  ✔ All Follow-Up State Machine Tests Passed!");
}
