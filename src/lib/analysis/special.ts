import { Chess } from "chess.js";
import type { EvalLine, MoveLabel, SideToMove } from "../../types";
import { epFromWhite } from "./ep";
import type { ClassifiedMove, EvalInput } from "./classifier";

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_NAMES: Record<string, string> = {
  p: "Pion",
  n: "Kuda",
  b: "Gajah",
  r: "Benteng",
  q: "Menteri",
};

export interface SacrificeInfo {
  sacrificed: boolean;
  pieceName: string | null;
  netLoss: number;
}

function countMaterial(fen: string): Record<SideToMove, number> {
  const chess = new Chess(fen);
  const totals: Record<SideToMove, number> = { w: 0, b: 0 };
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq) totals[sq.color] += PIECE_VALUES[sq.type] ?? 0;
    }
  }
  return totals;
}

function countByType(fen: string, color: SideToMove): Record<string, number> {
  const chess = new Chess(fen);
  const counts: Record<string, number> = {};
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.color === color) counts[sq.type] = (counts[sq.type] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Detect a real piece sacrifice (GAME_REVIEW_SPEC §5, Brilliant).
 * Walks the engine PV from the AFTER position up to 4 plies, stopping
 * after the first quiet move. A sacrifice means the mover's NET material
 * (own minus opponent) drops by >= 2 — even trades cancel out.
 */
export function detectSacrifice(
  fenBefore: string,
  fenAfter: string,
  pvUci: string[],
  side: SideToMove,
): SacrificeInfo {
  const none: SacrificeInfo = { sacrificed: false, pieceName: null, netLoss: 0 };
  let before: Record<SideToMove, number>;
  try {
    before = countMaterial(fenBefore);
  } catch {
    return none;
  }

  let chess: Chess;
  try {
    chess = new Chess(fenAfter);
  } catch {
    return none;
  }
  const opp = side === "w" ? "b" : "w";
  let plies = 0;
  for (const u of pvUci.slice(0, 4)) {
    let played;
    try {
      played = chess.move({
        from: u.slice(0, 2),
        to: u.slice(2, 4),
        promotion: u.length > 4 ? u.slice(4) : undefined,
      });
    } catch {
      break;
    }
    plies++;
    if (!played.isCapture()) break;
  }
  if (plies === 0) return none;

  const after = countMaterial(chess.fen());
  const netLoss = before[side] - after[side] - (before[opp] - after[opp]);
  if (netLoss < 2) return { sacrificed: false, pieceName: null, netLoss };

  let pieceName: string | null = null;
  let biggest = 0;
  let typesBefore: Record<string, number>;
  try {
    typesBefore = countByType(fenBefore, side);
  } catch {
    return { sacrificed: true, pieceName: null, netLoss };
  }
  const typesAfter = countByType(chess.fen(), side);
  for (const [type, count] of Object.entries(typesBefore)) {
    const drop = (count - (typesAfter[type] ?? 0)) * (PIECE_VALUES[type] ?? 0);
    if (drop > biggest) {
      biggest = drop;
      pieceName = PIECE_NAMES[type] ?? null;
    }
  }
  return { sacrificed: true, pieceName, netLoss };
}

function moverEp(lines: EvalLine[], side: SideToMove): number | null {
  const first = lines[0];
  if (!first) return null;
  const cp = first.cp !== undefined ? (side === "w" ? first.cp : -first.cp) : undefined;
  const mate = first.mate !== undefined ? (side === "w" ? first.mate : -first.mate) : undefined;
  return epFromWhite(cp ?? null, mate ?? null);
}

/** Great static preconditions (GAME_REVIEW_SPEC §5, Great). */
export function isGreatCandidate(
  baseLabel: MoveLabel,
  epBefore: number,
  beforeLines: EvalLine[],
  side: SideToMove,
): boolean {
  if (baseLabel !== "best") return false;
  if (epBefore > 0.95) return false;
  if (beforeLines.length < 2) return false;
  const second = moverEp([beforeLines[1]], side);
  if (second === null) return false;
  return epBefore - second >= 0.15;
}

/** Brilliant static preconditions (sacrifice + still fine). Deep confirm still required. */
export function isBrilliantCandidate(
  baseEpLoss: number,
  epBefore: number,
  epAfter: number,
  fenBefore: string,
  fenAfter: string,
  afterPv: string[],
  side: SideToMove,
): boolean {
  if (baseEpLoss > 0.02) return false;
  if (epAfter < 0.45) return false;
  if (epBefore > 0.9) return false;
  return detectSacrifice(fenBefore, fenAfter, afterPv, side).sacrificed;
}

export interface SpecialContext {
  base: ClassifiedMove;
  before: EvalInput;
  after: EvalInput;
  fenBefore: string;
  fenAfter: string;
  prevEpLoss: number | null;
  side: SideToMove;
}

export interface SpecialOverride {
  label: MoveLabel;
  reason: string;
  /** True when the label needs a deep re-check before it counts. */
  needsRecheck: boolean;
}

/**
 * Special-label overrides, evaluated after base labels.
 * Priority: brilliant, then great, then miss (miss never collides:
 * it only applies to inaccuracy/mistake).
 */
export function applySpecial(ctx: SpecialContext): SpecialOverride | null {
  const { base, before, after, fenBefore, fenAfter, prevEpLoss, side } = ctx;

  if (
    (base.label === "best" || base.label === "excellent") &&
    isBrilliantCandidate(
      base.epLoss,
      base.epBefore,
      base.epAfter,
      fenBefore,
      fenAfter,
      after.lines[0]?.pv ?? [],
      side,
    )
  ) {
    const sac = detectSacrifice(
      fenBefore,
      fenAfter,
      after.lines[0]?.pv ?? [],
      side,
    );
    const standing = base.epAfter >= 0.5 ? "unggul" : "seimbang";
    return {
      label: "brilliant",
      reason: sac.pieceName
        ? `Mengorbankan ${sac.pieceName} dan tetap ${standing}.`
        : `Pengorbanan bidak yang baik dan tetap ${standing}.`,
      needsRecheck: true,
    };
  }

  if (isGreatCandidate(base.label, base.epBefore, before.lines, side)) {
    return {
      label: "great",
      reason: "Satu-satunya langkah yang menjaga posisi.",
      needsRecheck: true,
    };
  }

  if (
    (base.label === "inaccuracy" || base.label === "mistake") &&
    prevEpLoss !== null &&
    prevEpLoss >= 0.1
  ) {
    return {
      label: "miss",
      reason: "Lawan melakukan kesalahan, tetapi peluang tidak dimanfaatkan.",
      needsRecheck: false,
    };
  }

  return null;
}
