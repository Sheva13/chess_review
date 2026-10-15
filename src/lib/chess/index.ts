import { createHash } from "node:crypto";
import { Chess, validateFen, DEFAULT_POSITION } from "chess.js";
import type {
  FenValidationResult,
  GameHeaders,
  MoveRecord,
  MultiGameInfo,
  ParsedGame,
  SideToMove,
} from "../../types";
import { PgnError } from "../../types";

const MAX_PGN_BYTES = Number(process.env.MAX_PGN_BYTES ?? 200000);

export function parsePgn(pgn: string): ParsedGame {
  const trimmed = pgn.trim();

  if (trimmed.length === 0) {
    throw new PgnError("INVALID_PGN", "PGN kosong.");
  }

  if (pgn.length > MAX_PGN_BYTES) {
    throw new PgnError(
      "PAYLOAD_TOO_LARGE",
      `PGN melebihi batas ${MAX_PGN_BYTES} bytes.`,
    );
  }

  const chess = new Chess();
  let loaded = false;

  try {
    chess.loadPgn(trimmed);
    loaded = true;
  } catch {
    // ponytail: chess.js v1.4.0 PGN parser fails on black castling (O-O).
    // Fallback: manually parse headers + replay moves via chess.move().
    loaded = tryManualLoad(chess, trimmed);
  }

  if (!loaded) {
    throw new PgnError("INVALID_PGN", "PGN tidak valid: gagal diparsing.");
  }

  const headers = extractHeaders(chess);
  const startFen = headers.fen ?? DEFAULT_POSITION;

  const history = chess.history({ verbose: true });

  const moves: MoveRecord[] = history.map((m, i) => ({
    ply: i + 1,
    san: m.san,
    from: m.from,
    to: m.to,
    color: m.color,
    fenBefore: m.before,
    fenAfter: m.after,
  }));

  return {
    headers,
    moves,
    startFen,
    plyCount: moves.length,
    pgn: trimmed,
  };
}

export function validateFenString(fen: string): FenValidationResult {
  const result = validateFen(fen);
  return { ok: result.ok, error: result.error };
}

/**
 * Convert a UCI move list into SAN, stopping at the first illegal move.
 * Used to render engine principal variations.
 */
export function uciToSanLine(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of uciMoves) {
    const from = u.slice(0, 2);
    const to = u.slice(2, 4);
    const promotion = u.length > 4 ? u.slice(4) : undefined;
    try {
      out.push(chess.move({ from, to, promotion }).san);
    } catch {
      break;
    }
  }
  return out;
}

export interface BoardArrow {
  from: string;
  to: string;
  color: string;
}

/** Join from/to/promotion squares into one UCI string. */
export function buildUci(from: string, to: string, promotion?: string): string {
  return promotion ? `${from}${to}${promotion}` : `${from}${to}`;
}

/**
 * Replay UCI moves on top of a FEN. Returns the resulting FEN.
 * Throws on the first illegal move. Empty list returns the input.
 */
export function applyUciMoves(fen: string, uciMoves: string[]): string {
  const chess = new Chess(fen);
  for (const u of uciMoves) {
    chess.move({
      from: u.slice(0, 2),
      to: u.slice(2, 4),
      promotion: u.length > 4 ? u.slice(4) : undefined,
    });
  }
  return chess.fen();
}

/** Piece on a square, or null when empty/invalid. */
export function pieceAt(fen: string, square: string): { type: string; color: SideToMove } | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const found = chess.get(square as never);
  return found ? { type: found.type, color: found.color } : null;
}

/** Side to move from a FEN string. Defaults to White on garbage. */
export function sideToMove(fen: string): SideToMove {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/**
 * Legal destination squares for the piece on the given square.
 * Empty for empty squares, enemy pieces (deselect signal) and bad FEN.
 * Own-occupied squares never appear — legality handles blocking.
 */
export function legalTargets(fen: string, square: string): string[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  try {
    return chess.moves({ square: square as never, verbose: true }).map((m) => m.to);
  } catch {
    return [];
  }
}

/** True when a pawn move reaches the last rank (needs promotion choice). */
export function isPawnPromotion(fen: string, from: string, to: string): boolean {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return false;
  }
  const piece = chess.get(from as never);
  if (!piece || piece.type !== "p") return false;
  const lastRank = piece.color === "w" ? "8" : "1";
  return to.endsWith(lastRank);
}

export const ARROW_COLORS = {
  /** Last played move: amber, readable on both square colors. */
  lastMove: "#EAB308",
  /** Engine best move. */
  best: "#81B64C",
  /** Check threat, drawn on top. */
  check: "#E03131",
} as const;

