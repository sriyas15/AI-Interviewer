/**
 * Pure functions governing the interview follow-up state machine.
 */

export const MAX_FOLLOW_UPS_PER_QUESTION = 2;

export interface FollowUpTurn {
  prompt: string;
  answer: string;
}

/**
 * Checks whether an additional follow-up question can be asked.
 */
export function evaluateFollowUpEligibility(
  currentFollowUpCount: number,
  maxFollowUps: number = MAX_FOLLOW_UPS_PER_QUESTION
): { canFollowUp: boolean; error?: string } {
  if (currentFollowUpCount >= maxFollowUps) {
    return {
      canFollowUp: false,
      error: `Maximum follow-ups (${maxFollowUps}) reached for this question.`,
    };
  }
  return { canFollowUp: true };
}

/**
 * Compiles initial answer and subsequent follow-up turns into a single unified transcript for AI grading.
 */
export function buildCombinedFollowUpTranscript(
  initialResponse: string,
  followUpTurns: FollowUpTurn[]
): string {
  const parts = [`[Initial Response]:\n${initialResponse.trim() || "(No verbal answer provided)"}`];

  followUpTurns.forEach((turn, idx) => {
    parts.push(
      `[Follow-Up Turn ${idx + 1} - Question]:\n${turn.prompt.trim()}`,
      `[Follow-Up Turn ${idx + 1} - Candidate Answer]:\n${turn.answer.trim() || "(No answer provided)"}`
    );
  });

  return parts.join("\n\n");
}
