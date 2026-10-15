import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { EvalLine } from "../../types";

export type ReviewStatus = "none" | "running" | "done" | "cancelled" | "failed";

export interface GameRow {
  id: number;
  pgn: string;
  pgn_hash: string;
  white: string;
  black: string;
  result: string;
  event: string | null;
  played_at: string | null;
  source: string;
  start_fen: string | null;
  ply_count: number;
  review_status: ReviewStatus;
  engine_version: string | null;
  engine_config: string | null;
  classifier_version: string | null;
  summary: string | null;
  created_at: string;
}

export interface GameSummary {
  id: number;
  white: string;
  black: string;
  result: string;
  played_at: string | null;
  review_status: ReviewStatus;
  summary: string | null;
}

export interface PositionEvalRow {
  game_id: number;
  ply: number;
  fen: string;
  terminal: string | null;
  lines: EvalLine[];
  best_uci: string | null;
  depth: number;
}

export interface NewGame {
  pgn: string;
  pgnHash: string;
  white: string;
  black: string;
  result: string;
  event?: string;
  playedAt?: string;
  source: string;
  startFen?: string;
  plyCount: number;
}

// Numbered migrations (inline so route handlers work in dev and builds).
const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pgn TEXT NOT NULL,
  pgn_hash TEXT NOT NULL UNIQUE,
  white TEXT NOT NULL DEFAULT '?',
  black TEXT NOT NULL DEFAULT '?',
  result TEXT NOT NULL DEFAULT '*',
  event TEXT,
  played_at TEXT,
  source TEXT NOT NULL DEFAULT 'paste',
  start_fen TEXT,
  ply_count INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'none',
  engine_version TEXT,
  engine_config TEXT,
  classifier_version TEXT,
  summary TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS position_evals (
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  fen TEXT NOT NULL,
  terminal TEXT,
  lines TEXT NOT NULL DEFAULT '[]',
  best_uci TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, ply)
);
CREATE TABLE IF NOT EXISTS move_classes (
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  san TEXT NOT NULL,
  uci TEXT NOT NULL,
  label TEXT NOT NULL,
  ep_loss REAL NOT NULL DEFAULT 0,
  ep_before REAL NOT NULL DEFAULT 0,
  ep_after REAL NOT NULL DEFAULT 0,
  best_uci TEXT,
  reason TEXT NOT NULL DEFAULT '',
  meta TEXT,
  PRIMARY KEY (game_id, ply)
);
CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at DESC);
`,
  },
];

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const raw = process.env.DB_PATH ?? "./data/chess-review.sqlite";
  const dbPath = raw === ":memory:" ? raw : resolve(process.cwd(), raw);
  if (dbPath !== ":memory:") {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

/** Close the singleton (tests only). */
export function closeDb(): void {
  db?.close();
  db = null;
}

function migrate(database: Database.Database): void {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)",
  );
  const done = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((r) => (r as { version: number }).version),
  );
  const insert = database.prepare("INSERT INTO schema_migrations (version) VALUES (?)");
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    const run = database.transaction(() => {
      database.exec(m.sql);
      insert.run(m.version);
    });
    run();
  }
}

function toGameRow(r: unknown): GameRow {
  const g = r as Record<string, unknown>;
  return {
    id: g.id as number,
    pgn: g.pgn as string,
    pgn_hash: g.pgn_hash as string,
    white: g.white as string,
    black: g.black as string,
    result: g.result as string,
    event: (g.event as string | null) ?? null,
    played_at: (g.played_at as string | null) ?? null,
    source: g.source as string,
    start_fen: (g.start_fen as string | null) ?? null,
    ply_count: g.ply_count as number,
    review_status: g.review_status as ReviewStatus,
    engine_version: (g.engine_version as string | null) ?? null,
    engine_config: (g.engine_config as string | null) ?? null,
    classifier_version: (g.classifier_version as string | null) ?? null,
    summary: (g.summary as string | null) ?? null,
    created_at: g.created_at as string,
  };
}

export function createGame(input: NewGame): GameRow {
  const database = getDb();
  const info = database
    .prepare(
      `INSERT INTO games
        (pgn, pgn_hash, white, black, result, event, played_at, source, start_fen, ply_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.pgn,
      input.pgnHash,
      input.white,
      input.black,
      input.result,
      input.event ?? null,
      input.playedAt ?? null,
      input.source,
      input.startFen ?? null,
      input.plyCount,
      new Date().toISOString(),
    );
  const row = database.prepare("SELECT * FROM games WHERE id = ?").get(info.lastInsertRowid);
  if (!row) throw new Error("Failed to create game.");
  return toGameRow(row);
}

export function findGameByHash(pgnHash: string): GameRow | null {
  const row = getDb().prepare("SELECT * FROM games WHERE pgn_hash = ?").get(pgnHash);
  return row ? toGameRow(row) : null;
}

export function getGame(id: number): GameRow | null {
  const row = getDb().prepare("SELECT * FROM games WHERE id = ?").get(id);
  return row ? toGameRow(row) : null;
}

