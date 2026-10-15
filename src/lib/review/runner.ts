import { Chess } from "chess.js";
import { parsePgn } from "../chess";
import {
  clearPositionEvals,
  countPositionEvals,
  getGame,
  getMoveClasses,
  getPositionEvals,
  saveMoveClasses,
  savePositionEval,
  updateGameReview,
} from "../db";
import type { EvalLine, MoveLabel, SideToMove } from "../../types";
import { EngineBusyError, EngineFailedError, getEngine } from "../engine/manager";
import type { PositionEval } from "../../types";
import {
  CLASSIFIER_VERSION,
  classifyGame,
  classifyMove,
  summarize,
} from "../analysis/classifier";
import type { EvalInput } from "../analysis/classifier";
import {
  applySpecial,
  isBrilliantCandidate,
  isGreatCandidate,
} from "../analysis/special";

export type TerminalKind = "checkmate" | "stalemate" | "draw";

export interface ReviewPosition {
  ply: number;
  fen: string;
  terminal: TerminalKind | null;
}

export type ReviewEvent =
  | { type: "progress"; done: number; total: number }
  | { type: "position"; ply: number; lines: EvalLine[]; bestUci: string | null }
  | { type: "done"; summary: string | null }
  | { type: "cancelled"; done: number }
  | { type: "error"; code: string; message: string };

type Listener = (ev: ReviewEvent) => void;

const subscribers = new Map<number, Set<Listener>>();
let active: { gameId: number; cancelled: boolean } | null = null;

export function reviewStatus(): { gameId: number } | null {
  return active ? { gameId: active.gameId } : null;
}

export function subscribe(gameId: number, listener: Listener): () => void {
  let set = subscribers.get(gameId);
  if (!set) {
    set = new Set();
    subscribers.set(gameId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) subscribers.delete(gameId);
  };
}

function emit(gameId: number, ev: ReviewEvent): void {
  const set = subscribers.get(gameId);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(ev);
    } catch {
      // A broken listener must not kill the review.
    }
  }
}

function terminalOf(chess: Chess): TerminalKind | null {
  if (chess.isCheckmate()) return "checkmate";
  if (chess.isStalemate()) return "stalemate";
  if (chess.isDraw()) return "draw";
  return null;
}

/** N+1 positions by replaying the game (history enables repetition draws). */
export function buildPositions(pgn: string): ReviewPosition[] {
  const game = parsePgn(pgn);
  const chess = new Chess(game.startFen);
  const positions: ReviewPosition[] = [
    { ply: 0, fen: chess.fen(), terminal: terminalOf(chess) },
  ];
  for (const move of game.moves) {
    chess.move(move.san);
    positions.push({ ply: move.ply, fen: chess.fen(), terminal: terminalOf(chess) });
  }
  return positions;
}

/** Request cancellation of the running review (partial results resolve). */
export function cancelReview(gameId: number): boolean {
  if (!active || active.gameId !== gameId) return false;
  active.cancelled = true;
  getEngine().cancel();
  return true;
}

class ReviewCancelled extends Error {}

/**
 * Classify a reviewed game from stored evals (no engine needed)
 * and persist labels + summary. Shared by the runner and reclassify.
 */
