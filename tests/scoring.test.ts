import assert from "node:assert/strict";

/**
 * Formula test suite: Hint penalty and weighted rubric scoring
 */

export function calculateHintPenalty(rawScore: number, hintsUsed: number): { penaltyAmount: number; finalScore: number } {
  const numHints = Math.max(0, Math.min(3, hintsUsed));
  const penaltyFraction = numHints === 1 ? 0.05 : numHints === 2 ? 0.10 : numHints >= 3 ? 0.15 : 0;
  const penaltyAmount = Number((rawScore * penaltyFraction).toFixed(2));
  const finalScore = Math.max(0, Number((rawScore - penaltyAmount).toFixed(1)));
  return { penaltyAmount, finalScore };
}

export function computeWeightedOverallScore(
  scores: { technical: number; problemSolving: number; communication: number; codeQuality?: number },
  weights: { technical: number; problemSolving: number; communication: number; codeQuality: number }
): number {
  const wTech = weights.technical / 100;
  const wPS = weights.problemSolving / 100;
  const wComm = weights.communication / 100;
  const wCode = weights.codeQuality / 100;
  const denom = (wTech + wPS + wComm + wCode) || 1;
  const code = scores.codeQuality ?? scores.technical;
  return Math.round((scores.technical * wTech + scores.problemSolving * wPS + scores.communication * wComm + code * wCode) / denom);
}

export async function runScoringTests() {
  console.log("▶ Running Scoring Formula Tests...");

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

    // Bound test: more than 3 hints should cap penalty at 15%
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

    // Heavy coding weight rubric
    const codingWeights = { technical: 20, problemSolving: 20, communication: 10, codeQuality: 50 };
    // Expected: 80*0.2 + 90*0.2 + 70*0.1 + 85*0.5 = 16 + 18 + 7 + 42.5 = 83.5 -> Math.round = 84
    const codingOverall = computeWeightedOverallScore(scores, codingWeights);
    assert.equal(codingOverall, 84, "Custom template rubric weights must be accurately applied");
  }

  console.log("  ✔ All Scoring Formula Tests Passed!");
}
