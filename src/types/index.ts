export type GameSource = "paste" | "file";

export type GameResult = "1-0" | "0-1" | "1/2-1/2" | "*";

export interface GameHeaders {
  white: string;
  black: string;
  result: string;
  event?: string;
  playedAt?: string;
  setUp?: string;
  fen?: string;
}

export interface MoveRecord {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
}

export interface ParsedGame {
  headers: GameHeaders;
  moves: MoveRecord[];
  startFen: string;
  plyCount: number;
  pgn: string;
}

export interface FenValidationResult {
  ok: boolean;
  error?: string;
}

export interface MultiGameInfo {
  index: number;
  white: string;
  black: string;
  result: string;
}

export class PgnError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "PgnError";
  }
}

export type SideToMove = "w" | "b";

/** One engine line, evaluation from White's perspective. */
export interface EvalLine {
  multipv: number;
  cp?: number;
  mate?: number;
  depth: number;
  pv: string[];
}

/** Full result of one position search, evaluation from White's perspective. */
export interface PositionEval {
  lines: EvalLine[];
  bestUci: string | null;
  depth: number;
}

export interface EngineConfig {
  threads: number;
  hashMb: number;
  multipv: number;
}

export interface AnalyzeOptions {
  movetimeMs: number;
  multipv?: number;
}

/** Move classification. Same strings as `move_classes.label` in DATABASE_SCHEMA.md. */
export type MoveLabel =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder";
