import assert from "node:assert/strict";
import {
  calculateHintPenalty,
  computeWeightedOverallScore,
  computeCodeCorrectnessScore,
} from "../src/lib/scoring";

export async function runScoringTests() {
  console.log("▶ Running Real Scoring Formula Tests (from src/lib/scoring)...");

  // 1. Hint Penalty Tests
  {
    const noHints = calculateHintPenalty(8.0, 0);
    assert.equal(noHints.penaltyAmount, 0);
    assert.equal(noHints.finalScore, 8.0, "0 hints should incur 0 penalty");

    const oneHint = calculateHintPenalty(8.0, 1);
    assert.equal(oneHint.penaltyAmount, 0.4);
    assert.equal(oneHint.finalScore, 7.6, "1 hint should apply 5% penalty (0.4 pts)");

    const twoHints = calculateHintPenalty(10.0, 2);
    assert.equal(twoHints.penaltyAmount, 1.0);
    assert.equal(twoHints.finalScore, 9.0, "2 hints should apply 10% penalty (1.0 pt)");

    const threeHints = calculateHintPenalty(10.0, 3);
    assert.equal(threeHints.penaltyAmount, 1.5);
    assert.equal(threeHints.finalScore, 8.5, "3 hints should apply 15% penalty (1.5 pts)");

    // Bound test: >3 hints capped at 15%
    const fourHints = calculateHintPenalty(10.0, 5);
    assert.equal(fourHints.penaltyAmount, 1.5, "Exceeding 3 hints should cap penalty at 15%");
    assert.equal(fourHints.finalScore, 8.5);

    // Negative hint edge case
    const negHints = calculateHintPenalty(7.0, -2);
    assert.equal(negHints.penaltyAmount, 0);
    assert.equal(negHints.finalScore, 7.0);
  }

  // 2. Weighted Rubric Scoring Tests
  {
    const scores = { technical: 80, problemSolving: 90, communication: 70, codeQuality: 85 };
    const defaultWeights = { technical: 40, problemSolving: 30, communication: 20, codeQuality: 10 };
    // Expected: 80*0.4 + 90*0.3 + 70*0.2 + 85*0.1 = 32 + 27 + 14 + 8.5 = 81.5 -> Math.round = 82
    const overall = computeWeightedOverallScore(scores, defaultWeights);
    assert.equal(overall, 82, "Rubric weighted overall score should match formula");

    // Custom weights
    const codingWeights = { technical: 20, problemSolving: 20, communication: 10, codeQuality: 50 };
    // Expected: 80*0.2 + 90*0.2 + 70*0.1 + 85*0.5 = 16 + 18 + 7 + 42.5 = 83.5 -> Math.round = 84
    const codingOverall = computeWeightedOverallScore(scores, codingWeights);
    assert.equal(codingOverall, 84, "Custom template rubric weights must be accurately applied");

    // Null code quality fallback
    const nullCodeScore = computeWeightedOverallScore(
      { technical: 80, problemSolving: 90, communication: 70, codeQuality: null },
      defaultWeights
    );
    assert.equal(nullCodeScore, 81, "Null code quality should fall back cleanly");
  }

  // 3. Code Correctness Score Tests
  {
    assert.equal(computeCodeCorrectnessScore(null, null), null);
    assert.equal(computeCodeCorrectnessScore(undefined, 5), null);
    assert.equal(computeCodeCorrectnessScore(0, 0), null);
    assert.equal(computeCodeCorrectnessScore(5, 5), 10.0);
    assert.equal(computeCodeCorrectnessScore(3, 4), 7.5);
    assert.equal(computeCodeCorrectnessScore(0, 5), 0.0);
  }

  console.log("  ✔ All Scoring Formula Tests Passed!");
}