export function listGames(): GameSummary[] {
  return getDb()
    .prepare(
      "SELECT id, white, black, result, played_at, review_status, summary FROM games ORDER BY created_at DESC",
    )
    .all()
    .map((r) => {
      const g = r as Record<string, unknown>;
      return {
        id: g.id as number,
        white: g.white as string,
        black: g.black as string,
        result: g.result as string,
        played_at: (g.played_at as string | null) ?? null,
        review_status: g.review_status as ReviewStatus,
        summary: (g.summary as string | null) ?? null,
      };
    });
}

export function updateGameReview(
  id: number,
  patch: Partial<
    Pick<
      GameRow,
      "review_status" | "engine_version" | "engine_config" | "classifier_version" | "summary"
    >
  >,
): void {
  const keys = Object.keys(patch) as Array<keyof typeof patch>;
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => patch[k] ?? null);
  getDb().prepare(`UPDATE games SET ${set} WHERE id = ?`).run(...values, id);
}

export function deleteGame(id: number): boolean {
  return getDb().prepare("DELETE FROM games WHERE id = ?").run(id).changes > 0;
}

export function savePositionEval(evalRow: {
  gameId: number;
  ply: number;
  fen: string;
  terminal: string | null;
  lines: EvalLine[];
  bestUci: string | null;
  depth: number;
}): void {
  getDb()
    .prepare(
      `INSERT INTO position_evals (game_id, ply, fen, terminal, lines, best_uci, depth)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (game_id, ply) DO UPDATE SET
         fen = excluded.fen, terminal = excluded.terminal, lines = excluded.lines,
         best_uci = excluded.best_uci, depth = excluded.depth`,
    )
    .run(
      evalRow.gameId,
      evalRow.ply,
      evalRow.fen,
      evalRow.terminal,
      JSON.stringify(evalRow.lines),
      evalRow.bestUci,
      evalRow.depth,
    );
}

export function getPositionEvals(gameId: number): PositionEvalRow[] {
  return getDb()
    .prepare("SELECT * FROM position_evals WHERE game_id = ? ORDER BY ply ASC")
    .all(gameId)
    .map((r) => {
      const e = r as Record<string, unknown>;
      return {
        game_id: e.game_id as number,
        ply: e.ply as number,
        fen: e.fen as string,
        terminal: (e.terminal as string | null) ?? null,
        lines: JSON.parse((e.lines as string) ?? "[]") as EvalLine[],
        best_uci: (e.best_uci as string | null) ?? null,
        depth: e.depth as number,
      };
    });
}

export interface MoveClassRow {
  game_id: number;
  ply: number;
  san: string;
  uci: string;
  label: string;
  ep_loss: number;
  ep_before: number;
  ep_after: number;
  best_uci: string | null;
  reason: string;
  meta: string | null;
}

export function saveMoveClasses(
  gameId: number,
  rows: Array<{
    ply: number;
    san: string;
    uci: string;
    label: string;
    epLoss: number;
    epBefore: number;
    epAfter: number;
    bestUci: string | null;
    reason: string;
    meta?: string | null;
  }>,
): void {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO move_classes
      (game_id, ply, san, uci, label, ep_loss, ep_before, ep_after, best_uci, reason, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (game_id, ply) DO UPDATE SET
       san = excluded.san, uci = excluded.uci, label = excluded.label,
       ep_loss = excluded.ep_loss, ep_before = excluded.ep_before,
       ep_after = excluded.ep_after, best_uci = excluded.best_uci,
       reason = excluded.reason, meta = excluded.meta`,
  );
  const run = database.transaction(() => {
    for (const r of rows) {
      insert.run(
        gameId,
        r.ply,
        r.san,
        r.uci,
        r.label,
        r.epLoss,
        r.epBefore,
        r.epAfter,
        r.bestUci,
        r.reason,
        r.meta ?? null,
      );
    }
  });
  run();
}

export function getMoveClasses(gameId: number): MoveClassRow[] {
  return getDb()
    .prepare("SELECT * FROM move_classes WHERE game_id = ? ORDER BY ply ASC")
    .all(gameId)
    .map((r) => {
      const c = r as Record<string, unknown>;
      return {
        game_id: c.game_id as number,
        ply: c.ply as number,
        san: c.san as string,
        uci: c.uci as string,
        label: c.label as string,
        ep_loss: c.ep_loss as number,
        ep_before: c.ep_before as number,
        ep_after: c.ep_after as number,
        best_uci: (c.best_uci as string | null) ?? null,
        reason: c.reason as string,
        meta: (c.meta as string | null) ?? null,
      };
    });
}

export function deleteMoveClasses(gameId: number): void {
  getDb().prepare("DELETE FROM move_classes WHERE game_id = ?").run(gameId);
}

export function clearPositionEvals(gameId: number): void {
  const database = getDb();
  database.prepare("DELETE FROM position_evals WHERE game_id = ?").run(gameId);
  database.prepare("DELETE FROM move_classes WHERE game_id = ?").run(gameId);
}

export function countPositionEvals(gameId: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM position_evals WHERE game_id = ?")
    .get(gameId) as { n: number };
  return row.n;
}
