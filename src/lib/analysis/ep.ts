/**
 * Expected Points (0..1) from a White-perspective score.
 * GAME_REVIEW_SPEC §2. Mate is decisive; otherwise the logistic curve.
 */
export function epFromWhite(cp: number | null, mate: number | null): number {
  if (mate !== null && mate !== undefined) return mate > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-0.00368208 * (cp ?? 0)));
}
