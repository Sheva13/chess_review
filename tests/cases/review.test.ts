import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePgn } from "../../src/lib/chess/index.ts";
import {
  buildPositions,
  cancelReview,
  runReview,
  subscribe,
} from "../../src/lib/review/runner.ts";
import type { ReviewEvent } from "../../src/lib/review/runner.ts";
import {
  closeDb,
  countPositionEvals,
  createGame,
  getGame,
  getMoveClasses,
  getPositionEvals,
} from "../../src/lib/db/index.ts";
import { hashPgn } from "../../src/lib/chess/index.ts";
import { getEngine } from "../../src/lib/engine/manager.ts";

// Isolated file DB (also exercises directory creation).
process.env.DB_PATH = join(tmpdir(), `chess-review-test-${process.pid}.sqlite`);

// Same .env.local loading as engine-integration tests.
const envFile = join(import.meta.dirname, "..", "..", ".env.local");
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const key = line.slice(0, line.indexOf("=")).trim();
    if (!(key in process.env)) {
      process.env[key] = line.slice(line.indexOf("=") + 1).trim();
    }
  }
}

const HAS_ENGINE = Boolean(process.env.STOCKFISH_PATH);
const MULTI = readFileSync(join(import.meta.dirname, "..", "fixtures", "multi-game.pgn"), "utf-8");
const SIMPLE = readFileSync(join(import.meta.dirname, "..", "fixtures", "simple-game.pgn"), "utf-8");

after(() => {
  getEngine().destroy();
  closeDb();
});

function seedGame(pgn: string, hash: string) {
  const parsed = parsePgn(pgn);
  return createGame({
    pgn: parsed.pgn,
    pgnHash: hashPgn(parsed.pgn) + hash,
    white: parsed.headers.white,
    black: parsed.headers.black,
    result: parsed.headers.result,
    source: "paste",
    plyCount: parsed.plyCount,
  });
}

describe("buildPositions", () => {
  it("builds N+1 positions and marks terminal mate", () => {
    const first = parsePgn(MULTI.split(/(?=\[Event "Game Two")/)[0]);
    const positions = buildPositions(first.pgn);
    assert.equal(positions.length, first.plyCount + 1);
    assert.equal(positions[0].ply, 0);
    assert.equal(positions[positions.length - 1].ply, first.plyCount);
    const last = positions[positions.length - 1];
    assert.equal(last.terminal, "checkmate");
    assert.ok(positions.slice(0, -1).every((p) => p.terminal === null));
  });
});

describe("runReview", { skip: !HAS_ENGINE }, () => {
  it("reviews a mate game end to end without engine on terminal", async () => {
    const first = parsePgn(MULTI.split(/(?=\[Event "Game Two")/)[0]);
    const row = seedGame(first.pgn, "-review-full");
    const events: ReviewEvent[] = [];
    const unsub = subscribe(row.id, (ev) => events.push(ev));

    await runReview(row.id, 200);
    unsub();

    assert.equal(getGame(row.id)?.review_status, "done");
    assert.equal(countPositionEvals(row.id), first.plyCount + 1);
    const evals = getPositionEvals(row.id);
    const last = evals[evals.length - 1];
    assert.equal(last.terminal, "checkmate");
    assert.deepEqual(last.lines, []);
    assert.ok(getGame(row.id)?.engine_version?.toLowerCase().includes("stockfish"));
    assert.ok(events.some((e) => e.type === "progress"));
    assert.ok(events.some((e) => e.type === "done"));
    // Non-terminal positions got real engine lines.
    assert.ok(evals.slice(0, -1).every((e) => e.lines.length > 0 && e.best_uci));
  });

  it("cancels mid-review and keeps partial results", async () => {
    const row = seedGame(SIMPLE, "-review-cancel");
    const run = runReview(row.id, 2000);
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal(cancelReview(row.id), true);
    await run;

    assert.equal(getGame(row.id)?.review_status, "cancelled");
    const n = countPositionEvals(row.id);
    const total = parsePgn(SIMPLE).plyCount + 1;
    assert.ok(n > 0 && n < total, `expected partial evals, got ${n}/${total}`);
  });

  it("ignores cancel for a game with no active review", () => {
    assert.equal(cancelReview(999999), false);
  });

  it("deep re-checks the dubious sacrifice and stamps meta", async () => {
    process.env.RECHECK_MOVETIME_MS = "400";
    try {
      const custom = readFileSync(join(import.meta.dirname, "..", "fixtures", "custom-fen.pgn"), "utf-8");
      const parsed = parsePgn(custom);
      const row = seedGame(parsed.pgn, "-recheck");
      await runReview(row.id, 200);

      assert.equal(getGame(row.id)?.review_status, "done");
      const classes = getMoveClasses(row.id);
      assert.equal(classes.length, parsed.plyCount);
      const first = classes.find((c) => c.ply === 1);
      assert.ok(first);
      assert.ok(["blunder", "mistake"].includes(first.label));
      assert.equal(JSON.parse(first.meta ?? "{}").rechecked, true);
      const summary = JSON.parse(getGame(row.id)?.summary ?? "{}");
      const total = Object.values(summary.counts as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      );
      assert.equal(total, parsed.plyCount);
      assert.equal(summary.classifierVersion, "1");
    } finally {
      delete process.env.RECHECK_MOVETIME_MS;
    }
  });
});
