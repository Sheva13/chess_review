import { Chess } from "chess.js";
import type { EvalLine, MoveLabel, SideToMove } from "../../types";
import { epFromWhite } from "./ep";

/** Bump on every threshold or rule change, then reclassify old games. */
export const CLASSIFIER_VERSION = "1";

export interface MoveInput {
  ply: number;
  san: string;
  uci: string;
  color: SideToMove;
}

export interface EvalInput {
  lines: EvalLine[];
  bestUci: string | null;
  terminal: string | null;
}

export interface ClassifiedMove {
  ply: number;
  san: string;
  uci: string;
  label: MoveLabel;
  epLoss: number;
  epBefore: number;
  epAfter: number;
  bestUci: string | null;
  reason: string;
}

export interface ReviewSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: Record<MoveLabel, number>;
  classifierVersion: string;
}

/** Expected points from the mover's perspective. */
export function epForMover(
  terminal: string | null,
  lines: EvalLine[],
  side: SideToMove,
): number {
  if (terminal === "checkmate") return 1;
  if (terminal === "stalemate" || terminal === "draw") return 0.5;
  const first = lines[0];
  if (!first) return 0.5;
  const cp = first.cp !== undefined ? (side === "w" ? first.cp : -first.cp) : undefined;
  const mate = first.mate !== undefined ? (side === "w" ? first.mate : -first.mate) : undefined;
  return epFromWhite(cp ?? null, mate ?? null);
}

/** Base labels, top-down, first match wins (GAME_REVIEW_SPEC §4). */
export function labelForLoss(epLoss: number, playedIsBest: boolean): MoveLabel {
  if (playedIsBest || epLoss <= 0.005) return "best";
  if (epLoss <= 0.02) return "excellent";
  if (epLoss <= 0.05) return "good";
  if (epLoss <= 0.1) return "inaccuracy";
  if (epLoss <= 0.2) return "mistake";
  return "blunder";
}

/** Per-move accuracy 0..100 from win-probability loss (GAME_REVIEW_SPEC §6). */
export function moveAccuracy(epBest: number, epAfter: number): number {
  const winLoss = Math.max(0, 100 * (epBest - epAfter));
  const raw = 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669;
  return Math.min(100, Math.max(0, raw));
}

function bestSan(fenBefore: string, bestUci: string | null): string | null {
  if (!bestUci) return null;
  try {
    const chess = new Chess(fenBefore);
    const san = chess.move({
      from: bestUci.slice(0, 2),
      to: bestUci.slice(2, 4),
      promotion: bestUci.length > 4 ? bestUci.slice(4) : undefined,
    }).san;
    return san;
  } catch {
    return bestUci;
  }
}

function reasonFor(
  label: MoveLabel,
  epLoss: number,
  playedIsBest: boolean,
  best: string | null,
): string {
  switch (label) {
    case "best":
      return playedIsBest
        ? "Langkah terbaik menurut engine."
        : "Setara dengan langkah terbaik engine.";
    case "excellent":
      return "Hampir sempurna, selisih tipis dari langkah terbaik.";
    case "good":
      return "Langkah baik.";
    case "inaccuracy":
    case "mistake":
    case "blunder": {
      const pct = Math.round(epLoss * 100);
      return best
        ? `Kehilangan ${pct}% peluang menang. Lebih baik: ${best}.`
        : `Kehilangan ${pct}% peluang menang.`;
    }
    case "miss":
      return "Lawan melakukan kesalahan, tetapi peluang tidak dimanfaatkan.";
    default:
      // brilliant/great/book are assigned in Fase 4b with their own reasons.
      return "Langkah tercatat.";
  }
}

export function classifyMove(
  move: MoveInput,
  before: EvalInput,
  after: EvalInput,
  fenBefore: string,
  prevEpLoss: number | null = null,
): ClassifiedMove {
  const epBest = epForMover(null, before.lines, move.color);
  const epAfter = epForMover(after.terminal, after.lines, move.color);
  const playedIsBest =
    before.bestUci != null && move.uci.slice(0, 4) === before.bestUci.slice(0, 4);

  let epLoss = playedIsBest ? 0 : Math.max(0, epBest - epAfter);
  let label = labelForLoss(epLoss, playedIsBest);

  // Missed chance after an opponent error needs no engine to confirm.
  if (
    (label === "inaccuracy" || label === "mistake") &&
    prevEpLoss !== null &&
    prevEpLoss >= 0.1
  ) {
    label = "miss";
  }

  // Spec §9: the move that delivers checkmate is Best, period.
  if (after.terminal === "checkmate") {
    label = "best";
    epLoss = 0;
  }

  const best = bestSan(fenBefore, before.bestUci);
  return {
    ply: move.ply,
    san: move.san,
    uci: move.uci,
    label,
    epLoss,
    epBefore: epBest,
    epAfter,
    bestUci: before.bestUci,
    reason: reasonFor(label, epLoss, playedIsBest, best),
  };
}

function emptyCounts(): Record<MoveLabel, number> {
  return {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
  };
}

export function classifyGame(
  moves: MoveInput[],
  evalsByPly: Record<number, EvalInput>,
  fensBefore: Record<number, string>,
): { classes: ClassifiedMove[]; summary: ReviewSummary } {
  const classes: ClassifiedMove[] = [];
  for (const m of moves) {
    const before = evalsByPly[m.ply - 1] ?? { lines: [], bestUci: null, terminal: null };
    const after = evalsByPly[m.ply] ?? { lines: [], bestUci: null, terminal: null };
    const prevLoss = classes.length > 0 ? classes[classes.length - 1].epLoss : null;
    classes.push(classifyMove(m, before, after, fensBefore[m.ply] ?? "", prevLoss));
  }
  return { classes, summary: summarize(classes.map((c, i) => ({ ...c, color: moves[i].color }))) };
}

/** Rebuild the summary from final rows (e.g. after deep re-checks). */
export function summarize(
  rows: Array<{ label: MoveLabel; epBefore: number; epAfter: number; color: SideToMove }>,
): ReviewSummary {
  const acc: Record<SideToMove, number[]> = { w: [], b: [] };
  const counts = emptyCounts();
  for (const r of rows) {
    acc[r.color].push(moveAccuracy(r.epBefore, r.epAfter));
    counts[r.label]++;
  }
  const mean = (xs: number[]) =>
    xs.length === 0 ? 100 : xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    whiteAccuracy: Math.round(mean(acc.w)),
    blackAccuracy: Math.round(mean(acc.b)),
    counts,
    classifierVersion: CLASSIFIER_VERSION,
  };
}
