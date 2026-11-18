/**
 * Pure scoring calculation functions used across AI grading, evaluations, and reports.
 */

export interface RubricScores {
  technical: number;
  problemSolving: number;
  communication: number;
  codeQuality?: number | null;
}

export interface RubricWeights {
  technical?: number;
  problemSolving?: number;
  communication?: number;
  codeQuality?: number;
}

export const DEFAULT_RUBRIC_WEIGHTS: Required<RubricWeights> = {
  technical: 40,
  problemSolving: 30,
  communication: 20,
  codeQuality: 10,
};

/**
 * Calculates progressive hint penalty:
 * 1 hint = 5% deduction
 * 2 hints = 10% deduction
 * 3+ hints = 15% deduction (capped)
 */
export function calculateHintPenalty(
  rawScore: number,
  hintsUsed: number
): { penaltyAmount: number; finalScore: number; penaltyFraction: number } {
  const numHints = Math.max(0, Math.min(3, Math.floor(hintsUsed || 0)));
  const penaltyFraction =
    numHints === 1 ? 0.05 : numHints === 2 ? 0.10 : numHints >= 3 ? 0.15 : 0;
  const penaltyAmount = Number((rawScore * penaltyFraction).toFixed(2));
  const finalScore = Math.max(0, Number((rawScore - penaltyAmount).toFixed(1)));
  return { penaltyAmount, finalScore, penaltyFraction };
}

/**
 * Computes overall composite score using configurable template rubric weights.
 */
export function computeWeightedOverallScore(
  scores: RubricScores,
  weights?: RubricWeights | null
): number {
  const effectiveWeights = {
    technical: weights?.technical ?? DEFAULT_RUBRIC_WEIGHTS.technical,
    problemSolving: weights?.problemSolving ?? DEFAULT_RUBRIC_WEIGHTS.problemSolving,
    communication: weights?.communication ?? DEFAULT_RUBRIC_WEIGHTS.communication,
    codeQuality: weights?.codeQuality ?? DEFAULT_RUBRIC_WEIGHTS.codeQuality,
  };

  const wTech = effectiveWeights.technical / 100;
  const wPS = effectiveWeights.problemSolving / 100;
  const wComm = effectiveWeights.communication / 100;
  const wCode = effectiveWeights.codeQuality / 100;

  const denom = (wTech + wPS + wComm + wCode) || 1;
  const codeVal = scores.codeQuality !== null && scores.codeQuality !== undefined
    ? scores.codeQuality
    : scores.technical;

  const weightedSum =
    scores.technical * wTech +
    scores.problemSolving * wPS +
    scores.communication * wComm +
    codeVal * wCode;

  return Math.min(100, Math.max(0, Math.round(weightedSum / denom)));
}

/**
 * Computes a 0-10 code correctness score from verified test cases, or returns null if not run.
 */
export function computeCodeCorrectnessScore(
  passed?: number | null,
  total?: number | null
): number | null {
  if (
    passed === null ||
    passed === undefined ||
    total === null ||
    total === undefined ||
    total <= 0
  ) {
    return null;
  }
  const ratio = Math.max(0, Math.min(1, passed / total));
  return Number((ratio * 10).toFixed(1));
}