/**
 * If the side to move is in check, return an arrow from the checking
 * piece to the king. Otherwise null.
 */
export function getCheckArrow(fen: string): { from: string; to: string } | null {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  if (!chess.isCheck()) return null;
  const turn = chess.turn();
  const kings = chess.findPiece({ type: "k", color: turn });
  if (kings.length === 0) return null;
  const kingSq = kings[0];
  const attackers = chess.attackers(kingSq, turn === "w" ? "b" : "w");
  if (attackers.length === 0) return null;
  return { from: attackers[0], to: kingSq };
}

/**
 * Assemble board arrows in draw order: last move, best move, check on top.
 * The best-move arrow is skipped when it duplicates the played move.
 */
export function buildMoveArrows(opts: {
  lastMove?: { from: string; to: string } | null;
  bestUci?: string | null;
  check?: { from: string; to: string } | null;
}): BoardArrow[] {
  const arrows: BoardArrow[] = [];
  const played = opts.lastMove ? opts.lastMove.from + opts.lastMove.to : "";
  if (opts.lastMove) {
    arrows.push({ ...opts.lastMove, color: ARROW_COLORS.lastMove });
  }
  if (opts.bestUci && opts.bestUci.slice(0, 4) !== played.slice(0, 4)) {
    arrows.push({
      from: opts.bestUci.slice(0, 2),
      to: opts.bestUci.slice(2, 4),
      color: ARROW_COLORS.best,
    });
  }
  if (opts.check) {
    arrows.push({ ...opts.check, color: ARROW_COLORS.check });
  }
  return arrows;
}

export function getFenAtPly(game: ParsedGame, ply: number): string {
  if (ply < 0 || ply > game.plyCount) {
    throw new RangeError(`ply ${ply} out of range (0..${game.plyCount})`);
  }
  if (ply === 0) return game.startFen;
  return game.moves[ply - 1].fenAfter;
}

export function detectMultipleGames(pgn: string): MultiGameInfo[] {
  const games: MultiGameInfo[] = [];
  const chunks = splitPgnGames(pgn);

  for (let i = 0; i < chunks.length; i++) {
    try {
      const parsed = parsePgn(chunks[i]);
      games.push({
        index: i,
        white: parsed.headers.white,
        black: parsed.headers.black,
        result: parsed.headers.result,
      });
    } catch {
      // skip unparseable chunks
    }
  }

  return games;
}

function tryManualLoad(chess: Chess, pgn: string): boolean {
  try {
    const { headers, movetext } = splitPgn(pgn);

    if (headers.FEN) {
      chess.load(headers.FEN);
    }

    const sans = tokenizeMovetext(movetext);
    for (const san of sans) {
      chess.move(san);
    }

    for (const [key, value] of Object.entries(headers)) {
      chess.setHeader(key, value);
    }

    return true;
  } catch {
    return false;
  }
}

function splitPgn(pgn: string): {
  headers: Record<string, string>;
  movetext: string;
} {
  const normalized = pgn.replace(/\r\n/g, "\n");
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  const headers: Record<string, string> = {};

  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(normalized)) !== null) {
    headers[match[1]] = match[2];
  }

  const movetext = normalized
    .replace(headerRegex, "")
    .replace(/\{[^}]*\}/g, "")
    .trim();

  return { headers, movetext };
}

function tokenizeMovetext(movetext: string): string[] {
  return movetext
    .replace(/\d+\.+/g, " ")
    .replace(/\$\d+/g, "")
    .replace(/(1-0|0-1|1\/2-1\/2|\*)/g, "")
    .split(/\s+/)
    .filter((s) => s.length > 0);
}

function splitPgnGames(pgn: string): string[] {
  const normalized = pgn.replace(/\r\n/g, "\n");
  const parts = normalized.split(/\n\s*\n(?=\[)/);
  return parts.filter((p) => p.trim().length > 0);
}

/** Stable identity hash: insensitive to line endings and extra spaces. */
export function hashPgn(pgn: string): string {
  const normalized = pgn
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** Parse the Nth game (0-based) of a multi-game PGN. */
export function parsePgnGame(pgn: string, index: number): ParsedGame {
  const chunks = splitPgnGames(pgn);
  const chunk = chunks[index];
  if (!chunk) throw new PgnError("INVALID_PGN", `Game ke-${index} tidak ada.`);
  return parsePgn(chunk);
}

function extractHeaders(chess: Chess): GameHeaders {
  const h = chess.getHeaders();
  return {
    white: h.White ?? "?",
    black: h.Black ?? "?",
    result: h.Result ?? "*",
    event: h.Event,
    playedAt: h.Date,
    setUp: h.SetUp,
    fen: h.FEN,
  };
}