export function classifyAndSave(gameId: number): void {
  const game = getGame(gameId);
  if (!game) throw new Error(`Game ${gameId} not found.`);
  const parsed = parsePgn(game.pgn);
  const evalsByPly: Record<number, EvalInput> = {};
  for (const e of getPositionEvals(gameId)) {
    evalsByPly[e.ply] = { lines: e.lines, bestUci: e.best_uci, terminal: e.terminal };
  }
  const fensBefore: Record<number, string> = {};
  const inputs = parsed.moves.map((m) => {
    fensBefore[m.ply] = m.fenBefore;
    return { ply: m.ply, san: m.san, uci: m.from + m.to, color: m.color };
  });
  const { classes, summary } = classifyGame(inputs, evalsByPly, fensBefore);
  saveMoveClasses(
    gameId,
    classes.map((c) => ({
      ply: c.ply,
      san: c.san,
      uci: c.uci,
      label: c.label,
      epLoss: c.epLoss,
      epBefore: c.epBefore,
      epAfter: c.epAfter,
      bestUci: c.bestUci,
      reason: c.reason,
      meta: null,
    })),
  );
  updateGameReview(gameId, {
    classifier_version: CLASSIFIER_VERSION,
    summary: JSON.stringify(summary),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function recheckMs(): number {
  const raw = Number(process.env.RECHECK_MOVETIME_MS ?? 3000);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3000;
}

interface RecheckCandidate {
  ply: number;
  san: string;
  uci: string;
  color: SideToMove;
  fenBefore: string;
  fenAfter: string;
  prevEpLoss: number | null;
}

/**
 * Deep re-check (GAME_REVIEW_SPEC §7) for rare labels and big blunders.
 * Runs after the base pass: re-searches before+after positions deeply,
 * recomputes the label, and upgrades to brilliant/great when confirmed.
 * Rows are stamped with meta.rechecked.
 */
export async function classifyWithRecheck(
  gameId: number,
  isCancelled: () => boolean,
): Promise<void> {
  const game = getGame(gameId);
  if (!game) throw new Error(`Game ${gameId} not found.`);
  const parsed = parsePgn(game.pgn);
  const evalsByPly: Record<number, EvalInput> = {};
  for (const e of getPositionEvals(gameId)) {
    evalsByPly[e.ply] = { lines: e.lines, bestUci: e.best_uci, terminal: e.terminal };
  }

  const candidates: RecheckCandidate[] = [];
  let prevLoss: number | null = null;
  for (const m of parsed.moves) {
    const before = evalsByPly[m.ply - 1] ?? { lines: [], bestUci: null, terminal: null };
    const after = evalsByPly[m.ply] ?? { lines: [], bestUci: null, terminal: null };
    const base = classifyMove(
      { ply: m.ply, san: m.san, uci: m.from + m.to, color: m.color },
      before,
      after,
      m.fenBefore,
      prevLoss,
    );
    prevLoss = base.epLoss;
    if (base.label === "blunder") {
      candidates.push({
        ply: m.ply, san: m.san, uci: m.from + m.to, color: m.color,
        fenBefore: m.fenBefore, fenAfter: m.fenAfter, prevEpLoss: null,
      });
      continue;
    }
    if (
      (base.label === "best" || base.label === "excellent") &&
      (isBrilliantCandidate(
        base.epLoss, base.epBefore, base.epAfter,
        m.fenBefore, m.fenAfter, after.lines[0]?.pv ?? [], m.color,
      ) ||
        isGreatCandidate(base.label, base.epBefore, before.lines, m.color))
    ) {
      candidates.push({
        ply: m.ply, san: m.san, uci: m.from + m.to, color: m.color,
        fenBefore: m.fenBefore, fenAfter: m.fenAfter, prevEpLoss: null,
      });
    }
  }

  const ms = recheckMs();
  for (const c of candidates) {
    if (isCancelled()) throw new ReviewCancelled();
    const deepBefore = await getEngine().analyze(c.fenBefore, { movetimeMs: ms, multipv: 2 });
    if (isCancelled()) throw new ReviewCancelled();
    const deepAfter = await getEngine().analyze(c.fenAfter, { movetimeMs: ms, multipv: 2 });
    if (isCancelled()) throw new ReviewCancelled();

    const before: EvalInput = {
      lines: deepBefore.lines,
      bestUci: deepBefore.bestUci,
      terminal: null,
    };
    const afterEval: EvalInput = {
      lines: deepAfter.lines,
      bestUci: deepAfter.bestUci,
      terminal: evalsByPly[c.ply]?.terminal ?? null,
    };
    const base = classifyMove(
      { ply: c.ply, san: c.san, uci: c.uci, color: c.color },
      before,
      afterEval,
      c.fenBefore,
      c.prevEpLoss,
    );
    const special = applySpecial({
      base,
      before,
      after: afterEval,
      fenBefore: c.fenBefore,
      fenAfter: c.fenAfter,
      prevEpLoss: c.prevEpLoss,
      side: c.color,
    });
    const label = special?.label ?? base.label;
    const reason = special?.reason ?? base.reason;
    saveMoveClasses(gameId, [
      {
        ply: c.ply,
        san: c.san,
        uci: c.uci,
        label,
        epLoss: base.epLoss,
        epBefore: base.epBefore,
        epAfter: base.epAfter,
        bestUci: base.bestUci,
        reason,
        meta: JSON.stringify({ rechecked: true }),
      },
    ]);
  }

  // Refresh the summary so counts/accuracy match the confirmed labels.
  if (candidates.length > 0) {
    const rows = getMoveClasses(gameId);
    const colors = new Map(parsed.moves.map((m) => [m.ply, m.color]));
    const summary = summarize(
      rows.map((r) => ({
        label: r.label as MoveLabel,
        epBefore: r.ep_before,
        epAfter: r.ep_after,
        color: colors.get(r.ply) ?? "w",
      })),
    );
    updateGameReview(gameId, {
      classifier_version: CLASSIFIER_VERSION,
      summary: JSON.stringify(summary),
    });
  }
}

/**
 * Search with short backoff when the engine is briefly busy
 * (e.g. a live position analysis from the UI). Cancellation
 * during backoff aborts immediately.
 */
async function analyzeOwned(
  job: { cancelled: boolean },
  fen: string,
  movetimeMs: number,
): Promise<PositionEval> {
  for (let attempt = 0; ; attempt++) {
    if (job.cancelled) throw new ReviewCancelled();
    try {
      return await getEngine().analyze(fen, { movetimeMs, multipv: 2 });
    } catch (err) {
      if (err instanceof EngineBusyError && attempt < 10) {
        await sleep(500);
        continue;
      }
      throw err;
    }
  }
}

export async function runReview(gameId: number, movetimeMs?: number): Promise<void> {
  if (active) return;
  const game = getGame(gameId);
  if (!game) {
    emit(gameId, { type: "error", code: "NOT_FOUND", message: "Game tidak ditemukan." });
    return;
  }

  const perPosition =
    movetimeMs && Number.isFinite(movetimeMs) && movetimeMs > 0 ? Math.floor(movetimeMs) : 1000;
  const job = { gameId, cancelled: false };
  active = job;

  const markCancelled = () => {
    updateGameReview(gameId, { review_status: "cancelled" });
    emit(gameId, { type: "cancelled", done: countPositionEvals(gameId) });
  };

  try {
    const { version, config } = await getEngine().start();
    updateGameReview(gameId, {
      review_status: "running",
      engine_version: version,
      engine_config: JSON.stringify(config),
    });
    clearPositionEvals(gameId);

    const positions = buildPositions(game.pgn);
    const total = positions.length;

    for (const pos of positions) {
      if (job.cancelled) {
        markCancelled();
        return;
      }

      if (pos.terminal) {
        savePositionEval({
          gameId,
          ply: pos.ply,
          fen: pos.fen,
          terminal: pos.terminal,
          lines: [],
          bestUci: null,
          depth: 0,
        });
      } else {
        const result = await analyzeOwned(job, pos.fen, perPosition);
        savePositionEval({
          gameId,
          ply: pos.ply,
          fen: pos.fen,
          terminal: null,
          lines: result.lines,
          bestUci: result.bestUci,
          depth: result.depth,
        });
        emit(gameId, {
          type: "position",
          ply: pos.ply,
          lines: result.lines,
          bestUci: result.bestUci,
        });
      }

      emit(gameId, { type: "progress", done: countPositionEvals(gameId), total });
    }

    updateGameReview(gameId, { review_status: "done" });
    try {
      classifyAndSave(gameId);
      // Deep re-check for rare labels and big blunders (Fase 4b).
      // Cancellation is honored between searches.
      await classifyWithRecheck(gameId, () => job.cancelled);
      if (job.cancelled) {
        markCancelled();
        return;
      }
    } catch (err) {
      if (err instanceof ReviewCancelled) {
        markCancelled();
        return;
      }
      // Evals are the primary artifact and are already saved;
      // a classifier bug must not fail the whole review.
      console.error(`[review] classify failed for game ${gameId}:`, err);
    }
    emit(gameId, { type: "done", summary: getGame(gameId)?.summary ?? null });
  } catch (err) {
    if (err instanceof ReviewCancelled) {
      markCancelled();
      return;
    }
    const failed = err instanceof EngineFailedError ? err : new EngineFailedError();
    updateGameReview(gameId, { review_status: "failed" });
    emit(gameId, { type: "error", code: failed.code, message: failed.message });
  } finally {
    if (active?.gameId === gameId) active = null;
  }
}
